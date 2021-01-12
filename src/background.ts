import { sendMessageToContentScript, collectDataOverTime, getExportOptions, isDev, secondToDate } from './common'
import { RecordData, createReplayHTML, RecordType, delay } from 'timecatjs'

export const timeCatScript = isDev
    ? 'http://localhost:4321/timecat.global.js'
    : chrome.runtime.getURL('timecat.global.prod.js')

type iStatus = 'run' | 'wait' | 'finish'
let time = 0
let timer: number

let isRunning = false
let isWaiting = true
let waitingTabId: number

let activeUrl: string
let activeTabId: number

setStatus('finish')
injectAllContentScript()

const collector = collectDataOverTime<RecordData>(result => {
    const packs = getPacks(result.flat())
    const sortedRecords = packs.sort((a, b) => a[0].time - b[0].time).flat()
    const firstHead = sortedRecords.findIndex(record => record.type === RecordType.HEAD)
    sortedRecords.splice(0, firstHead)
    download(sortedRecords)
}, 1000)

function getPacks(records: RecordData[]) {
    const packs: RecordData[][] = []
    const pack: RecordData[] = []

    records.forEach((record, i) => {
        if (i && record.type === 0) {
            packs.push(pack.slice())
            pack.length = 0
        }
        pack.push(record)

        if (records.length - 1 === i) {
            packs.push(pack)
        }
    })

    return packs
}

function recordPage(status: 'run' | 'finish') {
    const isStart = status === 'run'
    if (isRunning === isStart) {
        return
    }
    isRunning = isStart

    if (isStart) {
        setStatus('wait')
        sendMessageToContentScript({ type: 'START' }, (isInjected: boolean) => {
            if (isInjected) {
                setStatus('run')
            }
        })
        return
    } else {
        chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => chrome.tabs.sendMessage(tab.id!, { type: 'COLLECT_RECORDS' }))
        })
        setStatus('finish')
    }
}

function setStatus(status: iStatus) {
    if (status === 'run') {
        if (timer) {
            return
        }
        setStatusIcon('run')
        increaseTimer()
        timer = window.setInterval(increaseTimer, 1000)
        isRunning = true

        function increaseTimer() {
            const text = secondToDate(time)
            chrome.browserAction.setBadgeText({ text })
            time++
        }
    } else if (status === 'wait') {
        setStatusIcon('wait')
        clearInterval(timer)
        timer = 0
        chrome.browserAction.setBadgeText({ text: 'pause' })
    } else {
        clearInterval(timer)
        setStatusIcon('finish')
        time = timer = 0
        chrome.browserAction.setBadgeText({ text: '' })
    }
}

function setStatusIcon(status: iStatus) {
    let path: string
    switch (status) {
        case 'run':
            path = getIconPath('red')
            break
        case 'wait':
            path = getIconPath('white')
            break
        case 'finish':
            path = getIconPath('black')
            break
        default:
            return
    }
    chrome.browserAction.setIcon({ path })
}

async function getCurrentTabInfo(): Promise<{ url?: string; id?: number }> {
    return new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            const tab = tabs[0]
            if (!tab) {
                return resolve({})
            }
            resolve({ url: tab.url, id: tab.id })
        })
    })
}

async function download(records: RecordData[]) {
    const options = await getExportOptions()
    const exportOptions = {
        records,
        scripts: [
            {
                name: 'time-cat',
                src: timeCatScript
            }
        ],
        ...options
    }

    function getRandomCode(len: 6 | 7 | 8 = 8) {
        const code = (Math.random() * 20 + 16).toString(36).substring(2, len + 2)
        return code.toUpperCase()
    }

    const doc = await createReplayHTML(exportOptions)
    const html = doc.documentElement.outerHTML
    const blob = new Blob([html], { type: 'text/html' })
    chrome.downloads.download({
        url: URL.createObjectURL(blob),
        filename: `TimeCat-${getRandomCode()}.html`
    })
}

function getIconPath(iconName: string) {
    return 'record-icon-' + iconName + '.png'
}

function injectAllContentScript() {
    chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
            const tabId = tab.id
            const tabUrl = tab.url
            if (tabId && tabUrl) {
                if (/^https?/.test(tabUrl)) {
                    chrome.tabs.sendMessage(tabId, { type: 'DETECT_INJECTED' }, response => {
                        var lastError = chrome.runtime.lastError
                        if (!response && lastError?.message) {
                            chrome.tabs.executeScript(tabId, { file: 'timecat-chrome-content.js' })
                        }
                    })
                }
            }
        })
    })
}

async function onUrlChange(opts: { url?: string; tabId?: number; isDomReady?: boolean }) {
    const { url, isDomReady } = opts

    const { id: tabId } = await getCurrentTabInfo()
    if (!tabId) {
        return
    }

    await delay(200)

    if (!url) {
        return
    }

    if (/^chrome:/.test(url)) {
        if (isRunning) {
            activeUrl = url
            setStatus('wait')
        }
        return
    }

    const isSameTab = tabId === activeTabId

    if (url === activeUrl && isSameTab && !isDomReady) {
        return
    }

    activeUrl = url
    activeTabId = tabId!

    await new Promise(r => setTimeout(r, 500))
    if (isRunning) {
        sendMessageToContentScript({ type: 'START' }, (isInjected: boolean) => {
            if (isInjected) {
                isWaiting = false
                setStatus('run')
            }
        })
    }
}

chrome.runtime.onMessage.addListener(request => {
    const { type } = request
    if (type === 'BACK_RECORDS') {
        const { records, isFinal } = request.data
        if (!isFinal && timer) {
            setStatus('wait')
        }
        collector(records, isFinal)
    } else if (type === 'DOM_READY') {
        const url = request.data.url
        onUrlChange({ url, isDomReady: true })
    }
})

chrome.browserAction.onClicked.addListener(() => {
    recordPage(isRunning ? 'finish' : 'run')
})

chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId, tab => {
        const { url } = tab
        onUrlChange({ url, tabId })
    })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    const url = tab.url
    if (!url) {
        return
    }

    if (!isRunning) {
        return
    }

    if (isWaiting) {
        return
    }

    if (waitingTabId === tabId) {
        return
    }

    setStatus('wait')
    isWaiting = true
    waitingTabId = tabId
})

chrome.windows.onRemoved.addListener(windowId => {
    chrome.windows.getAll(windows => {
        if (!windows.length) {
            setStatus('finish')
            isRunning = false
            isWaiting = false
            waitingTabId = 0
        }
    })
})

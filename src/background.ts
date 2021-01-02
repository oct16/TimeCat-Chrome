import { sendMessageToContentScript, collectDataOverTime, getExportOptions, timeCatScript } from './common'
import { RecordData, createReplayHTML } from 'timecatjs'

type iStatus = 'run' | 'wait' | 'finish'
let time = 0
let timer: number
let running = false

setStatus('finish')

const collector = collectDataOverTime<RecordData>(result => {
    const packs = getPacks(result.flat())
    const sortedRecords = packs.sort((a, b) => a[0].time - b[0].time)
    download(sortedRecords.flat())
    setStatus('finish')
}, 500)

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
    if (running === isStart) {
        return
    }
    running = isStart

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
        pinterTimerHandle()
        timer = window.setInterval(pinterTimerHandle, 1000)
        running = true

        function pinterTimerHandle() {
            const text = secondToDate(time)
            chrome.browserAction.setBadgeText({ text })
            time++
        }
    } else if (status === 'wait') {
        setStatusIcon('wait')
        clearInterval(timer)
        timer = 0
        chrome.browserAction.setBadgeText({ text: '⏸' })
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

chrome.runtime.onMessage.addListener(request => {
    const { type } = request
    if (type === 'BACK_RECORDS') {
        const { records, isFinal } = request.data
        if (!isFinal && timer) {
            setStatus('wait')
        }
        collector(records, isFinal)
    }
})

chrome.browserAction.onClicked.addListener(() => {
    recordPage(running ? 'finish' : 'run')
})

function getIconPath(iconName: string) {
    return 'record-icon-' + iconName + '.png'
}

function secondToDate(second: number) {
    if (second <= 0) {
        second = 0
    }
    const [h, m, s] = [Math.floor(second / 3600), Math.floor((second / 60) % 60), Math.floor(second % 60)]
    const timeStr = [h, m, s].map(i => (i <= 9 ? '0' + i : i)).join(':')
    return timeStr.replace(/^00:/, '')
}

chrome.tabs.onActivated.addListener(activeInfo => {
    chrome.tabs.get(activeInfo.tabId, tab => {
        onUrlChange(tab.url)
    })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.status === 'complete') {
        onUrlChange(tab.url)
    }
})

async function onUrlChange(url?: string) {
    if (!url) {
        return
    }
    await new Promise(r => setTimeout(r, 300))
    if (running) {
        if (/chrome:/.test(url)) {
            setStatus('wait')
        } else if (/^https?/.test(url)) {
            sendMessageToContentScript({ type: 'START' }, (isInjected: boolean) => {
                if (isInjected) {
                    setStatus('run')
                }
            })
        }
    }
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

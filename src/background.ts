import { sendMessageToContentScript, collectDataOverTime } from './common'
import { RecordData } from 'timecatjs'

let time = 0
let timer: NodeJS.Timeout
let running = false

const collector = collectDataOverTime<RecordData>(result => {
    const packs = getPacks(result.flat())
    const sortedRecords = packs.sort((a, b) => a[0].time - b[0].time)
    sendMessageToContentScript({ type: 'FINISH', records: sortedRecords.flat() })
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

function recordPage(status: boolean) {
    running = !status

    if (!running) {
        chrome.browserAction.setIcon({ path: getIconPath('red') })
        sendMessageToContentScript({ type: 'START' })
        timeHandle()
        timer = setInterval(timeHandle, 1000)
        running = true
    } else {
        chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => chrome.tabs.sendMessage(tab.id!, { type: 'COLLECT_RECORDS' }))
        })
        time = 0
        clearInterval(timer)
        chrome.browserAction.setIcon({ path: getIconPath('black') })
        chrome.browserAction.setBadgeText({ text: '' })
        running = false
    }
}

function timeHandle() {
    const text = secondToDate(time)
    chrome.browserAction.setBadgeText({ text })
    time++
}

chrome.runtime.onMessage.addListener(request => {
    const { type } = request
    if (type === 'RECORD_CANCEL') {
        recordPage(false)
    } else if (type === 'BACK_RECORDS') {
        const { records, isFinal } = request.data
        collector(records, isFinal)
    }
})

chrome.browserAction.onClicked.addListener(() => recordPage(!running))

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
    await new Promise(r => setTimeout(r, 300))
    if (url && running) {
        sendMessageToContentScript({ type: 'START' })
    }
}

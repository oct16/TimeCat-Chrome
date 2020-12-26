import { dispatchEvent, sendMessageToBackgroundScript, getRecordOptions, getExportOptions } from './common'
import { RecordData } from 'timecatjs'
const isDev = process.env.NODE_ENV === 'development'
const timeCatScript = isDev
    ? 'http://localhost:4321/timecat.global.js'
    : chrome.runtime.getURL('timecat.global.prod.js')

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    sendResponse(null)
    const { type } = request
    switch (type) {
        case 'START': {
            lazyInject(async () => {
                const options = await getRecordOptions()
                dispatchEvent('CHROME_RECORD_START', options)
            })
            break
        }
        case 'FINISH': {
            const records = request.records
            const options = await getExportOptions()
            dispatchEvent('CHROME_RECORD_FINISH', {
                records,
                options: {
                    scripts: [
                        {
                            name: 'time-cat',
                            src: timeCatScript
                        }
                    ],
                    ...options
                }
            })
            break
        }
        case 'TAB_CHANGE': {
            dispatchEvent('CHROME_TAB_CHANGE')
            break
        }
        case 'COLLECT_RECORDS': {
            dispatchEvent('CHROME_RECORD_COLLECT')
            break
        }
    }
    return true
})

window.addEventListener('RECORD_COLLECT_TO_CONTENT', (e: CustomEvent) => {
    const { isFinal, records } = e.detail as { isFinal: boolean; records: RecordData[] }
    sendMessageToBackgroundScript({
        type: 'BACK_RECORDS',
        data: { isFinal, records }
    })
})

window.addEventListener('CHROME_RECORD_CANCEL', () =>
    sendMessageToBackgroundScript({
        type: 'RECORD_CANCEL'
    })
)

const injectMain = injectScriptOnce({
    name: 'time-cat',
    src: timeCatScript
})

const injectPageJS = injectScriptOnce({
    name: 'timecat-chrome-page',
    src: chrome.runtime.getURL('timecat-chrome-page.js')
})

function lazyInject(onLoadFn: () => void) {
    if (!window.document.getElementById('time-cat')) {
        Promise.all([new Promise(injectMain), new Promise(injectPageJS)]).then(() => {
            onLoadFn()
        })
    } else {
        onLoadFn()
    }
}

function injectScriptOnce(scriptItem: { name: string; src: string }) {
    let el: HTMLScriptElement | null = null

    return function(callback?: () => void) {
        const { name, src } = scriptItem

        const document = window.document
        if (el && callback) {
            callback()
            return el
        }

        if (document.getElementById(name)) {
            return el
        }

        const script = document.createElement('script')
        script.onload = () => {
            callback && callback()
        }
        script.id = name
        script.src = src
        el = script
        document.head.insertBefore(script, document.head.firstChild)
    }
}

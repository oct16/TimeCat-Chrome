import {
    dispatchEvent,
    sendMessageToBackgroundScript,
    storeKeys,
    getOptions,
    getRecordOptions,
    getExportOptions
} from './common'

const isDev = process.env.NODE_ENV === 'development'
const timeCatScript = isDev ? 'http://localhost:4321/timecatjs.min.js' : chrome.runtime.getURL('timecatjs.min.js')

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
            const options = await getExportOptions()
            dispatchEvent('CHROME_RECORD_FINISH', {
                scripts: [
                    {
                        name: 'time-cat',
                        src: timeCatScript
                    }
                ],
                ...options
            })
            break
        }
        case 'TAB_CHANGE': {
            dispatchEvent('CHROME_TAB_CHANGE')
            break
        }
    }
    return true
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
        document.body.appendChild(script)
    }
}

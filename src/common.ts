export const recordKeys = ['audio']
export const exportKeys = ['autoplay', 'audioExternal']
export const storeKeys = [...recordKeys, ...exportKeys]

// for background to content
export function sendMessageToContentScript(request: any, callback?: Function) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        chrome.tabs.sendMessage(tabs[0].id!, request, response => {
            if (callback) {
                callback(response)
            }
        })
    })
}

// for content tp background
export function sendMessageToBackgroundScript(request: any, callback?: Function) {
    chrome.runtime.sendMessage(request, callback)
}

// for page and content
export function dispatchEvent(type: string, data: any = null) {
    event = new CustomEvent(type, { detail: data })
    window.dispatchEvent(event)
}

export function setOption(key: string, val: boolean) {
    chrome.storage.sync.set({ [key]: val }, () => {})
}

export function getOptions(keys: string[], callback: (options: { [key: string]: boolean }) => void) {
    chrome.storage.sync.get(keys, options => {
        callback({ ...keys.reduce((a, b) => ({ ...a, [b]: null }), {}), ...options })
    })
}

export async function getRecordOptions() {
    return new Promise(r => {
        getOptions(storeKeys, options => {
            r(pickup(options, recordKeys))
        })
    })
}

export async function getExportOptions(): Promise<{
    [key: string]: any
}> {
    return new Promise(r => {
        getOptions(storeKeys, options => {
            r(pickup(options, exportKeys))
        })
    })
}

function pickup(obj: { [key: string]: any }, list: string[]) {
    return Object.entries(obj).reduce((out, [key, val]) => {
        if (~list.indexOf(key)) {
            out[key] = val
        }
        return out
    }, {} as { [key: string]: any })
}

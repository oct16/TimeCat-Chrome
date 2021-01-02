export const isDev = process.env.NODE_ENV === 'development'
export const timeCatScript = isDev
    ? 'http://localhost:4321/timecat.global.js'
    : chrome.runtime.getURL('timecat.global.prod.js')

const recordOptions = {
    audio: false,
    font: false
}
const exportOptions = {
    autoplay: true,
    audioExternal: false
}

const defaultOptions = { ...recordOptions, ...exportOptions }

export const storeKeys = [
    ...Object.keys(recordOptions),
    ...Object.keys(exportOptions)
] as (keyof typeof defaultOptions)[]

// for background to content
export function sendMessageToContentScript(request: any, callback?: Function) {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tabId = tabs[0].id!
        chrome.tabs.sendMessage(tabId, request, response => {
            if (callback) {
                callback(response)
            }
        })
    })
}

// for content to background
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

export function getOptions(keys: (keyof typeof defaultOptions)[], callback: (options: typeof defaultOptions) => void) {
    chrome.storage.sync.get(keys, (options: Partial<typeof defaultOptions>) => {
        const opts = keys.reduce((a, b) => ({ ...a, [b]: defaultOptions[b] }), {}) as typeof defaultOptions

        Object.keys(options).forEach((key: keyof typeof defaultOptions) => {
            opts[key] = options[key] as boolean
        })

        callback(opts as typeof defaultOptions)
    })
}

export async function getRecordOptions(): Promise<{ [key: string]: any }> {
    return new Promise(r => {
        getOptions(storeKeys, options => {
            r(pickup(options, Object.keys(recordOptions)))
        })
    })
}

export async function getExportOptions(): Promise<{
    [key: string]: any
}> {
    return new Promise(r => {
        getOptions(storeKeys, options => {
            r(pickup(options, Object.keys(exportOptions)))
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

export function collectDataOverTime<T>(cb: (result: T[]) => void, time = 1000) {
    const result = [] as T[]
    let timer: number
    return (data: T, isFinal: boolean) => {
        result.push(data)

        if (!isFinal) {
            return
        }
        if (!timer) {
            timer = window.setTimeout(handle, time)
        }

        function handle() {
            cb(result.slice())
            result.length = 0
            timer = 0
            return
        }
    }
}

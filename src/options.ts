import { getOptions, setOption, storeKeys } from './common'

declare const options: HTMLFormElement

window.addEventListener('load', function() {
    // Initialize the option controls.
    function initOptions() {
        getOptions(storeKeys, opts => {
            Object.keys(opts).forEach((key: keyof typeof opts) => {
                options[key].checked = opts[key]
                options[key].onchange = () => setOption(key, options[key].checked)
            })
        })
    }

    initOptions()

    document.querySelector('#reset')!.addEventListener('click', () => {
        chrome.storage.sync.clear()
        initOptions()
    })
})

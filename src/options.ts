import { getOptions, setOption, storeKeys } from './common'

declare const options: HTMLFormElement

window.addEventListener('load', function() {
    // Initialize the option controls.
    function initOptions() {
        storeKeys.forEach(key => {
            getOptions([key], items => {
                if (items[key] === null) {
                    setOption(key, options[key].checked)
                    return
                }
                options[key].checked = items[key]
            })
            options[key].onchange = () => setOption(key, options[key].checked)
        })
    }

    initOptions()

    document.querySelector('#reset')!.addEventListener('click', () => {
        chrome.storage.sync.clear()
        initOptions()
    })
})

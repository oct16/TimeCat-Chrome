import { dispatchEvent } from './common'
import io from 'socket.io-client'

let ctrl: {
    unsubscribe: () => void
} | null

function record(e: CustomEvent) {
    const options = e.detail as { [key: string]: boolean }

    const cat = (window as any).timecat
    const { record } = cat

    if (process.env.LIVE_MODE) {
        const socket = io('http://localhost:9528')
        ctrl = record({
            emitter: (data: any) => {
                socket.emit('record-msg', data)
            }
        })
        return
    }

    ctrl = record(options)
}

function finish(e: CustomEvent) {
    const cat = (window as any).timecat
    if (ctrl) {
        const options = e.detail
        cat.exportReplay(options)
        ctrl.unsubscribe()
    }
}

function setWarn(handle?: () => void) {
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState == 'hidden') {
            if (ctrl) {
                ctrl.unsubscribe()
                ctrl = null
            }
            dispatchEvent('CHROME_RECORD_CANCEL')
        }
    })
}

window.addEventListener('CHROME_RECORD_START', record, false)
window.addEventListener('CHROME_RECORD_FINISH', finish, false)

setWarn()

import { dispatchEvent } from './common'
import io from 'socket.io-client'

let recorder: any | undefined

function record(e: CustomEvent) {
    const options = e.detail as { [key: string]: boolean }
    const { Recorder } = window.TimeCat

    if (process.env.LIVE_MODE) {
        const socket = io('http://localhost:9528')
        recorder = new Recorder({
            onData: (data: any) => {
                socket.emit('record-msg', data)
            }
        })
        return
    }

    recorder = new Recorder(options)
}

function finish(e: CustomEvent) {
    if (recorder) {
        const options = e.detail
        const { exportReplay } = window.TimeCat
        exportReplay(options)
        recorder.destroy()
    }
}

function setWarn() {
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState == 'hidden') {
            if (recorder) {
                recorder.destroy()
            }
            dispatchEvent('CHROME_RECORD_CANCEL')
        }
    })
}

window.addEventListener('CHROME_RECORD_START', record, false)
window.addEventListener('CHROME_RECORD_FINISH', finish, false)

setWarn()

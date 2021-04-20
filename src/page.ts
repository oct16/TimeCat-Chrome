// import io from 'socket.io-client'
import { Recorder, RecordOptions, RecordData } from 'timecatjs'
import { dispatchEvent } from './common'

let recorder: Recorder

const records = [] as RecordData[]

function record(e: CustomEvent) {
    const options = JSON.parse(e.detail) as { [key: string]: boolean }
    const { Recorder } = window.TimeCat

    if (recorder) {
        recorder.destroy()
    }

    // if (process.env.LIVE_MODE) {
    //     const socket = io('http://localhost:9528')
    //     recorder = new Recorder()

    //     recorder.onData(record => {
    //         socket.emit('record-msg', record)
    //     })
    //     return
    // }

    const rewriteResource: RecordOptions['rewriteResource'] = [
        {
            matches: ['css'],
            type: 'preFetch',
            rewrite: {
                matches: ['ttf', 'woff', 'woff2', 'otf']
            }
        }
    ]

    recorder = new Recorder({ ...options, write: false, visibleChange: false, rewriteResource })
    recorder.onData(async (record: RecordData, next) => {
        records.push(record)
        next()
    })
}

function finish(e: CustomEvent) {
    const { options, records } = e.detail
    const { exportReplay } = window.TimeCat
    exportReplay({ ...options, records })
}

async function collect(isFinal = true) {
    if (records && records.length) {
        await recorder.destroy()
        dispatchEvent('RECORD_COLLECT_TO_CONTENT', { isFinal, records })
        records.length = 0
    }
}

window.addEventListener('CHROME_RECORD_START', record, false)
window.addEventListener('CHROME_RECORD_FINISH', finish, false)
window.addEventListener('CHROME_RECORD_COLLECT', () => collect(), false)
window.addEventListener('beforeunload', () => collect(false), false)

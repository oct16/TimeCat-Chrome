const fs = require('fs')
const execa = require('execa')
const chalk = require('chalk')

var args = process.argv.splice(2)
const envDev = args.includes('dev')
const envLive = args.includes('live')

const env = envDev ? 'development' : 'production'
const live = envLive ? 'live' : ''

const target = 'timecatjs.min.js'
const assetsDir = 'src/assets/'
const isExist = fs.existsSync(assetsDir + target)

if (!isExist && !envDev && !envLive) {
    const errorMsg = chalk.yellow(target) + chalk.red(' not found, please put ' + target + ' in the path: ' + assetsDir)
    console.error(errorMsg)
    process.exit(0)
}

;(async () => {
    await execa(
        'rollup',
        [
            '-c',
            'builders/rollup.config.chrome.js',
            envDev ? '-w' : '',
            '--environment',
            [`NODE_ENV:${env}`, `LIVE_MODE:${live}`].filter(Boolean).join(',')
        ].filter(Boolean),
        {
            stdio: 'inherit'
        }
    )

    await execa('zip', ['-r', '-j', 'TimeCat', './chrome/'], {
        cwd: 'dist'
    })

    await execa('echo', ['Pack is in /dist'], {
        stdio: 'inherit'
    })
})()

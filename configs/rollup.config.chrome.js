import ts from 'rollup-plugin-typescript2'
import copy from 'rollup-plugin-copy'
import replace from '@rollup/plugin-replace'
import node from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'
import fs from 'fs'
import html from '@rollup/plugin-html'

const isDev = process.env.NODE_ENV === 'development'
const dest = isDev ? 'dist/chrome/' : 'dist/chrome/'

const defaultPlugin = [
    ts({
        tsconfigOverride: { compilerOptions: { declaration: false } }
    }),
    node({
        browser: true
    }),
    commonjs(),
    replace({
        preventAssignment: true,
        values: {
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            'process.env.LIVE_MODE': JSON.stringify(process.env.LIVE_MODE)
        }
    }),
    isDev ? null : terser()
]

const copyTargets = [
    { src: 'src/assets/*', dest },
    !isDev ? { src: 'dist/timecat.global.prod.js', dest } : null
].filter(Boolean)

export default [
    {
        input: 'src/options.ts',
        output: {
            format: 'iife',
            name: 'options',
            file: dest + 'timecat-chrome-options.js'
        },
        plugins: [
            ...defaultPlugin,
            html({
                template: () => fs.readFileSync('src/assets/options.html', 'utf8')
            })
        ]
    },
    {
        input: 'src/background.ts',
        output: {
            format: 'iife',
            name: 'background',
            file: dest + 'timecat-chrome-background.js'
        },
        plugins: [...defaultPlugin]
    },
    {
        input: 'src/page.ts',
        output: {
            format: 'iife',
            name: 'page',
            file: dest + 'timecat-chrome-page.js'
        },
        plugins: [...defaultPlugin]
    },
    {
        input: 'src/content.ts',
        output: {
            format: 'iife',
            name: 'content',
            file: dest + 'timecat-chrome-content.js'
        },
        plugins: [
            ...defaultPlugin,
            copy({
                targets: copyTargets
            })
        ]
    }
]

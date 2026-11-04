#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const path = require('node:path')
const {spawn} = require('node:child_process')
const {randomUUID} = require('node:crypto')
const ncc = require('./src/index.js')

async function main() {
    const result = await ncc(require.resolve('source-map-support/register'), {
        filename: 'sourcemap-register.js',
        cache: false,
        quiet: true,
        minify: true,
        sourceMap: false,
        sourceMapRegister: false,
        license: 'licenses.txt'
    })
    const licenses = String(result.assets['licenses.txt'].source)
    if (licenses.includes('*/')) {
        throw new Error('Invalid helper license text')
    }

    const helper = path.join(__dirname, 'src/sourcemap-register.js.cache.js')
    const temporary = `${helper}.${process.pid}.${randomUUID()}.tmp`
    fs.writeFileSync(temporary, `/*!\n${licenses}\n*/\n${result.code}`, {flag: 'wx', mode: 0o600})
    fs.renameSync(temporary, helper)

    const child = spawn(process.execPath, [path.join(__dirname, 'src/cli.js'), ...process.argv.slice(2)], {stdio: 'inherit'})
    process.exitCode = await new Promise((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', code => resolve(code === null ? 1 : code))
    })
}

main().catch(error => {
    console.error(error)
    process.exitCode = 1
})

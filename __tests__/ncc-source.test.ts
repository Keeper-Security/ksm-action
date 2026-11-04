import {afterAll, beforeAll, describe, expect, test} from '@jest/globals'
import {execFileSync, spawnSync} from 'child_process'
import {createHash, randomUUID} from 'crypto'
import fs from 'fs'
import {createRequire} from 'module'
import os from 'os'
import path from 'path'

const nodeRequire = createRequire(__filename)
const sourceRoot = path.resolve(__dirname, '../tools/ncc-source')
const environment = {...process.env, NODE_OPTIONS: ''}
const timeout = 60000

type Upstream = {
    name: string
    version: string
    commit: string
    license: string
    files: {path: string; sha256: string}[]
}

type CompileResult = {
    code: string
    map: string
    assets: Record<string, {source: string}>
}

type Compiler = (entry: string, options: {cache: false; quiet: true; sourceMap: true; sourceMapRegister: false}) => Promise<CompileResult>

function write(file: string, value: string | Buffer): void {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, value)
}

function run(file: string, args: string[], cwd: string): string {
    return execFileSync(process.execPath, [file, ...args], {cwd, env: environment, encoding: 'utf8', timeout})
}

describe('Local ncc source build', () => {
    let directory: string
    let marker: string
    let owner: string
    let toolRoot: string
    let cli: string

    beforeAll(() => {
        directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ksm-ncc-source-'))
        marker = path.join(directory, '.test-owner')
        owner = randomUUID()
        fs.writeFileSync(marker, owner, {mode: 0o600})
        toolRoot = path.dirname(nodeRequire.resolve('@keeper-security/ncc-source/package.json'))
        cli = path.join(toolRoot, 'cli.cjs')
    })

    afterAll(() => {
        if (directory) {
            if (fs.readFileSync(marker, 'utf8') !== owner) {
                throw new Error('Test directory ownership could not be verified')
            }
            fs.rmSync(directory, {recursive: true, force: true})
        }
    })

    test('retains the exact upstream source and license', () => {
        expect(fs.lstatSync(path.resolve(__dirname, '../node_modules/@keeper-security/ncc-source')).isSymbolicLink()).toBe(false)
        expect(toolRoot).not.toBe(sourceRoot)
        const upstream = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'UPSTREAM.json'), 'utf8')) as Upstream
        expect(upstream.name).toBe('@vercel/ncc')
        expect(upstream.version).toBe('0.45.0')
        expect(upstream.commit).toBe('cb1f1f058bfa7de4cb63f2411e14a724e714e260')
        expect(upstream.license).toBe('MIT')
        expect(fs.readFileSync(path.join(toolRoot, 'UPSTREAM.json'), 'utf8')).toBe(fs.readFileSync(path.join(sourceRoot, 'UPSTREAM.json'), 'utf8'))
        for (const root of [sourceRoot, toolRoot]) {
            for (const file of upstream.files) {
                const bytes = fs.readFileSync(path.join(root, file.path))
                expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
            }
            expect(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')).toContain('Copyright 2018 ZEIT, Inc.')
        }
    })

    test(
        'builds a CommonJS module with assets, source maps, and license notices',
        () => {
            const fixture = path.join(directory, 'commonjs')
            write(path.join(fixture, 'package.json'), JSON.stringify({name: 'fixture-root', version: '1.0.0', private: true}))
            write(
                path.join(fixture, 'node_modules/fixture-dependency/package.json'),
                JSON.stringify({name: 'fixture-dependency', version: '1.0.0', main: 'index.js', license: 'MIT'})
            )
            write(path.join(fixture, 'node_modules/fixture-dependency/LICENSE'), fs.readFileSync(path.join(sourceRoot, 'LICENSE')))
            write(path.join(fixture, 'node_modules/fixture-dependency/index.js'), 'module.exports="dependency-value";\n')
            write(path.join(fixture, 'asset.txt'), 'asset-value')
            write(
                path.join(fixture, 'index.js'),
                'const fs=require("node:fs");const path=require("node:path");const value=require("fixture-dependency");console.log(value+":"+fs.readFileSync(path.join(__dirname,"asset.txt"),"utf8"));\n'
            )
            const output = path.join(fixture, 'dist')
            run(cli, ['build', path.join(fixture, 'index.js'), '--out', output, '--source-map', '--license', 'licenses.txt', '--no-cache'], fixture)
            expect(run(path.join(output, 'index.js'), [], fixture).trim()).toBe('dependency-value:asset-value')
            expect(fs.readFileSync(path.join(output, 'asset.txt'), 'utf8')).toBe('asset-value')
            expect(fs.readFileSync(path.join(output, 'licenses.txt'), 'utf8')).toContain('fixture-dependency')
            const sourceMap = JSON.parse(fs.readFileSync(path.join(output, 'index.js.map'), 'utf8')) as {sources: string[]}
            expect(sourceMap.sources.some(source => source.endsWith('/index.js'))).toBe(true)
            const helper = fs.readFileSync(path.join(output, 'sourcemap-register.js'), 'utf8')
            for (const notice of ['buffer-from', 'source-map', 'source-map-support', 'Mozilla Foundation', 'Linus Unnebäck', 'Evan Wallace']) {
                expect(helper).toContain(notice)
            }
            expect(helper).not.toContain('//# sourceMappingURL=sourcemap-register.js.map')
        },
        timeout
    )

    test(
        'builds TypeScript and maps the error to the source file',
        () => {
            const fixture = path.join(directory, 'typescript')
            write(path.join(fixture, 'package.json'), JSON.stringify({name: 'fixture-typescript', version: '1.0.0', private: true}))
            write(
                path.join(fixture, 'tsconfig.json'),
                JSON.stringify({
                    compilerOptions: {target: 'ES2022', module: 'CommonJS', strict: true, skipLibCheck: true, sourceMap: true},
                    include: ['index.ts']
                })
            )
            write(
                path.join(fixture, 'index.ts'),
                'const value: string = "ts-value";\nconsole.log(value);\ntry { throw new Error("mapped-error"); } catch(error) { console.log((error as Error).stack); }\n'
            )
            const output = path.join(fixture, 'dist')
            run(cli, ['build', path.join(fixture, 'index.ts'), '--out', output, '--source-map', '--no-cache'], fixture)
            const result = run(path.join(output, 'index.js'), [], fixture)
            expect(result).toContain('ts-value')
            expect(result).toMatch(/index\.ts:3/)
        },
        timeout
    )

    test(
        'builds an ES module with a CommonJS source-map helper',
        () => {
            const fixture = path.join(directory, 'esm')
            write(path.join(fixture, 'package.json'), JSON.stringify({name: 'fixture-esm', version: '1.0.0', private: true, type: 'module'}))
            write(path.join(fixture, 'index.mjs'), 'export const value="esm-value";console.log(value);\n')
            const output = path.join(fixture, 'dist')
            run(cli, ['build', path.join(fixture, 'index.mjs'), '--out', output, '--source-map', '--no-cache'], fixture)
            expect(run(path.join(output, 'index.mjs'), [], fixture).trim()).toBe('esm-value')
            expect(fs.existsSync(path.join(output, 'sourcemap-register.cjs'))).toBe(true)
        },
        timeout
    )

    test(
        'keeps the CLI version and help commands',
        () => {
            expect(run(cli, ['version'], directory).trim()).toBe('1.0.0')
            const result = spawnSync(process.execPath, [cli, 'help'], {cwd: directory, env: environment, encoding: 'utf8', timeout})
            expect(result.status).toBe(2)
            expect(result.stderr).toContain('Usage: ncc')
        },
        timeout
    )

    test(
        'can generate a source map without a runtime helper',
        async () => {
            const fixture = path.join(directory, 'api')
            write(path.join(fixture, 'package.json'), JSON.stringify({name: 'fixture-api', version: '1.0.0', private: true}))
            write(path.join(fixture, 'index.js'), 'console.log("api-value");\n')
            const compile = nodeRequire(toolRoot) as Compiler
            const result = await compile(path.join(fixture, 'index.js'), {cache: false, quiet: true, sourceMap: true, sourceMapRegister: false})
            expect(result.map).toBeTruthy()
            expect(result.assets).not.toHaveProperty('sourcemap-register.js')
        },
        timeout
    )
})

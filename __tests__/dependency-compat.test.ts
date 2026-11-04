import {afterEach, beforeEach, describe, expect, test} from '@jest/globals'
import {execFileSync} from 'child_process'
import {Dirent, PathLike, mkdirSync, mkdtempSync, readFileSync, readdir, rmSync, writeFileSync} from 'fs'
import {createRequire} from 'module'
import {tmpdir} from 'os'
import * as path from 'path'

type MatchResult = RegExpMatchArray | null
type PatternMatcher = {test: (value: string) => boolean; exec: (value: string) => MatchResult; [Symbol.match]: (value: string) => MatchResult}
type PatternPart = string | symbol | {_glob: string; pattern: string; test: (value: string) => boolean; [Symbol.match]: (value: string) => MatchResult}
type MatchOptions = {dot?: boolean; nocase?: boolean; nonull?: boolean; matchBase?: boolean; nocomment?: boolean}
type Matcher = {
    set: PatternPart[][]
    match: (value: string) => boolean
    parse: (pattern: string) => PatternPart
    makeRe: () => PatternMatcher | false
}
type MatchConstructor = {
    new (pattern: string, options?: MatchOptions): Matcher
    defaults: (options: MatchOptions) => MatchConstructor
}
type MinimatchApi = {
    (value: string, pattern: string, options?: MatchOptions): boolean
    minimatch: MinimatchApi
    Minimatch: MatchConstructor
    GLOBSTAR: symbol
    defaults: (options?: MatchOptions) => MinimatchApi
    filter: (pattern: string, options?: MatchOptions) => (value: string) => boolean
    match: (values: string[], pattern: string, options?: MatchOptions) => string[]
    braceExpand: (pattern: string, options?: MatchOptions) => string[]
    makeRe: (pattern: string, options?: MatchOptions) => PatternMatcher | false
}
type MergeApi = {
    (target: unknown, source: unknown, options?: unknown): Record<PropertyKey, unknown>
    all: (values: unknown, options?: unknown) => Record<PropertyKey, unknown>
}
type ReadDirectory = (directory: PathLike, options: {withFileTypes: true}, callback: (error: NodeJS.ErrnoException | null, entries: Dirent[]) => void) => void

const minimatch = require('minimatch') as MinimatchApi
const deepmerge = require('deepmerge') as MergeApi
const requireFromMinimatch = createRequire(require.resolve('minimatch'))
const modernMinimatch = requireFromMinimatch('minimatch-modern') as MinimatchApi
const requireFromFlatCache = createRequire(require.resolve('flat-cache'))
const requireFromLegacyRimraf = createRequire(requireFromFlatCache.resolve('rimraf'))
const requireFromJestConfig = createRequire(require.resolve('jest-config'))
const legacyGlob = requireFromLegacyRimraf('glob') as {
    (pattern: string, options: {cwd: string; nodir: boolean; dot?: boolean; nonull?: boolean}, callback: (error: Error | null, files: string[]) => void): void
    sync: (pattern: string, options: {cwd: string; nodir: boolean; dot?: boolean; nonull?: boolean}) => string[]
}
const modernGlob = requireFromJestConfig('glob') as {
    glob: (pattern: string, options: {cwd: string; nodir?: boolean; signal?: AbortSignal; fs?: {readdir: ReadDirectory}}) => Promise<string[]>
    globSync: (pattern: string, options: {cwd: string; nodir: boolean; ignore?: string[]}) => string[]
    hasMagic: (pattern: string, options?: {magicalBraces?: boolean}) => boolean
}
const rawGlob = requireFromJestConfig('glob/raw') as typeof modernGlob
const jestConfig = require('jest-config') as {
    mergeConfig: (defaults: Record<string, unknown>, overrides: Record<string, unknown>) => Record<string, unknown>
    readConfig: (argv: Record<string, unknown>, configPath: string) => Promise<{projectConfig: {globals: Record<string, unknown>}}>
}
const unsafeKeys = ['__proto__', 'constructor', 'prototype']

function unsafeObject(safe: Record<PropertyKey, unknown> = {}): Record<PropertyKey, unknown> {
    return Object.assign(Object.fromEntries(unsafeKeys.map(key => [key, {dependencyCompatUnexpected: true}])), safe)
}

function expectSafeKeys(value: unknown): void {
    if (value === null || typeof value !== 'object') {
        return
    }
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key === 'string') {
            expect(unsafeKeys).not.toContain(key)
        }
        expectSafeKeys((value as Record<PropertyKey, unknown>)[key])
    }
}

describe('Dependency compatibility', () => {
    let directory = ''

    beforeEach(() => {
        directory = mkdtempSync(path.join(tmpdir(), 'ksm-action-dependency-compat-'))
    })

    afterEach(() => {
        rmSync(directory, {recursive: true, force: true})
        directory = ''
    })

    test('uses the actual upstream package names and versions', () => {
        const requireFromDeepmerge = createRequire(require.resolve('deepmerge'))

        expect(require('minimatch/package.json')).toMatchObject({name: '@keeper-security/minimatch-compat', version: '1.0.0', license: 'MIT'})
        expect(requireFromMinimatch('minimatch-modern/package.json')).toMatchObject({name: 'minimatch', version: '11.0.4'})
        expect(require('deepmerge/package.json')).toMatchObject({name: '@keeper-security/deepmerge-compat', version: '1.0.0', license: 'MIT'})
        expect(requireFromDeepmerge('@fastify/deepmerge/package.json')).toMatchObject({name: '@fastify/deepmerge', version: '3.2.4'})
        expect(requireFromJestConfig('glob/package.json')).toMatchObject({name: 'glob', version: '14.0.3'})
        expect(requireFromLegacyRimraf('glob/package.json')).toMatchObject({name: 'glob', version: '7.2.3'})
    })

    test('keeps the callable minimatch interface and modern named exports', () => {
        expect(typeof minimatch).toBe('function')
        expect(minimatch.minimatch).toBe(minimatch)
        expect(minimatch('folder/file.ts', '**/*.ts')).toBe(true)
        expect(minimatch('folder/file.js', '**/*.ts')).toBe(false)
        expect(minimatch.filter('*.ts')('file.ts')).toBe(true)
        expect(minimatch.match(['file.ts', 'file.js'], '*.ts')).toEqual(['file.ts'])
        expect(minimatch.braceExpand('file.{ts,js}')).toEqual(['file.ts', 'file.js'])
        expect(minimatch.GLOBSTAR).toBe(modernMinimatch.GLOBSTAR)
        expect(new minimatch.Minimatch('**/*.ts')).toBeInstanceOf(modernMinimatch.Minimatch)
    })

    test('keeps callable defaults and constructor defaults', () => {
        const defaults = minimatch.defaults({dot: true, nocase: true})
        const sensitiveDefaults = defaults.defaults({nocase: false})
        const DefaultMatcher = defaults.Minimatch.defaults({nocase: false})
        const BaseDefaultMatcher = minimatch.Minimatch.defaults({dot: true})

        expect(minimatch.defaults()).toBe(minimatch)
        expect(minimatch.defaults({})).toBe(minimatch)
        expect(typeof defaults).toBe('function')
        expect(defaults.minimatch).toBe(defaults)
        expect(defaults('.FILE.TS', '*.ts')).toBe(true)
        expect(defaults('.FILE.TS', '*.ts', {nocase: false})).toBe(false)
        expect(defaults.match(['.FILE.TS', 'file.js'], '*.ts')).toEqual(['.FILE.TS'])
        expect(defaults.filter('*.ts')('.FILE.TS')).toBe(true)
        expect(new defaults.Minimatch('*.ts').match('.FILE.TS')).toBe(true)
        expect(sensitiveDefaults('.FILE.TS', '*.ts')).toBe(false)
        expect(new DefaultMatcher('*.ts').match('.file.ts')).toBe(true)
        expect(new DefaultMatcher('*.ts').match('.FILE.TS')).toBe(false)
        expect(new BaseDefaultMatcher('*.ts').match('.file.ts')).toBe(true)
    })

    test('supports makeRe consumers without creating a RegExp', () => {
        const matcher = minimatch.makeRe('**/*.ts')
        const defaultMatcher = minimatch.defaults({dot: true}).makeRe('*.ts')

        expect(matcher).not.toBeInstanceOf(RegExp)
        expect(matcher).not.toBe(false)
        if (matcher === false || defaultMatcher === false) {
            throw new Error('Expected a pattern matcher')
        }
        expect(matcher.test('folder/file.ts')).toBe(true)
        expect(matcher.test('folder/file.js')).toBe(false)
        expect(matcher.exec('folder/file.ts')).toEqual(Object.assign(['folder/file.ts'], {index: 0, input: 'folder/file.ts'}))
        expect(matcher.exec('folder/file.js')).toBeNull()
        expect('folder/file.ts'.match(matcher)).toEqual(Object.assign(['folder/file.ts'], {index: 0, input: 'folder/file.ts'}))
        expect(defaultMatcher.test('.file.ts')).toBe(true)
        expect(new minimatch.Minimatch('*.ts').makeRe()).not.toBeInstanceOf(RegExp)
        expect(minimatch.makeRe('#comment')).toBe(false)
    })

    test('rejects unsupported makeRe RegExp operations', () => {
        const matcher = minimatch.makeRe('*.ts')
        if (matcher === false) {
            throw new Error('Expected a pattern matcher')
        }
        const error = 'makeRe() supports only test(), exec(), and Symbol.match'

        expect(() => Reflect.get(matcher, 'source')).toThrow(error)
        expect(() => Reflect.get(matcher, 'flags')).toThrow(error)
        expect(() => String(matcher)).toThrow(error)
        expect(() => new RegExp(matcher as unknown as RegExp)).toThrow(error)
        for (const operation of [Symbol.replace, Symbol.search, Symbol.split, Symbol.matchAll]) {
            expect(() => Reflect.get(matcher, operation)).toThrow(error)
        }
    })

    test('supports the ESLint import rule that calls makeRe', () => {
        const {Linter} = require('eslint')
        const importPlugin = require('eslint-plugin-import')
        const linter = new Linter()
        linter.defineRule('import/no-internal-modules', importPlugin.rules['no-internal-modules'])
        const config = {
            parserOptions: {ecmaVersion: 2022, sourceType: 'module'},
            rules: {'import/no-internal-modules': ['error', {forbid: ['nested/*']}]}
        }
        const messages = linter.verify('import value from "./nested/file.js"', config, path.join(directory, 'entry.js'))

        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({ruleId: 'import/no-internal-modules', severity: 2})
        expect(linter.verify('import value from "./other/file.js"', config, path.join(directory, 'entry.js'))).toEqual([])
    })

    test('keeps the legacy segment interface and modern matcher identity', () => {
        const matcher = new minimatch.Minimatch('folder/**/*.ts')
        const part = matcher.set[0][2]
        const modernPart = new modernMinimatch.Minimatch('*.ts').set[0][0]

        expect(matcher.set[0][0]).toBe('folder')
        expect(matcher.set[0][1]).toBe(minimatch.GLOBSTAR)
        expect(typeof part).toBe('object')
        expect(Object.getPrototypeOf(part)).toBe(Object.getPrototypeOf(modernPart))
        if (typeof part !== 'object') {
            throw new Error('Expected a pattern segment')
        }
        expect(part._glob).toBe('*.ts')
        expect(part.test('file.ts')).toBe(true)
        expect('file.ts'.match(part)).not.toBeNull()
        expect('file.js'.match(part)).toBeNull()
        expect('file.ts'.match(matcher.parse('*.ts') as Exclude<PatternPart, string | symbol>)).not.toBeNull()
        expect(matcher.match('folder/nested/file.ts')).toBe(true)
    })

    test('exports the same callable and constructor interfaces to ESM', () => {
        writeFileSync(path.join(directory, 'file.ts'), '')
        const output = execFileSync(
            process.execPath,
            [
                '--input-type=module',
                '-e',
                [
                    "import minimatch, {minimatch as named, Minimatch, GLOBSTAR, defaults, filter, match, braceExpand, makeRe, escape, unescape, sep} from 'minimatch'",
                    "import {createRequire} from 'node:module'",
                    "import {globSync, hasMagic} from 'glob/raw'",
                    'const common = createRequire(import.meta.url)("minimatch")',
                    'const matcher = new Minimatch("**/*.ts")',
                    'process.stdout.write(JSON.stringify({',
                    'callable: typeof minimatch === "function" && minimatch("folder/file.ts", "**/*.ts"),',
                    'named: minimatch === named && named === common,',
                    'constructor: Minimatch === common.Minimatch && matcher.match("folder/file.ts"),',
                    'globstar: GLOBSTAR === common.GLOBSTAR,',
                    'defaults: defaults({dot: true})(".file.ts", "*.ts"),',
                    'filter: filter("*.ts")("file.ts"),',
                    'match: match(["file.ts", "file.js"], "*.ts"),',
                    'braces: braceExpand("file.{ts,js}"),',
                    'makeRe: makeRe("**/*.ts").test("folder/file.ts"),',
                    'escape: unescape(escape("file[1].ts")),',
                    `globFiles: globSync("*.ts", {cwd: ${JSON.stringify(directory)}, nodir: true}),`,
                    'globMagic: hasMagic("*.ts"),',
                    'sep: typeof sep',
                    '}))'
                ].join('\n')
            ],
            {cwd: path.dirname(require.resolve('jest-config/package.json')), encoding: 'utf8'}
        )

        expect(JSON.parse(output)).toEqual({
            callable: true,
            named: true,
            constructor: true,
            globstar: true,
            defaults: true,
            filter: true,
            match: ['file.ts'],
            braces: ['file.ts', 'file.js'],
            makeRe: true,
            escape: 'file[1].ts',
            globFiles: ['file.ts'],
            globMagic: true,
            sep: 'string'
        })
    })

    test('supports real legacy glob sync and callback scans', async () => {
        mkdirSync(path.join(directory, 'nested'))
        writeFileSync(path.join(directory, 'root.ts'), '')
        writeFileSync(path.join(directory, '.hidden.ts'), '')
        writeFileSync(path.join(directory, 'nested', 'child.ts'), '')
        writeFileSync(path.join(directory, 'nested', 'ignore.js'), '')
        const expected = ['nested/child.ts', 'root.ts']
        const expectedModern = expected.map(file => path.normalize(file))

        expect(legacyGlob.sync('**/*.ts', {cwd: directory, nodir: true}).sort()).toEqual(expected)
        expect(legacyGlob.sync('**/*.{ts,js}', {cwd: directory, nodir: true}).sort()).toEqual(['nested/child.ts', 'nested/ignore.js', 'root.ts'])
        expect(legacyGlob.sync('missing/*.{ts,js}', {cwd: directory, nodir: true, nonull: true}).sort()).toEqual(['missing/*.js', 'missing/*.ts'])
        expect(legacyGlob.sync('**/*.ts', {cwd: directory, nodir: true, dot: true}).sort()).toEqual(['.hidden.ts', ...expected])
        const files = await new Promise<string[]>((resolve, reject) => {
            legacyGlob('**/*.ts', {cwd: directory, nodir: true}, (error, matches) => (error ? reject(error) : resolve(matches)))
        })
        expect(files.sort()).toEqual(expected)
        expect(modernGlob.globSync('**/*.ts', {cwd: directory, nodir: true}).sort()).toEqual(expectedModern)
        expect(rawGlob.globSync('**/*.ts', {cwd: directory, nodir: true}).sort()).toEqual(expectedModern)
        expect(rawGlob.globSync('**/*.ts', {cwd: directory, nodir: true, ignore: ['nested/**']})).toEqual(['root.ts'])
        expect(rawGlob.hasMagic('*.ts')).toBe(true)
        expect(rawGlob.hasMagic('file.ts')).toBe(false)
        expect(rawGlob.hasMagic('file.{ts,js}')).toBe(false)
        expect(rawGlob.hasMagic('file.{ts,js}', {magicalBraces: true})).toBe(true)
    })

    test.each(['glob', 'glob/raw'])('stops an in-flight %s scan with the supplied abort reason', async packageName => {
        const scanner = requireFromJestConfig(packageName) as typeof modernGlob
        mkdirSync(path.join(directory, 'child'))
        writeFileSync(path.join(directory, 'child', 'file.txt'), '')
        const reads: string[] = []
        const controller = new AbortController()
        const reason = Object.assign(new Error('Scan stopped'), {name: 'AbortError', code: 'ABORT_ERR'})
        let releaseRead = (): void => {
            throw new Error('The directory read did not start')
        }
        let markReadStarted = (): void => {}
        const readStarted = new Promise<void>(resolve => {
            markReadStarted = resolve
        })
        const delayedReaddir: ReadDirectory = (target, options, callback) => {
            reads.push(String(target))
            readdir(target, options, (error, entries) => {
                if (path.resolve(String(target)) === path.resolve(directory)) {
                    releaseRead = () => callback(error, entries)
                    markReadStarted()
                } else {
                    callback(error, entries)
                }
            })
        }
        const result = scanner.glob('**/*.txt', {cwd: directory, nodir: true, signal: controller.signal, fs: {readdir: delayedReaddir}}).then(
            () => undefined,
            error => error as Error & {code: string}
        )

        await readStarted
        expect(reads.map(value => path.resolve(value))).toEqual([path.resolve(directory)])
        controller.abort(reason)
        releaseRead()

        const error = await result
        expect(error).toBe(reason)
        expect(error).toMatchObject({name: 'AbortError', code: 'ABORT_ERR'})
        expect(reads.map(value => path.resolve(value))).toEqual([path.resolve(directory)])
    })

    test('keeps nested Jest configuration and preset globals', async () => {
        const defaults = {globals: {settings: {enabled: true, values: ['default'], nested: {first: 1}}}, testMatch: ['default.test.ts']}
        const overrides = {globals: {settings: {values: ['override'], nested: {second: 2}}}, testMatch: ['override.test.ts']}
        const merged = jestConfig.mergeConfig(defaults, overrides)

        expect(merged).toEqual({
            globals: {settings: {enabled: true, values: ['default', 'override'], nested: {first: 1, second: 2}}},
            testMatch: ['default.test.ts', 'override.test.ts']
        })
        expect(defaults.globals.settings.values).toEqual(['default'])
        expect(overrides.globals.settings.values).toEqual(['override'])

        writeFileSync(path.join(directory, 'jest-preset.cjs'), 'module.exports = {globals: {settings: {enabled: true, values: ["preset"], nested: {first: 1}}}}')
        writeFileSync(
            path.join(directory, 'jest.config.cjs'),
            'module.exports = {rootDir: __dirname, preset: "./jest-preset.cjs", globals: {settings: {values: ["project"], nested: {second: 2}}}}'
        )
        const config = await jestConfig.readConfig({}, path.join(directory, 'jest.config.cjs'))

        expect(config.projectConfig.globals).toEqual({settings: {enabled: true, values: ['preset', 'project'], nested: {first: 1, second: 2}}})
    })

    test('keeps symbols, Date, RegExp, array concatenation, and input values', () => {
        const symbol = Symbol('setting')
        const hiddenSymbol = Symbol('hidden')
        const date = new Date('2026-11-02T00:00:00.000Z')
        const expression = /file\.ts$/i
        const target = {
            settings: {enabled: true},
            values: [{first: 1}],
            [symbol]: {first: true},
            date: new Date('2025-01-01T00:00:00.000Z'),
            expression: /file\.js$/
        }
        const source = {settings: {count: 2}, values: [{second: 2}], [symbol]: {second: true}, date, expression}
        Object.defineProperty(source, hiddenSymbol, {value: {hidden: true}})
        Object.freeze(target.settings)
        Object.freeze(target.values[0])
        Object.freeze(target.values)
        Object.freeze(target)
        Object.freeze(source.settings)
        Object.freeze(source.values[0])
        Object.freeze(source.values)
        Object.freeze(source)

        const result = deepmerge(target, source)

        expect(result).toEqual({
            settings: {enabled: true, count: 2},
            values: [{first: 1}, {second: 2}],
            [symbol]: {first: true, second: true},
            date,
            expression
        })
        expect(result.date).toBe(date)
        expect(result.expression).toBe(expression)
        expect(result[hiddenSymbol]).toBeUndefined()
        expect(result.settings).not.toBe(target.settings)
        expect(result.settings).not.toBe(source.settings)
        expect(result.values).not.toBe(target.values)
        expect(result.values).not.toBe(source.values)
        expect((result.values as object[])[0]).not.toBe(target.values[0])
        expect((result.values as object[])[1]).not.toBe(source.values[0])
        expect(target.settings).toEqual({enabled: true})
        expect(source.settings).toEqual({count: 2})
        expect(deepmerge.all([])).toEqual({})
        expect(deepmerge.all([target, source])).toEqual(result)
    })

    test('excludes unsafe own keys at every depth and inside symbol values', () => {
        const symbol = Symbol('__proto__')
        const target = unsafeObject({nested: unsafeObject({target: true}), values: [unsafeObject({target: true})], [symbol]: unsafeObject({target: true})})
        const source = unsafeObject({nested: unsafeObject({source: true}), values: [unsafeObject({source: true})], [symbol]: unsafeObject({source: true})})
        const result = deepmerge(target, source)
        const allResult = deepmerge.all([target, source])

        expect(result).toEqual({nested: {target: true, source: true}, values: [{target: true}, {source: true}], [symbol]: {target: true, source: true}})
        expect(allResult).toEqual(result)
        expectSafeKeys(result)
        expectSafeKeys(allResult)
        expect(({} as Record<string, unknown>).dependencyCompatUnexpected).toBeUndefined()
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
        expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype)
        expect(Object.getPrototypeOf(result[symbol])).toBe(Object.prototype)
    })

    test('does not copy inherited keys at any depth', () => {
        const inherited = unsafeObject({inherited: true})
        const nested = Object.assign(Object.create(inherited), {safe: true})
        const source = Object.assign(Object.create(inherited), {nested, values: [nested]})
        const result = deepmerge({}, source)

        expect(result).toEqual({nested: {safe: true}, values: [{safe: true}]})
        expect(result).not.toHaveProperty('inherited')
        expectSafeKeys(result)
        expect(({} as Record<string, unknown>).dependencyCompatUnexpected).toBeUndefined()
    })

    test.each([
        {clone: false},
        {arrayMerge: () => []},
        {customMerge: () => undefined},
        {isMergeableObject: () => true},
        [],
        null,
        false,
        'options',
        Object.create({clone: false}),
        Object.create(null),
        {[Symbol('option')]: true}
    ])('rejects unsupported merge options %#', options => {
        expect(() => deepmerge({first: true}, {second: true}, options)).toThrow('Custom merge options are not supported')
        expect(() => deepmerge.all([{first: true}, {second: true}], options)).toThrow('Custom merge options are not supported')
    })

    test('accepts empty merge options and rejects a non-array all argument', () => {
        expect(deepmerge({first: true}, {second: true}, {})).toEqual({first: true, second: true})
        expect(deepmerge.all([{first: true}, {second: true}], {})).toEqual({first: true, second: true})
        expect(() => deepmerge.all({first: true})).toThrow('The first argument must be an array')
        expect(() => deepmerge.all('values')).toThrow('The first argument must be an array')
    })

    test('keeps development adapters out of the runtime bundle', () => {
        const projectDirectory = path.join(__dirname, '..')
        const sourceMap = JSON.parse(readFileSync(path.join(projectDirectory, 'dist', 'index.js.map'), 'utf8')) as {sources: string[]}
        const adapters = /(?:^|\/)(?:dependency-compat|minimatch|minimatch-modern|deepmerge|@fastify\/deepmerge)(?:\/|$)/

        expect(sourceMap.sources.filter(source => adapters.test(source))).toEqual([])
        const bundle = readFileSync(path.join(projectDirectory, 'dist', 'index.js'), 'utf8')
        expect(bundle).not.toContain('@keeper-security/minimatch-compat')
        expect(bundle).not.toContain('@keeper-security/deepmerge-compat')
        expect(bundle).not.toContain('minimatch-modern')
        expect(bundle).not.toContain('@fastify/deepmerge')
        expect(bundle).not.toContain('Custom merge options are not supported')
    })
})

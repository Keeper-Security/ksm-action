import {afterEach, beforeEach, describe, expect, test} from '@jest/globals'
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'fs'
import {createRequire} from 'module'
import {tmpdir} from 'os'
import * as path from 'path'

const requireFromIstanbul = createRequire(require.resolve('babel-plugin-istanbul'))
const {loadNycConfig} = requireFromIstanbul('@istanbuljs/load-nyc-config') as {
    loadNycConfig: (options: {cwd: string}) => Promise<Record<string, unknown>>
}

test('keeps sprintf-js out of every location in the locked dependency graph', () => {
    const lockfile = JSON.parse(readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8')) as {
        packages: Record<string, unknown>
    }
    const sprintfPackages = Object.keys(lockfile.packages).filter(packagePath => packagePath === 'node_modules/sprintf-js' || packagePath.endsWith('/node_modules/sprintf-js'))

    expect(sprintfPackages).toEqual([])
})

describe('Coverage YAML configuration compatibility', () => {
    let configDirectory = ''

    beforeEach(() => {
        configDirectory = mkdtempSync(path.join(tmpdir(), 'ksm-action-coverage-config-'))
        writeFileSync(path.join(configDirectory, 'package.json'), JSON.stringify({private: true}))
    })

    afterEach(() => {
        if (configDirectory) {
            rmSync(configDirectory, {recursive: true, force: true})
            configDirectory = ''
        }
    })

    test('loads standard YAML options and normalizes scalar paths to arrays', async () => {
        writeFileSync(
            path.join(configDirectory, '.nycrc.yaml'),
            [
                'all: true',
                'check-coverage: true',
                'lines: 85',
                'branches: 80',
                'functions: 90',
                'statements: 85',
                'include: "src/**/*.ts"',
                'exclude: "**/*.test.ts"',
                'extension: ".ts"',
                'require: "source-map-support/register"',
                'reporter:',
                '  - text',
                '  - lcov'
            ].join('\n')
        )

        const config = await loadNycConfig({cwd: configDirectory})

        expect(config).toMatchObject({
            cwd: configDirectory,
            all: true,
            checkCoverage: true,
            lines: 85,
            branches: 80,
            functions: 90,
            statements: 85,
            include: ['src/**/*.ts'],
            exclude: ['**/*.test.ts'],
            extension: ['.ts'],
            require: ['source-map-support/register'],
            reporter: ['text', 'lcov']
        })
    })

    test('extends a relative YAML base configuration without losing inherited options', async () => {
        const baseDirectory = path.join(configDirectory, 'configs')
        mkdirSync(baseDirectory)
        writeFileSync(
            path.join(baseDirectory, 'base.yaml'),
            [
                'all: true',
                'check-coverage: true',
                'lines: 85',
                'exclude:',
                '  - "**/*.test.ts"',
                '  - "generated/**"',
                'extension:',
                '  - ".ts"',
                '  - ".tsx"',
                'reporter:',
                '  - text',
                '  - lcov'
            ].join('\n')
        )
        writeFileSync(path.join(configDirectory, '.nycrc.yaml'), ['extends: "./configs/base.yaml"', 'include: "src/**/*.ts"', 'branches: 80'].join('\n'))

        const config = await loadNycConfig({cwd: configDirectory})

        expect(config).toMatchObject({
            cwd: configDirectory,
            all: true,
            checkCoverage: true,
            lines: 85,
            branches: 80,
            include: ['src/**/*.ts'],
            exclude: ['**/*.test.ts', 'generated/**'],
            extension: ['.ts', '.tsx'],
            reporter: ['text', 'lcov']
        })
        expect(config).not.toHaveProperty('extends')
    })
})

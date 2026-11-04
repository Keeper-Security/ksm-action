'use strict'

const modern = require('minimatch-modern')

function matchResult(value) {
    return Object.assign([value], {index: 0, input: value})
}

function legacyPart(part) {
    if (part && typeof part === 'object' && typeof part.test === 'function' && typeof part.pattern === 'string' && !Object.hasOwn(part, Symbol.match)) {
        // glob 7 needs _glob and String.match() on each pattern segment.
        Object.defineProperties(part, {
            _glob: {value: part.pattern},
            [Symbol.match]: {
                value(value) {
                    const input = String(value)
                    return this.test(input) ? matchResult(input) : null
                }
            }
        })
    }
    return part
}

class Minimatch extends modern.Minimatch {
    parse(pattern) {
        return legacyPart(super.parse(pattern))
    }

    mergeRows() {
        // Legacy glob indexes globSet and set with the same row number.
        if ((this.options.optimizationLevel ?? 1) >= 2) {
            super.mergeRows()
        }
    }

    makeRe() {
        if (this.comment) {
            return false
        }

        // This matcher supports test(), exec(), and Symbol.match.
        // It is not a RegExp and does not supply source or flags.
        const exec = value => {
            const input = String(value)
            return this.match(input) ? matchResult(input) : null
        }
        const matcher = {test: value => exec(value) !== null, exec, [Symbol.match]: exec}
        const unsupported = () => {
            throw new TypeError('makeRe() supports only test(), exec(), and Symbol.match')
        }
        for (const property of ['source', 'flags', Symbol.replace, Symbol.search, Symbol.split, Symbol.matchAll]) {
            Object.defineProperty(matcher, property, {get: unsupported})
        }
        Object.defineProperty(matcher, Symbol.toPrimitive, {value: unsupported})
        Object.defineProperty(matcher, 'toString', {value: unsupported})
        return matcher
    }

    static defaults(options) {
        return defaults(options).Minimatch
    }
}

const minimatch = (value, pattern, options) => modern.minimatch(value, pattern, options)
const makeRe = (pattern, options) => new Minimatch(pattern, options).makeRe()

function defaults(options) {
    if (!options || typeof options !== 'object' || Object.keys(options).length === 0) {
        return minimatch
    }

    const combine = overrides => Object.assign({}, options, overrides)
    const matchWithDefaults = (value, pattern, overrides) => minimatch(value, pattern, combine(overrides))

    class DefaultMinimatch extends Minimatch {
        constructor(pattern, overrides) {
            super(pattern, combine(overrides))
        }

        static defaults(overrides) {
            return defaults(combine(overrides)).Minimatch
        }
    }

    return Object.assign(matchWithDefaults, {
        minimatch: matchWithDefaults,
        Minimatch: DefaultMinimatch,
        GLOBSTAR: modern.GLOBSTAR,
        sep: modern.sep,
        filter: (pattern, overrides) => modern.filter(pattern, combine(overrides)),
        match: (values, pattern, overrides) => modern.match(values, pattern, combine(overrides)),
        braceExpand: (pattern, overrides) => modern.braceExpand(pattern, combine(overrides)),
        escape: (value, overrides) => modern.escape(value, combine(overrides)),
        unescape: (value, overrides) => modern.unescape(value, combine(overrides)),
        makeRe: (pattern, overrides) => makeRe(pattern, combine(overrides)),
        defaults: overrides => defaults(combine(overrides))
    })
}

module.exports = Object.assign(minimatch, modern, {minimatch, Minimatch, makeRe, defaults})

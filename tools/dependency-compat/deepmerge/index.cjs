'use strict'

const createDeepmerge = require('@fastify/deepmerge')
const merge = createDeepmerge({symbols: true})

function checkOptions(options) {
    if (options === undefined) {
        return
    }
    if (options === null || typeof options !== 'object' || Object.getPrototypeOf(options) !== Object.prototype || Reflect.ownKeys(options).length !== 0) {
        throw new TypeError('Custom merge options are not supported')
    }
}

function deepmerge(target, source, options) {
    checkOptions(options)
    return merge(target, source)
}

deepmerge.all = (values, options) => {
    checkOptions(options)
    if (!Array.isArray(values)) {
        throw new TypeError('The first argument must be an array')
    }
    return values.reduce((target, source) => merge(target, source), {})
}

module.exports = deepmerge

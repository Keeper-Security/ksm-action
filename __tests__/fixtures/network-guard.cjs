'use strict'
// Blocks network access in the smoke test child process.
// Each attempt is recorded and then rejected with an error.
const dns = require('dns')
const http = require('http')
const https = require('https')
const net = require('net')
const tls = require('tls')

const attempts = []

function block(name) {
    return function () {
        attempts.push(name)
        throw new Error(`Network access is blocked in this test: ${name}`)
    }
}

net.Socket.prototype.connect = block('net.Socket.connect')
net.connect = block('net.connect')
net.createConnection = block('net.createConnection')
tls.connect = block('tls.connect')
dns.lookup = block('dns.lookup')
dns.promises.lookup = block('dns.promises.lookup')
http.request = block('http.request')
http.get = block('http.get')
https.request = block('https.request')
https.get = block('https.get')
globalThis.fetch = block('fetch')

module.exports = {attempts}

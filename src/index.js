'use strict'

const debug = require('debug-logfmt')('doh-resolver')
const { DOHClient, Packet } = require('dns2')

const debugTime = (...args) => {
  const end = require('time-span')()
  return () => debug(...args, { duration: `${Math.round(end())}ms` })
}

class DoHResolver {
  constructor ({ servers, get, onError = (cb, error) => cb(error.errors[0]) }) {
    this.servers = [].concat(servers)
    this.resolve4 = this.createTypeResolver('A')
    this.resolve6 = this.createTypeResolver('AAAA')
    this.get = get
    this.onError = onError
  }

  getServers = () => this.servers

  setServers = servers => (this.servers = [...servers])

  createTypeResolver = type => {
    return async function (domain, options, cb) {
      const clients = this.servers.map(dns => DOHClient({ dns, get: this.get }))
      try {
        cb(
          null,
          await Promise.any(
            clients.map(async (client, index) => {
              const time = debugTime(type, {
                server: this.servers[index],
                domain
              })
              const result = await client(domain, type).then(({ answers }) =>
                answers.filter(r => r.type === Packet.TYPE[type])
              )
              time()
              return result
            })
          )
        )
      } catch (error) {
        error.errors.forEach(({ name, code, message }) =>
          debug.error({ name, code, message })
        )
        this.onError(cb, error)
      }
    }
  }
}

module.exports = DoHResolver

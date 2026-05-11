const fs = require('fs')
const path = require('path')

const SAMPLE_DATA = {
  direct: [
    { name: 'express', version: '4.18.2', license: 'MIT' },
    { name: 'lodash', version: '4.17.21', license: 'MIT' },
    { name: 'axios', version: '1.6.0', license: 'MIT' },
    { name: 'react', version: '18.2.0', license: 'MIT' },
    { name: 'vue', version: '3.3.8', license: 'MIT' },
    { name: 'mongodb', version: '6.2.0', license: 'Apache-2.0' },
    { name: 'redis', version: '4.6.10', license: 'MIT' },
    { name: 'moment', version: '2.29.4', license: 'MIT' },
    { name: 'nodemailer', version: '6.9.7', license: 'MIT' },
    { name: 'multer', version: '1.4.5-lts.1', license: 'MIT' }
  ],
  transitive: [
    { name: 'accepts', version: '1.3.8', license: 'MIT', parent: 'express' },
    { name: 'array-flatten', version: '1.1.1', license: 'MIT', parent: 'express' },
    { name: 'body-parser', version: '1.20.1', license: 'MIT', parent: 'express' },
    { name: 'content-disposition', version: '0.5.4', license: 'MIT', parent: 'express' },
    { name: 'content-type', version: '1.0.5', license: 'MIT', parent: 'express' },
    { name: 'cookie', version: '0.5.0', license: 'MIT', parent: 'express' },
    { name: 'cookie-signature', version: '1.0.6', license: 'MIT', parent: 'express' },
    { name: 'debug', version: '2.6.9', license: 'MIT', parent: 'express' },
    { name: 'depd', version: '2.0.0', license: 'MIT', parent: 'express' },
    { name: 'encodeurl', version: '1.0.2', license: 'MIT', parent: 'express' },
    { name: 'escape-html', version: '1.0.3', license: 'MIT', parent: 'express' },
    { name: 'etag', version: '1.8.1', license: 'MIT', parent: 'express' },
    { name: 'finalhandler', version: '1.2.0', license: 'MIT', parent: 'express' },
    { name: 'fresh', version: '0.5.2', license: 'MIT', parent: 'express' },
    { name: 'http-errors', version: '2.0.0', license: 'MIT', parent: 'express' },
    { name: 'merge-descriptors', version: '1.0.1', license: 'MIT', parent: 'express' },
    { name: 'methods', version: '1.1.2', license: 'MIT', parent: 'express' },
    { name: 'on-finished', version: '2.4.1', license: 'MIT', parent: 'express' },
    { name: 'parseurl', version: '1.3.3', license: 'MIT', parent: 'express' },
    { name: 'path-to-regexp', version: '0.1.7', license: 'MIT', parent: 'express' },
    { name: 'proxy-addr', version: '2.0.7', license: 'MIT', parent: 'express' },
    { name: 'qs', version: '6.11.0', license: 'BSD-3-Clause', parent: 'express' },
    { name: 'range-parser', version: '1.2.1', license: 'MIT', parent: 'express' },
    { name: 'safe-buffer', version: '5.2.1', license: 'MIT', parent: 'express' },
    { name: 'send', version: '0.18.0', license: 'MIT', parent: 'express' },
    { name: 'serve-static', version: '1.15.0', license: 'MIT', parent: 'express' },
    { name: 'setprototypeof', version: '1.2.0', license: 'ISC', parent: 'express' },
    { name: 'statuses', version: '2.0.1', license: 'MIT', parent: 'express' },
    { name: 'type-is', version: '1.6.18', license: 'MIT', parent: 'express' },
    { name: 'utils-merge', version: '1.0.1', license: 'MIT', parent: 'express' },
    { name: 'vary', version: '1.1.2', license: 'MIT', parent: 'express' },
    { name: 'follow-redirects', version: '1.15.3', license: 'MIT', parent: 'axios' },
    { name: 'form-data', version: '4.0.0', license: 'MIT', parent: 'axios' },
    { name: 'proxy-from-env', version: '1.1.0', license: 'MIT', parent: 'axios' },
    { name: 'loose-envify', version: '1.4.0', license: 'MIT', parent: 'react' },
    { name: 'react-is', version: '18.2.0', license: 'MIT', parent: 'react' },
    { name: '@babel/runtime', version: '7.23.2', license: 'MIT', parent: 'vue' },
    { name: '@vue/shared', version: '3.3.8', license: 'MIT', parent: 'vue' },
    { name: '@vue/compiler-dom', version: '3.3.8', license: 'MIT', parent: 'vue' },
    { name: '@vue/runtime-dom', version: '3.3.8', license: 'MIT', parent: 'vue' },
    { name: '@vue/reactivity', version: '3.3.8', license: 'MIT', parent: 'vue' },
    { name: '@vue/runtime-core', version: '3.3.8', license: 'MIT', parent: 'vue' },
    { name: '@vue/compiler-core', version: '3.3.8', license: 'MIT', parent: 'vue' },
    { name: 'bson', version: '6.2.0', license: 'Apache-2.0', parent: 'mongodb' },
    { name: 'mongodb-connection-string-url', version: '3.0.0', license: 'Apache-2.0', parent: 'mongodb' },
    { name: 'socks', version: '2.7.1', license: 'MIT', parent: 'mongodb' },
    { name: 'whatwg-url', version: '13.0.0', license: 'MIT', parent: 'mongodb-connection-string-url' },
    { name: 'tr46', version: '4.1.1', license: 'MIT', parent: 'whatwg-url' },
    { name: 'punycode', version: '2.3.1', license: 'MIT', parent: 'tr46' },
    { name: 'smart-buffer', version: '4.2.0', license: 'MIT', parent: 'socks' },
    { name: 'ipaddr.js', version: '2.1.0', license: 'MIT', parent: 'proxy-addr' },
    { name: 'ms', version: '2.0.0', license: 'MIT', parent: 'debug' },
    { name: 'ee-first', version: '1.1.1', license: 'MIT', parent: 'on-finished' },
    { name: 'destroy', version: '1.2.0', license: 'MIT', parent: 'on-finished' },
    { name: 'unpipe', version: '1.0.0', license: 'MIT', parent: 'on-finished' },
    { name: 'forwarded', version: '0.2.0', license: 'MIT', parent: 'proxy-addr' },
    { name: 'mime', version: '1.6.0', license: 'MIT', parent: 'send' },
    { name: 'mime-types', version: '2.1.35', license: 'MIT', parent: 'type-is' },
    { name: 'mime-db', version: '1.52.0', license: 'MIT', parent: 'mime-types' },
    { name: 'negotiator', version: '0.6.3', license: 'MIT', parent: 'accepts' },
    { name: 'inherits', version: '2.0.4', license: 'ISC', parent: 'setprototypeof' },
    { name: 'asynckit', version: '0.4.0', license: 'MIT', parent: 'form-data' },
    { name: 'combined-stream', version: '1.0.8', license: 'MIT', parent: 'form-data' },
    { name: 'delayed-stream', version: '1.0.0', license: 'MIT', parent: 'combined-stream' },
    { name: 'js-tokens', version: '4.0.0', license: 'MIT', parent: 'loose-envify' },
    { name: 'regenerator-runtime', version: '0.14.0', license: 'MIT', parent: '@babel/runtime' },
    { name: 'entities', version: '4.5.0', license: 'BSD-2-Clause', parent: '@vue/compiler-dom' },
    { name: 'estree-walker', version: '2.0.2', license: 'MIT', parent: '@vue/compiler-core' },
    { name: 'source-map-js', version: '1.0.2', license: 'BSD-3-Clause', parent: '@vue/compiler-core' },
    { name: 'iconv-lite', version: '0.4.24', license: 'MIT', parent: 'body-parser' },
    { name: 'raw-body', version: '2.5.1', license: 'MIT', parent: 'body-parser' },
    { name: 'bytes', version: '3.1.2', license: 'MIT', parent: 'raw-body' },
    { name: 'safer-buffer', version: '2.1.2', license: 'MIT', parent: 'iconv-lite' },
    { name: 'busboy', version: '1.6.0', license: 'MIT', parent: 'multer' },
    { name: 'streamsearch', version: '1.1.0', license: 'MIT', parent: 'busboy' },
    { name: 'append-field', version: '1.0.0', license: 'MIT', parent: 'multer' },
    { name: 'buffer-from', version: '1.1.2', license: 'MIT', parent: 'multer' },
    { name: 'concat-stream', version: '1.6.2', license: 'MIT', parent: 'multer' },
    { name: 'mkdirp', version: '0.5.6', license: 'MIT', parent: 'multer' },
    { name: 'object-assign', version: '4.1.1', license: 'MIT', parent: 'multer' },
    { name: 'on-finished', version: '2.4.1', license: 'MIT', parent: 'multer' },
    { name: 'type-is', version: '1.6.18', license: 'MIT', parent: 'multer' },
    { name: 'xtend', version: '4.0.2', license: 'MIT', parent: 'multer' },
    { name: 'minimist', version: '1.2.8', license: 'MIT', parent: 'mkdirp' },
    { name: 'typedarray', version: '0.0.6', license: 'MIT', parent: 'concat-stream' },
    { name: 'readable-stream', version: '2.3.8', license: 'MIT', parent: 'concat-stream' },
    { name: 'core-util-is', version: '1.0.3', license: 'MIT', parent: 'readable-stream' },
    { name: 'isarray', version: '1.0.0', license: 'MIT', parent: 'readable-stream' },
    { name: 'process-nextick-args', version: '2.0.1', license: 'MIT', parent: 'readable-stream' },
    { name: 'string_decoder', version: '1.1.1', license: 'MIT', parent: 'readable-stream' },
    { name: 'util-deprecate', version: '1.0.2', license: 'MIT', parent: 'readable-stream' },
    { name: 'nodemailer', version: '6.9.7', license: 'MIT', parent: 'nodemailer' },
    { name: 'node-fetch', version: '2.7.0', license: 'MIT', parent: 'nodemailer' },
    { name: 'whatwg-url', version: '5.0.0', license: 'MIT', parent: 'node-fetch' },
    { name: 'tr46', version: '0.0.3', license: 'MIT', parent: 'whatwg-url@5.0.0' },
    { name: 'webidl-conversions', version: '3.0.1', license: 'BSD-2-Clause', parent: 'whatwg-url@5.0.0' },
    { name: 'acorn', version: '8.11.2', license: 'MIT', parent: '@vue/compiler-core' },
    { name: '@babel/parser', version: '7.23.0', license: 'MIT', parent: '@vue/compiler-core' },
    { name: 'magic-string', version: '0.30.5', license: 'MIT', parent: '@vue/compiler-core' },
    { name: '@jridgewell/sourcemap-codec', version: '1.4.15', license: 'MIT', parent: 'magic-string' }
  ],
  highRisk: [
    { name: 'license-checker-rseidelsohn', version: '4.3.0', license: 'SSPL', parent: 'sample' },
    { name: 'sspl-package', version: '1.0.0', license: 'SSPL-1.0', parent: 'sample' },
    { name: 'agpl-library', version: '2.1.0', license: 'AGPL-3.0', parent: 'sample' },
    { name: 'gpl-component', version: '3.0.0', license: 'GPL-3.0', parent: 'sample' },
    { name: 'lgpl-utils', version: '2.1.0', license: 'LGPL-2.1', parent: 'sample' }
  ],
  unknownLicense: [
    { name: 'unknown-pkg', version: '1.0.0', license: null, parent: 'sample' },
    { name: 'missing-license', version: '2.0.0', license: '', parent: 'sample' },
    { name: 'custom-license', version: '1.5.0', license: 'CUSTOM', parent: 'sample' },
    { name: 'proprietary-pkg', version: '3.0.0', license: 'Proprietary', parent: 'sample' }
  ]
}

class DependencyReader {
  constructor() {
    this.readers = {
      npm: this.readNpmDependencies.bind(this),
      package: this.readNpmDependencies.bind(this),
      pip: this.readPipDependencies.bind(this),
      requirements: this.readPipDependencies.bind(this)
    }
  }

  readNpmDependencies(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8')
    const pkg = JSON.parse(content)
    const dependencies = []
    
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        dependencies.push({
          name,
          version: version.replace(/^[\^~]/, ''),
          license: pkg.licenses?.[name] || null
        })
      }
    }
    
    return { direct: dependencies, transitive: [] }
  }

  readPipDependencies(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8')
    const lines = content.split('\n')
    const dependencies = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)([=<>!]+.*)?$/)
      if (match) {
        dependencies.push({
          name: match[1].toLowerCase(),
          version: match[2] ? match[2].replace(/^[=<>!]+/, '') : 'latest',
          license: null
        })
      }
    }
    
    return { direct: dependencies, transitive: [] }
  }

  readSampleDependencies(options = {}) {
    const { includeHighRisk = true, includeUnknown = true } = options
    
    const direct = [...SAMPLE_DATA.direct]
    let transitive = [...SAMPLE_DATA.transitive]
    
    if (includeHighRisk) {
      transitive = transitive.concat(SAMPLE_DATA.highRisk)
    }
    
    if (includeUnknown) {
      transitive = transitive.concat(SAMPLE_DATA.unknownLicense)
    }
    
    return { direct, transitive }
  }

  readDependencies(source, options = {}) {
    if (source === 'sample' || source === 'demo' || source === 'example') {
      return this.readSampleDependencies(options)
    }
    
    if (!fs.existsSync(source)) {
      throw new Error(`依赖清单文件不存在: ${source}`)
    }
    
    const basename = path.basename(source).toLowerCase()
    
    if (basename === 'package.json') {
      return this.readNpmDependencies(source)
    }
    if (basename === 'requirements.txt') {
      return this.readPipDependencies(source)
    }
    
    const ext = path.extname(basename)
    if (ext === '.json') {
      return this.readNpmDependencies(source)
    }
    if (ext === '.txt') {
      return this.readPipDependencies(source)
    }
    
    throw new Error(`不支持的依赖清单格式: ${basename}`)
  }

  detectSources(cwd = process.cwd()) {
    const sources = []
    
    const packageJson = path.join(cwd, 'package.json')
    if (fs.existsSync(packageJson)) {
      sources.push({ type: 'npm', path: packageJson })
    }
    
    const requirementsTxt = path.join(cwd, 'requirements.txt')
    if (fs.existsSync(requirementsTxt)) {
      sources.push({ type: 'pip', path: requirementsTxt })
    }
    
    const pyprojectToml = path.join(cwd, 'pyproject.toml')
    if (fs.existsSync(pyprojectToml)) {
      sources.push({ type: 'pip', path: pyprojectToml })
    }
    
    return sources
  }
}

module.exports = DependencyReader

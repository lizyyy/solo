const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

const NpmDependencyParser = require('../src/parsers/NpmDependencyParser')
const PythonDependencyParser = require('../src/parsers/PythonDependencyParser')
const ThirdPartyCsvParser = require('../src/parsers/ThirdPartyCsvParser')
const OverridesParser = require('../src/parsers/OverridesParser')
const LicenseNoticeParser = require('../src/parsers/LicenseNoticeParser')

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'license-checker-test-'))
}

test('NpmDependencyParser - 解析简单 package.json', () => {
  const tempDir = createTempDir()
  
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    license: 'MIT',
    dependencies: {
      'express': '^4.18.2',
      'lodash': '^4.17.21'
    },
    devDependencies: {
      'jest': '^29.7.0'
    }
  }
  
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2))
  
  const parser = new NpmDependencyParser(tempDir)
  const result = parser.parse()
  
  assert.strictEqual(result.source, 'npm/pnpm')
  assert.ok(Array.isArray(result.dependencies))
  assert.ok(result.dependencies.length >= 2)
  
  const express = result.dependencies.find(d => d.name === 'express')
  assert.ok(express)
  assert.strictEqual(express.type, 'production')
  
  const lodash = result.dependencies.find(d => d.name === 'lodash')
  assert.ok(lodash)
  
  const jest = result.dependencies.find(d => d.name === 'jest')
  assert.ok(jest)
  assert.strictEqual(jest.type, 'development')
  
  fs.rmSync(tempDir, { recursive: true })
})

test('PythonDependencyParser - 解析 requirements.txt', () => {
  const tempDir = createTempDir()
  
  const requirements = `# Web 框架
flask==2.3.3
django>=4.2.0

# HTTP 客户端
requests==2.31.0
`
  
  fs.writeFileSync(path.join(tempDir, 'requirements.txt'), requirements)
  
  const parser = new PythonDependencyParser(tempDir)
  const result = parser.parse()
  
  assert.strictEqual(result.source, 'python')
  assert.ok(Array.isArray(result.dependencies))
  assert.ok(result.dependencies.length >= 3)
  
  const flask = result.dependencies.find(d => d.name === 'flask')
  assert.ok(flask)
  assert.strictEqual(flask.version, '2.3.3')
  
  const django = result.dependencies.find(d => d.name === 'django')
  assert.ok(django)
  
  const requests = result.dependencies.find(d => d.name === 'requests')
  assert.ok(requests)
  assert.strictEqual(requests.version, '2.31.0')
  
  fs.rmSync(tempDir, { recursive: true })
})

test('ThirdPartyCsvParser - 解析有效 CSV', () => {
  const tempDir = createTempDir()
  
  const csv = `name,version,license,source,notes
lodash,4.17.21,MIT,npm,工具库
express,4.18.2,MIT,npm,Web 框架
some-lib,2.0.0,Apache-2.0,github,需要 NOTICE
`
  
  fs.writeFileSync(path.join(tempDir, 'third_party.csv'), csv)
  
  const parser = new ThirdPartyCsvParser(tempDir)
  const result = parser.parse()
  
  assert.strictEqual(result.source, 'third_party.csv')
  assert.strictEqual(result.errors.length, 0)
  assert.strictEqual(result.dependencies.length, 3)
  
  const lodash = result.dependencies.find(d => d.name === 'lodash')
  assert.ok(lodash)
  assert.strictEqual(lodash.license, 'MIT')
  assert.strictEqual(lodash.version, '4.17.21')
  
  const someLib = result.dependencies.find(d => d.name === 'some-lib')
  assert.ok(someLib)
  assert.strictEqual(someLib.license, 'Apache-2.0')
  
  fs.rmSync(tempDir, { recursive: true })
})

test('ThirdPartyCsvParser - 缺少必需列', () => {
  const tempDir = createTempDir()
  
  const csv = `name,version
lodash,4.17.21
`
  
  fs.writeFileSync(path.join(tempDir, 'third_party.csv'), csv)
  
  const parser = new ThirdPartyCsvParser(tempDir)
  const result = parser.parse()
  
  assert.ok(result.errors.length > 0)
  assert.ok(result.errors[0].message.includes('license'))
  
  fs.rmSync(tempDir, { recursive: true })
})

test('OverridesParser - 解析有效 overrides.json', () => {
  const tempDir = createTempDir()
  
  const overrides = {
    licenseOverrides: {
      'some-package': {
        license: 'MIT',
        version: '1.0.0',
        source: '手动核实'
      }
    },
    riskOverrides: {
      'UnknownLicense': 'LOW'
    },
    ignorePackages: ['internal-package']
  }
  
  fs.writeFileSync(path.join(tempDir, 'overrides.json'), JSON.stringify(overrides, null, 2))
  
  const parser = new OverridesParser(tempDir)
  const result = parser.parse()
  
  assert.strictEqual(result.errors.length, 0)
  assert.ok(result.overrides)
  assert.ok(result.overrides.licenseOverrides['some-package'])
  assert.strictEqual(result.overrides.licenseOverrides['some-package'].license, 'MIT')
  assert.ok(result.overrides.ignorePackages.includes('internal-package'))
  
  fs.rmSync(tempDir, { recursive: true })
})

test('OverridesParser - 缺少文件时返回默认配置', () => {
  const tempDir = createTempDir()
  
  const parser = new OverridesParser(tempDir)
  const result = parser.parse()
  
  assert.strictEqual(result.errors.length, 0)
  assert.ok(result.overrides)
  assert.ok(Array.isArray(result.overrides.ignorePackages))
  assert.strictEqual(result.overrides.ignorePackages.length, 0)
  assert.ok(result.warnings.length > 0)
  
  fs.rmSync(tempDir, { recursive: true })
})

test('LicenseNoticeParser - 检测 LICENSE 文件', () => {
  const tempDir = createTempDir()
  
  const license = `MIT License

Copyright (c) 2024 Test Project

Permission is hereby granted...
`
  
  fs.writeFileSync(path.join(tempDir, 'LICENSE'), license)
  
  const parser = new LicenseNoticeParser(tempDir)
  const result = parser.parse()
  
  assert.ok(result.projectLicense)
  assert.strictEqual(result.projectLicense.file, 'LICENSE')
  assert.strictEqual(result.projectLicense.detectedLicense, 'MIT')
  
  assert.ok(LicenseNoticeParser.hasProjectLicense(tempDir))
  
  fs.rmSync(tempDir, { recursive: true })
})

test('LicenseNoticeParser - 检测 Apache 许可证', () => {
  const tempDir = createTempDir()
  
  const license = `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright (c) 2024 Test Project

Licensed under the Apache License, Version 2.0...
`
  
  fs.writeFileSync(path.join(tempDir, 'LICENSE'), license)
  
  const parser = new LicenseNoticeParser(tempDir)
  const result = parser.parse()
  
  assert.ok(result.projectLicense)
  assert.strictEqual(result.projectLicense.detectedLicense, 'Apache-2.0')
  
  fs.rmSync(tempDir, { recursive: true })
})

test('LicenseNoticeParser - 检测 NOTICE 文件', () => {
  const tempDir = createTempDir()
  
  const notice = `NOTICE
======

Test Project
Copyright 2024

==============================================================================

第三方组件声明
------------------

## some-apache-tool
版本: 3.2.1
许可证: Apache-2.0
来源: npm
版权所有: 2024 Apache Software Foundation
`
  
  fs.writeFileSync(path.join(tempDir, 'NOTICE'), notice)
  
  assert.ok(LicenseNoticeParser.hasNoticeFile(tempDir))
  
  const parser = new LicenseNoticeParser(tempDir)
  const result = parser.parse()
  
  assert.ok(result.noticeFile)
  assert.strictEqual(result.noticeFile.file, 'NOTICE')
  
  fs.rmSync(tempDir, { recursive: true })
})

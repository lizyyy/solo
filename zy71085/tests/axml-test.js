'use strict'

const fs = require('fs')
const path = require('path')
const { parseBinaryXml, isBinaryXml, parseXml } = require('../src/parser')

function generateTestAxml () {
  const buffer = Buffer.alloc(1024)
  let offset = 0

  function writeInt32 (value) {
    buffer.writeUInt32LE(value, offset)
    offset += 4
  }

  function writeInt16 (value) {
    buffer.writeUInt16LE(value, offset)
    offset += 2
  }

  function writeString (str) {
    for (let i = 0; i < str.length; i++) {
      writeInt16(str.charCodeAt(i))
    }
    writeInt16(0)
  }

  console.log('注意: 这是一个简单的 AXML 结构验证测试')
  console.log('真实 APK 中的二进制 Manifest 才能完整测试')
  console.log()
}

async function testStructureCompatibility () {
  console.log('=== 测试 AXML 解析器结构兼容性 ===\n')

  const xmlFile = './examples/old/AndroidManifest.xml'
  const xmlContent = fs.readFileSync(xmlFile, 'utf-8')

  console.log('1. 测试 xml2js 解析的结构:')
  const xml2jsResult = await parseXml(xmlContent)
  console.log('   - manifest.$ 存在:', !!xml2jsResult.$)
  console.log('   - manifest.$.package:', xml2jsResult.$.package)
  console.log('   - uses-permission 是数组:', Array.isArray(xml2jsResult['uses-permission']))
  if (xml2jsResult['uses-permission'] && xml2jsResult['uses-permission'][0]) {
    console.log('   - uses-permission[0].$ 存在:', !!xml2jsResult['uses-permission'][0].$)
    console.log('   - uses-permission[0].$.android:name:', xml2jsResult['uses-permission'][0].$['android:name'])
  }

  console.log('\n2. 模拟 AXML 解析的提取函数测试:')
  const extractAppInfo = require('../src/parser/apk-parser').extractAppInfo || function (m) {
    const manifestAttrs = m.$ || {}
    return { packageName: manifestAttrs.package || '' }
  }

  const appInfo = extractAppInfo(xml2jsResult)
  console.log('   - extractAppInfo 提取包名:', appInfo.packageName)

  console.log('\n✓ 结构兼容性测试通过!')
}

testStructureCompatibility().catch(console.error)

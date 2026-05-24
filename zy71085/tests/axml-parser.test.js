'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const { parseXml, isBinaryXml, parseBinaryXml } = require('../src/parser')
const apkParser = require('../src/parser/apk-parser')
const { extractAppInfo, extractPermissions, extractFeatures } = apkParser

describe('AXML 解析器结构兼容性测试', () => {
  const xmlFile = path.join(__dirname, '..', 'examples', 'old', 'AndroidManifest.xml')
  const xmlContent = fs.readFileSync(xmlFile, 'utf-8')

  it('xml2js 解析结果结构应符合预期', async () => {
    const result = await parseXml(xmlContent)

    assert.ok(result.$, 'manifest 应有 $ 属性')
    assert.ok(result.$.package, 'manifest.$ 应有 package 属性')
    assert.ok(Array.isArray(result['uses-permission']), 'uses-permission 应为数组')
    assert.ok(result['uses-permission'][0].$, 'uses-permission[0] 应有 $ 属性')
    assert.ok(result['uses-permission'][0].$['android:name'], 'uses-permission[0].$ 应有 android:name')
  })

  it('extractAppInfo 应能从 xml2js 结果提取信息', async () => {
    const result = await parseXml(xmlContent)
    const appInfo = extractAppInfo(result)

    assert.strictEqual(appInfo.packageName, 'com.example.app')
    assert.strictEqual(appInfo.versionName, '1.0.0')
    assert.strictEqual(appInfo.versionCode, '100')
  })

  it('extractPermissions 应能从 xml2js 结果提取权限', async () => {
    const result = await parseXml(xmlContent)
    const permissions = extractPermissions(result)

    assert.ok(Array.isArray(permissions), 'permissions 应为数组')
    assert.ok(permissions.length > 0, '应提取到权限')
    assert.ok(permissions.some(p => p.name === 'android.permission.INTERNET'), '应包含 INTERNET 权限')
  })

  it('extractFeatures 应能从 xml2js 结果提取特性', async () => {
    const result = await parseXml(xmlContent)
    const features = extractFeatures(result)

    assert.ok(Array.isArray(features), 'features 应为数组')
    assert.ok(features.length > 0, '应提取到特性')
  })

  it('isBinaryXml 应能正确识别非二进制文件', () => {
    const buffer = Buffer.from(xmlContent)
    assert.strictEqual(isBinaryXml(buffer), false, '纯文本 XML 不应被识别为二进制')
  })

  it('isBinaryXml 应能正确识别二进制 AXML magic number', () => {
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32LE(0x00080003, 0)
    assert.strictEqual(isBinaryXml(buffer), true, '二进制 AXML magic number 应被正确识别')
  })
})

'use strict'

const { EXIT_CODES } = require('../config/constants')

const CHUNK_STRING_POOL = 0x001C0001
const CHUNK_RESOURCE_MAP = 0x00080180
const CHUNK_XML_START_NAMESPACE = 0x00100100
const CHUNK_XML_END_NAMESPACE = 0x00100101
const CHUNK_XML_START_TAG = 0x00100102
const CHUNK_XML_END_TAG = 0x00100103
const CHUNK_XML_TEXT = 0x00100104

const TYPE_ATTRIBUTE = 0x02
const TYPE_DIMENSION = 0x05
const TYPE_FIRST_COLOR_INT = 0x1C
const TYPE_LAST_COLOR_INT = 0x1F
const TYPE_INT_BOOLEAN = 0x12
const TYPE_INT_HEX = 0x11
const TYPE_INT_DEC = 0x10
const TYPE_REFERENCE = 0x01
const TYPE_STRING = 0x03
const TYPE_FRACTION = 0x06
const TYPE_FLOAT = 0x04

class AxmlParserError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'AxmlParserError'
    this.code = code || EXIT_CODES.ERROR_PARSE_FAILED
  }
}

function parseBinaryXml (buffer) {
  try {
    const parser = new AxmlParser(buffer)
    return parser.parse()
  } catch (err) {
    throw new AxmlParserError(`AXML 解析失败: ${err.message}`)
  }
}

class AxmlParser {
  constructor (buffer) {
    this.buffer = buffer
    this.offset = 0
    this.stringPool = []
    this.resourceIds = []
    this.manifest = { $: {} }
    this.elementStack = [this.manifest]
    this.firstManifestTag = true
  }

  readInt32 () {
    const value = this.buffer.readUInt32LE(this.offset)
    this.offset += 4
    return value
  }

  readInt16 () {
    const value = this.buffer.readUInt16LE(this.offset)
    this.offset += 2
    return value
  }

  readInt8 () {
    const value = this.buffer.readUInt8(this.offset)
    this.offset += 1
    return value
  }

  parseStringPool () {
    const stringCount = this.readInt32()
    const styleCount = this.readInt32()
    const flags = this.readInt32()
    const stringsStart = this.readInt32()
    this.readInt32()

    const stringOffsets = []
    for (let i = 0; i < stringCount; i++) {
      stringOffsets.push(this.readInt32())
    }

    const isUtf8 = (flags & 0x100) !== 0
    const stringsBase = this.offset - (stringCount * 4 + 20) + stringsStart

    for (let i = 0; i < stringCount; i++) {
      const strOffset = stringsBase + stringOffsets[i]
      let str = ''

      try {
        if (isUtf8) {
          let len = this.buffer.readUInt8(strOffset)
          if (len & 0x80) {
            len = ((len & 0x7F) << 8) | this.buffer.readUInt8(strOffset + 1)
          }
          str = this.buffer.toString('utf8', strOffset + 2, strOffset + 2 + len)
        } else {
          let len = this.buffer.readUInt16LE(strOffset)
          if (len & 0x8000) {
            len = ((len & 0x7FFF) << 16) | this.buffer.readUInt16LE(strOffset + 2)
          }
          for (let j = 0; j < len; j++) {
            const charCode = this.buffer.readUInt16LE(strOffset + 2 + j * 2)
            str += String.fromCharCode(charCode)
          }
        }
      } catch (e) {
        str = ''
      }
      this.stringPool.push(str || '')
    }
  }

  parseResourceMap (payloadSize) {
    const count = Math.floor(payloadSize / 4)
    for (let i = 0; i < count; i++) {
      this.resourceIds.push(this.readInt32())
    }
  }

  parseStartNamespace () {
    this.readInt32()
    this.readInt32()
    this.readInt32()
    this.readInt32()
  }

  parseEndNamespace () {
    this.readInt32()
    this.readInt32()
    this.readInt32()
    this.readInt32()
  }

  parseStartTag () {
    this.readInt32()
    this.readInt32()
    const namespaceUri = this.readInt32()
    const nameIdx = this.readInt32()
    this.readInt32()
    const attributeCount = this.readInt32() & 0xFFFF
    this.readInt32()

    const tagName = (nameIdx >= 0 && nameIdx < this.stringPool.length)
      ? this.stringPool[nameIdx]
      : 'unknown'

    const element = {
      $: {}
    }

    for (let i = 0; i < attributeCount; i++) {
      const attrNs = this.readInt32()
      const attrNameIdx = this.readInt32()
      const attrRawValue = this.readInt32()
      const attrType = this.readInt32() >>> 24
      const attrData = this.readInt32()

      let attrName = (attrNameIdx >= 0 && attrNameIdx < this.stringPool.length)
        ? this.stringPool[attrNameIdx]
        : `attr_${attrNameIdx}`
      let attrValue

      if (attrRawValue !== 0xFFFFFFFF && attrRawValue >= 0 && attrRawValue < this.stringPool.length) {
        attrValue = this.stringPool[attrRawValue]
      } else {
        attrValue = this.convertValue(attrType, attrData)
      }

      if (attrNs !== 0xFFFFFFFF && attrNs >= 0 && attrNs < this.stringPool.length) {
        const ns = this.stringPool[attrNs] || ''
        if (ns.includes('android.com') || ns === 'http://schemas.android.com/apk/res/android') {
          attrName = `android:${attrName}`
        }
      }

      element.$[attrName] = attrValue != null ? String(attrValue) : ''
    }

    if (this.firstManifestTag && tagName === 'manifest') {
      this.firstManifestTag = false
      Object.assign(this.manifest.$, element.$)
    } else {
      const parent = this.elementStack[this.elementStack.length - 1]
      if (!parent[tagName]) {
        parent[tagName] = []
      }
      parent[tagName].push(element)
      this.elementStack.push(element)
    }
  }

  parseEndTag () {
    this.readInt32()
    this.readInt32()
    this.readInt32()
    const nameIdx = this.readInt32()
    const tagName = (nameIdx >= 0 && nameIdx < this.stringPool.length)
      ? this.stringPool[nameIdx]
      : 'unknown'

    if (!(tagName === 'manifest' && this.elementStack.length <= 1)) {
      this.elementStack.pop()
    }
  }

  parseText () {
    this.readInt32()
    this.readInt32()
    this.readInt32()
    this.readInt32()
    this.readInt32()
  }

  convertValue (type, data) {
    switch (type) {
      case TYPE_STRING:
        return (data >= 0 && data < this.stringPool.length) ? this.stringPool[data] : ''
      case TYPE_REFERENCE:
        return `@ref/0x${data.toString(16).padStart(8, '0')}`
      case TYPE_INT_DEC:
        return data
      case TYPE_INT_HEX:
        return `0x${data.toString(16)}`
      case TYPE_INT_BOOLEAN:
        return data !== 0 ? 'true' : 'false'
      case TYPE_FLOAT:
        return new DataView(new Uint8Array([data & 0xFF, (data >> 8) & 0xFF, (data >> 16) & 0xFF, (data >> 24) & 0xFF]).buffer).getFloat32(0, true)
      case TYPE_FIRST_COLOR_INT:
      case TYPE_FIRST_COLOR_INT + 1:
      case TYPE_FIRST_COLOR_INT + 2:
      case TYPE_FIRST_COLOR_INT + 3:
        return `#${data.toString(16).padStart(8, '0')}`
      default:
        return `0x${data.toString(16)}`
    }
  }

  parse () {
    const magic = this.readInt32()
    if (magic !== 0x00080003) {
      return null
    }

    const fileSize = this.readInt32()

    while (this.offset < this.buffer.length - 12) {
      const chunkType = this.readInt32()
      const chunkHeaderSize = this.readInt32()
      const chunkSize = this.readInt32()

      if (chunkSize <= 0 || chunkSize > this.buffer.length) break

      const headerSkip = chunkHeaderSize - 12
      if (headerSkip > 0 && headerSkip < chunkSize) {
        this.offset += headerSkip
      }

      const payloadSize = chunkSize - chunkHeaderSize

      switch (chunkType) {
        case CHUNK_STRING_POOL:
          this.parseStringPool()
          const stringPoolSkip = payloadSize - (this.stringPool.length * 4 + 20)
          if (stringPoolSkip > 0) {
            this.offset += stringPoolSkip
          }
          break
        case CHUNK_RESOURCE_MAP:
          this.parseResourceMap(payloadSize)
          break
        case CHUNK_XML_START_NAMESPACE:
          this.parseStartNamespace()
          break
        case CHUNK_XML_END_NAMESPACE:
          this.parseEndNamespace()
          break
        case CHUNK_XML_START_TAG:
          this.parseStartTag()
          break
        case CHUNK_XML_END_TAG:
          this.parseEndTag()
          break
        case CHUNK_XML_TEXT:
          this.parseText()
          break
        default:
          if (payloadSize > 0 && this.offset + payloadSize <= this.buffer.length) {
            this.offset += payloadSize
          }
      }
    }

    return this.manifest
  }
}

function isBinaryXml (buffer) {
  if (buffer.length < 4) return false
  const magic = buffer.readUInt32LE(0)
  return magic === 0x00080003
}

module.exports = {
  parseBinaryXml,
  isBinaryXml,
  AxmlParser,
  AxmlParserError
}

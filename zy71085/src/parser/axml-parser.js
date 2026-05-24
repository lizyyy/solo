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
    this.result = { manifest: {} }
    this.elementStack = [this.result.manifest]
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

  peekInt32 () {
    return this.buffer.readUInt32LE(this.offset)
  }

  parseString (length) {
    let str = ''
    for (let i = 0; i < length; i++) {
      const charCode = this.buffer.readUInt16LE(this.offset + i * 2)
      if (charCode === 0) break
      str += String.fromCharCode(charCode)
    }
    return str
  }

  parseStringPool (chunkSize) {
    const startOffset = this.offset
    const stringCount = this.readInt32()
    const styleCount = this.readInt32()
    const flags = this.readInt32()
    const stringsStart = this.readInt32()
    const stylesStart = this.readInt32()

    const stringOffsets = []
    for (let i = 0; i < stringCount; i++) {
      stringOffsets.push(this.readInt32())
    }

    const isUtf8 = (flags & 0x100) !== 0
    const stringsBase = startOffset + stringsStart

    for (let i = 0; i < stringCount; i++) {
      const strOffset = stringsBase + stringOffsets[i]
      let str

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
        str = ''
        for (let j = 0; j < len; j++) {
          const charCode = this.buffer.readUInt16LE(strOffset + 2 + j * 2)
          str += String.fromCharCode(charCode)
        }
      }
      this.stringPool.push(str)
    }

    this.offset = startOffset + chunkSize
  }

  parseResourceMap (chunkSize) {
    const startOffset = this.offset
    const resourceCount = (chunkSize - 8) / 4

    for (let i = 0; i < resourceCount; i++) {
      this.resourceIds.push(this.readInt32())
    }

    this.offset = startOffset + chunkSize
  }

  parseStartNamespace (chunkSize) {
    const startOffset = this.offset
    this.readInt32()
    this.readInt32()
    const prefixIdx = this.readInt32()
    const uriIdx = this.readInt32()

    this.offset = startOffset + chunkSize
  }

  parseEndNamespace (chunkSize) {
    const startOffset = this.offset
    this.readInt32()
    this.readInt32()
    this.readInt32()
    this.readInt32()

    this.offset = startOffset + chunkSize
  }

  parseStartTag (chunkSize) {
    const startOffset = this.offset
    this.readInt32()
    this.readInt32()
    const namespaceUri = this.readInt32()
    const nameIdx = this.readInt32()
    const flags = this.readInt32()
    const attributeCount = this.readInt32() & 0xFFFF
    const classAttribute = this.readInt32()

    const tagName = this.stringPool[nameIdx] || 'unknown'

    const element = {
      $: {},
      _children: []
    }

    for (let i = 0; i < attributeCount; i++) {
      const attrNs = this.readInt32()
      const attrNameIdx = this.readInt32()
      const attrRawValue = this.readInt32()
      const attrType = this.readInt32() >>> 24
      const attrData = this.readInt32()

      let attrName = this.stringPool[attrNameIdx] || `attr_${attrNameIdx}`
      let attrValue

      if (attrRawValue !== 0xFFFFFFFF) {
        attrValue = this.stringPool[attrRawValue]
      } else {
        attrValue = this.convertValue(attrType, attrData)
      }

      if (attrNs !== 0xFFFFFFFF) {
        const ns = this.stringPool[attrNs] || ''
        if (ns.includes('android.com')) {
          attrName = `android:${attrName}`
        }
      }

      element.$[attrName] = attrValue != null ? String(attrValue) : ''
    }

    const parent = this.elementStack[this.elementStack.length - 1]
    if (!parent[tagName]) {
      parent[tagName] = []
    }
    parent[tagName].push(element)
    this.elementStack.push(element)

    this.offset = startOffset + chunkSize
  }

  parseEndTag (chunkSize) {
    const startOffset = this.offset
    this.readInt32()
    this.readInt32()
    this.readInt32()
    this.readInt32()

    this.elementStack.pop()
    this.offset = startOffset + chunkSize
  }

  parseText (chunkSize) {
    const startOffset = this.offset
    this.readInt32()
    this.readInt32()
    const textIdx = this.readInt32()
    this.readInt32()
    this.readInt32()

    this.offset = startOffset + chunkSize
  }

  convertValue (type, data) {
    switch (type) {
      case TYPE_STRING:
        return this.stringPool[data] || ''
      case TYPE_REFERENCE:
        return `@ref/0x${data.toString(16).padStart(8, '0')}`
      case TYPE_INT_DEC:
        return data
      case TYPE_INT_HEX:
        return `0x${data.toString(16)}`
      case TYPE_INT_BOOLEAN:
        return data !== 0 ? 'true' : 'false'
      case TYPE_INT_BOOLEAN + 1:
        return data !== 0
      case TYPE_FLOAT:
        return new DataView(new ArrayBuffer(4)).setFloat32(0, data)
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

    while (this.offset < this.buffer.length) {
      const chunkType = this.peekInt32()
      const chunkHeaderSize = this.buffer.readUInt32LE(this.offset + 4)
      const chunkSize = this.buffer.readUInt32LE(this.offset + 8)

      if (chunkSize === 0) break

      this.offset += 8

      switch (chunkType) {
        case CHUNK_STRING_POOL:
          this.parseStringPool(chunkSize - 8)
          break
        case CHUNK_RESOURCE_MAP:
          this.parseResourceMap(chunkSize - 8)
          break
        case CHUNK_XML_START_NAMESPACE:
          this.parseStartNamespace(chunkSize - 8)
          break
        case CHUNK_XML_END_NAMESPACE:
          this.parseEndNamespace(chunkSize - 8)
          break
        case CHUNK_XML_START_TAG:
          this.parseStartTag(chunkSize - 8)
          break
        case CHUNK_XML_END_TAG:
          this.parseEndTag(chunkSize - 8)
          break
        case CHUNK_XML_TEXT:
          this.parseText(chunkSize - 8)
          break
        default:
          this.offset += chunkSize - 8
      }
    }

    return this.normalizeResult(this.result.manifest)
  }

  normalizeResult (obj) {
    if (obj && obj.$ && Object.keys(obj.$).length === 0) {
      delete obj.$
    }

    if (obj && obj._children) {
      delete obj._children
    }

    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        obj[key].forEach(item => this.normalizeResult(item))
      } else if (typeof obj[key] === 'object') {
        this.normalizeResult(obj[key])
      }
    }

    return obj
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

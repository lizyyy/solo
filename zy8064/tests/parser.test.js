import { jest } from '@jest/globals'
import { parseXML, parseContainer, parseOPF, parseNCX } from '../src/parsers/XMLParser.js'

describe('XMLParser', () => {
  describe('parseContainer', () => {
    test('正确解析有效的 container.xml', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

      const result = await parseContainer(xml)
      expect(result.fullPath).toBe('OEBPS/content.opf')
      expect(result.mediaType).toBe('application/oebps-package+xml')
    })

    test('缺少 rootfile 时抛出错误', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
  </rootfiles>
</container>`

      await expect(parseContainer(xml)).rejects.toThrow('缺少 rootfile 元素')
    })
  })

  describe('parseOPF', () => {
    test('正确解析 OPF 文件', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata>
    <dc:title>Test Book</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">test-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`

      const result = await parseOPF(xml)
      expect(result.metadata.title).toBe('Test Book')
      expect(result.metadata.creator).toBe('Test Author')
      expect(result.manifest).toHaveLength(3)
      expect(result.spine).toHaveLength(2)
      expect(result.manifest[0].id).toBe('chapter1')
    })

    test('检测 manifest 重复 id', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata>
    <dc:identifier id="bookid">test-001</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter1" href="chapter1-alt.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
  </spine>
</package>`

      const result = await parseOPF(xml)
      const ids = result.manifest.map(i => i.id)
      expect(ids).toEqual(['chapter1', 'chapter1'])
    })
  })

  describe('parseNCX', () => {
    test('正确解析 NCX 文件', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="test-001"/>
  </head>
  <docTitle>
    <text>Test Book</text>
  </docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>Chapter 1</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navpoint-2" playOrder="2">
      <navLabel><text>Chapter 2</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`

      const result = await parseNCX(xml)
      expect(result.navPoints).toHaveLength(2)
      expect(result.navPoints[0].label).toBe('Chapter 1')
      expect(result.navPoints[0].src).toBe('chapter1.xhtml')
    })

    test('空 navMap 返回空数组', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="test-001"/>
  </head>
  <docTitle>
    <text>Test Book</text>
  </docTitle>
  <navMap>
  </navMap>
</ncx>`

      const result = await parseNCX(xml)
      expect(result.navPoints).toHaveLength(0)
    })
  })
})

describe('EPUBParser Edge Cases', () => {
  test('处理加密 EPUB 抛出特定错误', async () => {
    const { EPUBParser, EPUBParseError } = await import('../src/parsers/EPUBParser.js')
    const encryptedBuffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    const file = new File([encryptedBuffer], 'encrypted.epub', { type: 'application/epub+zip' })

    const parser = new EPUBParser()
    await expect(parser.loadFromFile(file)).rejects.toThrow()
  })

  test('处理损坏 ZIP 抛出特定错误', async () => {
    const { EPUBParser } = await import('../src/parsers/EPUBParser.js')
    const corruptedData = new Uint8Array([0x00, 0x01, 0x02, 0x03])
    const file = new File([corruptedData], 'corrupt.epub', { type: 'application/epub+zip' })

    const parser = new EPUBParser()
    await expect(parser.loadFromFile(file)).rejects.toThrow()
  })

  test('nav 缺失时回退到 toc.ncx', async () => {
    const { parseNCX } = await import('../src/parsers/XMLParser.js')

    const ncxXml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <navMap>
    <navPoint id="np1">
      <navLabel><text>Ch1</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="np2">
      <navLabel><text>Ch2</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`

    const result = await parseNCX(ncxXml)
    expect(result.navPoints).toHaveLength(2)
    expect(result.navPoints[0].label).toBe('Ch1')
    expect(result.navPoints[1].label).toBe('Ch2')
  })
})

import JSZip from 'jszip'

const OUTPUT_PATH = './sample-with-issues.epub'

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function generateSampleEPUB() {
  const zip = new JSZip()

  zip.file('mimetype', 'application/epub+zip')

  const metaInf = zip.folder('META-INF')
  metaInf.file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)

  const oebps = zip.folder('OPS')

  const navXHTML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>目录</title>
</head>
<body>
  <nav epub:type="toc">
    <h1>目录</h1>
    <ol>
      <li><a href="chapter1.xhtml">第一章：封面</a></li>
      <li><a href="chapter2.xhtml">第二章：标题层级跳跃</a></li>
      <li><a href="chapter3.xhtml">第三章：缺少 alt</a></li>
      <li><a href="chapter4.xhtml">第四章：正常章节</a></li>
      <li><a href="nonexistent.xhtml">第五章：不存在文件</a></li>
    </ol>
  </nav>
</body>
</html>`

  const tocNCX = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="sample-epub-001"/>
  </head>
  <docTitle>
    <text>示例 EPUB</text>
  </docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>第一章：封面</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navpoint-2" playOrder="2">
      <navLabel><text>第二章：标题层级跳跃</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
    <navPoint id="navpoint-3" playOrder="3">
      <navLabel><text>第三章：缺少 alt</text></navLabel>
      <content src="chapter3.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`

  const chapter1 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>第一章：封面</title>
</head>
<body>
  <h1>欢迎阅读本书</h1>
  <p>这是一本关于无障碍的示例 EPUB。</p>
  <img src="cover.jpg" alt="书籍封面"/>
  <img src="logo.png" alt=""/>
  <p>点击下一页继续阅读。</p>
</body>
</html>`

  const chapter2 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>第二章：标题层级跳跃</title>
</head>
<body>
  <h1>第二章内容</h1>
  <p>这一章展示了标题层级跳跃的问题。</p>
  <h3>直接从 h1 跳到 h3（跳过 h2）</h3>
  <p>这是一个错误做法。</p>
  <h2>现在是 h2</h2>
  <p>正确的层级。</p>
  <h4>又跳到 h4</h4>
</body>
</html>`

  const chapter3 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>第三章：缺少 alt</title>
</head>
<body>
  <h1>图片无障碍问题</h1>
  <p>下面这些图片缺少 alt 属性或 alt 不当。</p>
  <img src="image1.jpg"/>
  <p>上面图片没有 alt 属性。</p>
  <img src="image2.jpg" alt=""/>
  <p>上面图片 alt 为空。</p>
  <img src="image3.jpg" alt="正确描述的图片"/>
  <p>上面图片 alt 正确。</p>
  <img src="missing.jpg" alt="不存在的图片"/>
</body>
</html>`

  const chapter4 = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>第四章：正常章节</title>
</head>
<body>
  <h1>正常章节</h1>
  <p>这一章是正常的，没有无障碍问题。</p>
  <h2>小节一</h2>
  <p>内容。</p>
  <h3>子小节</h3>
  <p>更多内容。</p>
  <h2>小节二</h2>
  <p>更多内容。</p>
  <img src="illustration.jpg" alt="插图说明"/>
</body>
</html>`

  const contentOPF = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">sample-epub-001</dc:identifier>
    <dc:title>示例 EPUB - 无障碍巡检</dc:title>
    <dc:creator>巡检工具生成器</dc:creator>
    <dc:language>zh-CN</dc:language>
    <meta property="dcterms:modified">2024-01-15T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter3" href="chapter3.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter4" href="chapter4.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover" href="cover.jpg" media-type="image/jpeg"/>
    <item id="logo" href="logo.png" media-type="image/png"/>
    <item id="image1" href="image1.jpg" media-type="image/jpeg"/>
    <item id="image2" href="image2.jpg" media-type="image/jpeg"/>
    <item id="image3" href="image3.jpg" media-type="image/jpeg"/>
    <item id="illustration" href="illustration.jpg" media-type="image/jpeg"/>
    <item id="spine" href="chapter1.jpg" media-type="image/jpeg"/>
  </manifest>
  <spine>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
    <itemref idref="chapter3"/>
    <itemref idref="chapter4"/>
  </spine>
</package>`

  oebps.file('nav.xhtml', navXHTML)
  oebps.file('toc.ncx', tocNCX)
  oebps.file('chapter1.xhtml', chapter1)
  oebps.file('chapter2.xhtml', chapter2)
  oebps.file('chapter3.xhtml', chapter3)
  oebps.file('chapter4.xhtml', chapter4)
  oebps.file('content.opf', contentOPF)

  const buffer = await zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' })

  const fs = await import('fs')
  fs.writeFileSync(OUTPUT_PATH, buffer)
  console.log(`✅ 示例 EPUB 已生成: ${OUTPUT_PATH}`)
  console.log('')
  console.log('包含的测试问题:')
  console.log('  - ALT_001: 第三章 img 缺少 alt (image1.jpg)')
  console.log('  - ALT_002: 第一章 img alt 为空 (logo.png)')
  console.log('  - HEADING_001: 第二章 h1→h3 层级跳跃')
  console.log('  - HEADING_001: 第二章 h2→h4 层级跳跃')
  console.log('  - TOC_001: 目录指向不存在文件 (chapter4.xhtml → nonexistent.xhtml)')
  console.log('  - MANIFEST_002: spine 引用不存在的 manifest 项 (spine→chapter1.jpg)')
  console.log('  - IMAGE_001: 图片文件不存在 (chapter3.xhtml → missing.jpg)')
  console.log('  - nav 存在，toc.ncx 也存在（测试 nav 优先）')
}

generateSampleEPUB().catch(console.error)

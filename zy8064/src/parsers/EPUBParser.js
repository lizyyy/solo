import JSZip from 'jszip'
import { parseContainer, parseOPF, parseNCX } from './XMLParser.js'
import { parseHTMLForAccessibility } from './HTMLParser.js'

export class EPUBParseError extends Error {
  constructor(message, type = 'generic') {
    super(message)
    this.name = 'EPUBParseError'
    this.type = type
  }
}

export class EPUBParser {
  constructor() {
    this.zip = null
    this.files = {}
    this.opfData = null
    this.navData = null
    this.ncxData = null
    this.chapters = []
    this.manifestMap = {}
    this.spineOrder = []
  }

  async loadFromFile(file) {
    try {
      this.zip = await JSZip.loadAsync(file)
    } catch (err) {
      if (err.message.includes('encrypted') || err.message.includes('password')) {
        throw new EPUBParseError('该 EPUB 文件已加密，需要解密后才能解析', 'encrypted')
      }
      if (err.message.includes('Invalid') || err.message.includes('corrupt')) {
        throw new EPUBParseError('该文件不是有效的 ZIP/EPUB 格式，可能已损坏', 'corrupt')
      }
      throw new EPUBParseError(`无法解压文件: ${err.message}`, 'zip_error')
    }

    const containerEntry = this.zip.file('META-INF/container.xml')
    if (!containerEntry) {
      throw new EPUBParseError('缺少 META-INF/container.xml，文件不是有效的 EPUB', 'missing_container')
    }

    await this.loadAllFiles()
  }

  async loadAllFiles() {
    const promises = []
    this.zip.forEach((path, file) => {
      if (!file.dir) {
        promises.push(
          file.async('string').then(content => {
            this.files[path] = content
          })
        )
      }
    })
    await Promise.all(promises)
  }

  async parse() {
    await this.parseContainer()
    await this.parseOPF()
    await this.parseNavigation()
    await this.parseChapters()
    return this.buildResult()
  }

  async parseContainer() {
    const containerXml = this.files['META-INF/container.xml']
    if (!containerXml) {
      throw new EPUBParseError('缺少 container.xml', 'missing_container')
    }
    this.containerData = await parseContainer(containerXml)
  }

  async parseOPF() {
    const opfPath = this.containerData.fullPath
    const opfXml = this.files[opfPath]
    if (!opfXml) {
      throw new EPUBParseError(`找不到 OPF 文件: ${opfPath}`, 'missing_opf')
    }

    this.opfData = await parseOPF(opfXml)
    this.opfPath = opfPath

    for (const item of this.opfData.manifest) {
      this.manifestMap[item.id] = item
    }

    this.spineOrder = this.opfData.spine.map(ref => ref.idref)
  }

  async parseNavigation() {
    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1)

    let navItem = this.opfData.manifest.find(item =>
      item.properties?.includes('nav') || item.href?.includes('nav')
    )

    if (navItem) {
      const navPath = opfDir + navItem.href
      const normalizedPath = this.normalizePath(navPath)
      const navXml = this.files[normalizedPath]
      if (navXml) {
        this.navData = await this.parseNavXHTML(navXml)
      }
    } else {
      const navPath = opfDir + 'nav.xhtml'
      const normalizedPath = this.normalizePath(navPath)
      if (this.files[normalizedPath]) {
        const navXml = this.files[normalizedPath]
        this.navData = await this.parseNavXHTML(navXml)
      }
    }

    let ncxItem = this.opfData.manifest.find(item =>
      item.mediaType === 'application/x-dtbncx+xml' || item.href?.endsWith('.ncx')
    )

    if (!ncxItem) {
      const ncxPath = opfDir + 'toc.ncx'
      const normalizedPath = this.normalizePath(ncxPath)
      if (this.files[normalizedPath]) {
        const ncxXml = this.files[normalizedPath]
        this.ncxData = await parseNCX(ncxXml)
      }
    } else {
      const ncxPath = opfDir + ncxItem.href
      const normalizedPath = this.normalizePath(ncxPath)
      const ncxXml = this.files[normalizedPath]
      if (ncxXml) {
        this.ncxData = await parseNCX(ncxXml)
      }
    }

    if (!this.navData && !this.ncxData) {
      throw new EPUBParseError('既找不到 nav.xhtml (EPUB 3.0) 也找不到 toc.ncx (EPUB 2.0)', 'missing_nav_ncx')
    }
  }

  async parseNavXHTML(navXml) {
    const parser = new DOMParser()
    const doc = parser.parseFromString(navXml, 'application/xhtml+xml')
    const nav = doc.querySelector('nav[epub:type="toc"]') || doc.querySelector('nav')

    if (!nav) return { navPoints: [] }

    const navPoints = []
    const processList = (list, depth = 0) => {
      const items = list.querySelectorAll('li')
      for (const item of items) {
        const link = item.querySelector('a[href]')
        if (link) {
          const href = link.getAttribute('href') || ''
          const text = link.textContent?.trim() || ''
          navPoints.push({ id: `nav-${navPoints.length}`, label: text, src: href, depth })
        }
        const subList = item.querySelector('ol, ul')
        if (subList) {
          processList(subList, depth + 1)
        }
      }
    }

    const ol = nav.querySelector('ol')
    if (ol) processList(ol)

    return { navPoints }
  }

  async parseChapters() {
    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1)

    this.chapters = []

    for (const idref of this.spineOrder) {
      const manifestItem = this.manifestMap[idref]
      if (!manifestItem) {
        this.chapters.push({
          id: idref,
          href: '',
          title: `未知章节 (${idref})`,
          content: null,
          accessibility: { images: [], headings: [], links: [] },
          error: `spine 引用了 manifest 中不存在的 id: ${idref}`
        })
        continue
      }

      const chapterPath = this.normalizePath(opfDir + manifestItem.href)
      const chapterHtml = this.files[chapterPath]

      if (!chapterHtml) {
        this.chapters.push({
          id: idref,
          href: manifestItem.href,
          title: manifestItem.href,
          content: null,
          accessibility: { images: [], headings: [], links: [] },
          error: `找不到文件: ${manifestItem.href}`
        })
        continue
      }

      const accessibility = parseHTMLForAccessibility(chapterHtml, chapterPath)

      const title = accessibility.headings.find(h => h.level === 1)?.text ||
        manifestItem.href.split('/').pop()

      this.chapters.push({
        id: idref,
        href: manifestItem.href,
        title: title,
        content: chapterHtml,
        accessibility
      })
    }
  }

  normalizePath(path) {
    const parts = path.split('/')
    const normalized = []
    for (const part of parts) {
      if (part === '..') {
        normalized.pop()
      } else if (part !== '.' && part !== '') {
        normalized.push(part)
      }
    }
    return normalized.join('/')
  }

  buildResult() {
    const tocNavPoints = this.navData?.navPoints || this.ncxData?.navPoints || []

    return {
      metadata: this.opfData.metadata,
      manifest: this.opfData.manifest,
      manifestMap: this.manifestMap,
      spine: this.opfData.spine,
      chapters: this.chapters,
      toc: tocNavPoints.map(np => ({
        id: np.id,
        label: np.label,
        src: np.src,
        depth: np.depth
      })),
      files: this.files,
      warnings: this.collectWarnings()
    }
  }

  collectWarnings() {
    const warnings = []
    const seen = new Set()

    for (const item of this.opfData.manifest) {
      if (seen.has(item.id)) {
        warnings.push({ type: 'MANIFEST_001', message: `manifest 重复 id: ${item.id}`, item })
      }
      seen.add(item.id)
    }

    const manifestIds = new Set(this.opfData.manifest.map(i => i.id))
    for (const ref of this.opfData.spine) {
      if (!manifestIds.has(ref.idref)) {
        warnings.push({ type: 'MANIFEST_002', message: `spine 引用不存在的 manifest id: ${ref.idref}`, ref })
      }
    }

    const opfDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1)

    for (const np of (this.navData?.navPoints || this.ncxData?.navPoints || [])) {
      if (np.src) {
        const targetPath = this.normalizePath(opfDir + np.src.split('#')[0])
        if (!this.files[targetPath]) {
          warnings.push({ type: 'TOC_001', message: `目录指向不存在的文件: ${np.src}`, navPoint: np })
        }
      }
    }

    for (const item of this.opfData.manifest) {
      if (item.mediaType?.startsWith('image/')) {
        const imgPath = this.normalizePath(opfDir + item.href)
        if (!this.files[imgPath]) {
          warnings.push({ type: 'IMAGE_001', message: `图片文件不存在: ${item.href}`, item })
        }
      }
    }

    return warnings
  }
}

export async function parseEPUB(file) {
  const parser = new EPUBParser()
  await parser.loadFromFile(file)
  return parser.parse()
}

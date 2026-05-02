import { checkAltRules } from '../src/rules/altRules.js'
import { checkHeadingRules } from '../src/rules/headingRules.js'
import { checkManifestRules } from '../src/rules/manifestRules.js'
import { Rules } from '../src/rules/index.js'

describe('altRules', () => {
  test('检测缺少 alt 属性的图片', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [
          { src: 'img1.jpg', alt: null, hasAlt: false, altIsEmpty: false },
          { src: 'img2.jpg', alt: 'description', hasAlt: true, altIsEmpty: false }
        ],
        headings: [],
        links: []
      }
    }

    const issues = checkAltRules(chapter, 'ch1')
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe(Rules.ALT_001)
    expect(issues[0].details.src).toBe('img1.jpg')
  })

  test('检测 alt 为空字符串的图片', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [
          { src: 'logo.png', alt: '', hasAlt: true, altIsEmpty: true }
        ],
        headings: [],
        links: []
      }
    }

    const issues = checkAltRules(chapter, 'ch1')
    expect(issues).toHaveLength(1)
    expect(issues[0].rule).toBe(Rules.ALT_002)
  })

  test('正常图片不产生问题', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [
          { src: 'img1.jpg', alt: 'description', hasAlt: true, altIsEmpty: false }
        ],
        headings: [],
        links: []
      }
    }

    const issues = checkAltRules(chapter, 'ch1')
    expect(issues).toHaveLength(0)
  })
})

describe('headingRules', () => {
  test('检测标题层级跳跃 (h1→h3)', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [],
        headings: [
          { tag: 'h1', level: 1, text: 'Chapter 1' },
          { tag: 'h3', level: 3, text: 'Section 1.1' }
        ],
        links: []
      }
    }

    const issues = checkHeadingRules(chapter, 'ch1')
    expect(issues.some(i => i.rule === Rules.HEADING_001)).toBe(true)
    const headingIssue = issues.find(i => i.rule === Rules.HEADING_001)
    expect(headingIssue.details.from).toBe('h1')
    expect(headingIssue.details.to).toBe('h3')
  })

  test('检测连续的标题层级跳跃 (h2→h4)', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [],
        headings: [
          { tag: 'h1', level: 1, text: 'Chapter 1' },
          { tag: 'h2', level: 2, text: 'Section 1' },
          { tag: 'h4', level: 4, text: 'SubSubSection' }
        ],
        links: []
      }
    }

    const issues = checkHeadingRules(chapter, 'ch1')
    expect(issues.some(i => i.rule === Rules.HEADING_001)).toBe(true)
  })

  test('正常层级不产生问题', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [],
        headings: [
          { tag: 'h1', level: 1, text: 'Chapter 1' },
          { tag: 'h2', level: 2, text: 'Section 1.1' },
          { tag: 'h3', level: 3, text: 'SubSection 1.1.1' }
        ],
        links: []
      }
    }

    const issues = checkHeadingRules(chapter, 'ch1')
    expect(issues.filter(i => i.rule === Rules.HEADING_001)).toHaveLength(0)
  })

  test('检测缺少中间层级', () => {
    const chapter = {
      id: 'ch1',
      title: 'Test Chapter',
      accessibility: {
        images: [],
        headings: [
          { tag: 'h1', level: 1, text: 'Chapter 1' },
          { tag: 'h3', level: 3, text: 'Section 1.1' }
        ],
        links: []
      }
    }

    const issues = checkHeadingRules(chapter, 'ch1')
    expect(issues.some(i => i.rule === Rules.HEADING_002)).toBe(true)
  })
})

describe('manifestRules', () => {
  test('检测 manifest 重复 id', () => {
    const parsedData = {
      manifest: [
        { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'ch1', href: 'chapter1-alt.xhtml', mediaType: 'application/xhtml+xml' },
        { id: 'ch2', href: 'chapter2.xhtml', mediaType: 'application/xhtml+xml' }
      ],
      spine: [
        { idref: 'ch1' },
        { idref: 'ch2' }
      ],
      manifestMap: {},
      files: {},
      opfPath: 'OEBPS/content.opf'
    }

    const issues = checkManifestRules(parsedData)
    expect(issues.some(i => i.rule === Rules.MANIFEST_001)).toBe(true)
  })

  test('检测 spine 引用不存在的 manifest 项', () => {
    const parsedData = {
      manifest: [
        { id: 'ch1', href: 'chapter1.xhtml', mediaType: 'application/xhtml+xml' }
      ],
      spine: [
        { idref: 'ch1' },
        { idref: 'nonexistent' }
      ],
      manifestMap: { ch1: { id: 'ch1', href: 'chapter1.xhtml' } },
      files: {},
      opfPath: 'OEBPS/content.opf'
    }

    const issues = checkManifestRules(parsedData)
    expect(issues.some(i => i.rule === Rules.MANIFEST_002)).toBe(true)
  })
})

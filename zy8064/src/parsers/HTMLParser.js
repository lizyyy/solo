export function parseHTMLForAccessibility(htmlString, baseHref = '') {
  const parser = new DOMParser()
  const doc = parser.parseFromString(htmlString, 'text/html')

  const images = []
  const headings = []
  const links = []

  const imgs = doc.querySelectorAll('img')
  for (const img of imgs) {
    const src = img.getAttribute('src') || ''
    const alt = img.getAttribute('alt')
    const ariaLabel = img.getAttribute('aria-label')
    images.push({
      src: src,
      alt: alt,
      ariaLabel: ariaLabel,
      hasAlt: alt !== null,
      altIsEmpty: alt === '',
      fullyDecorated: alt !== null && alt !== ''
    })
  }

  const headingTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
  for (const tag of headingTags) {
    const els = doc.querySelectorAll(tag)
    for (const el of els) {
      const level = parseInt(tag[1])
      const text = el.textContent?.trim() || ''
      headings.push({
        tag: tag,
        level: level,
        text: text,
        id: el.id || null,
        className: el.className || ''
      })
    }
  }

  const anchors = doc.querySelectorAll('a[href]')
  for (const a of anchors) {
    const href = a.getAttribute('href') || ''
    const text = a.textContent?.trim() || ''
    links.push({
      href: href,
      text: text,
      isExternal: href.startsWith('http') || href.startsWith('//')
    })
  }

  return { images, headings, links, doc }
}

export function detectHeadingHierarchy(headings) {
  const issues = []
  const sorted = [...headings].sort((a, b) => a.level - b.level)

  let lastLevel = 0
  for (const h of sorted) {
    if (lastLevel > 0 && h.level - lastLevel > 1) {
      issues.push({
        rule: 'HEADING_001',
        from: `h${lastLevel}`,
        to: `h${h.level}`,
        text: h.text.substring(0, 50)
      })
    }
    lastLevel = h.level
  }

  return issues
}

export function extractTextContent(element) {
  if (!element) return ''
  return element.textContent?.trim() || ''
}

import { parseString } from 'xml2js'

export function parseXML(xmlString) {
  return new Promise((resolve, reject) => {
    parseString(xmlString, { explicitArray: false, mergeAttrs: true }, (err, result) => {
      if (err) reject(err)
      else resolve(result)
    })
  })
}

export function parseContainer(xmlString) {
  return parseXML(xmlString).then(doc => {
    const root = doc.container
    const rootfile = root.rootfiles?.rootfile
    if (!rootfile) throw new Error('container.xml: 缺少 rootfile 元素')
    return {
      fullPath: rootfile['full-path'],
      mediaType: rootfile['media-type']
    }
  })
}

export function parseOPF(xmlString) {
  return parseXML(xmlString).then(doc => {
    const pkg = doc.package
    if (!pkg) throw new Error('OPF: 缺少 package 元素')

    const metadata = pkg.metadata || {}
    const manifest = pkg.manifest || {}
    const spine = pkg.spine || {}

    const items = []
    if (manifest.item) {
      const manifestItems = Array.isArray(manifest.item) ? manifest.item : [manifest.item]
      for (const item of manifestItems) {
        items.push({
          id: item.id,
          href: item.href,
          mediaType: item['media-type'],
          properties: item.properties
        })
      }
    }

    const itemrefs = []
    if (spine.itemref) {
      const refs = Array.isArray(spine.itemref) ? spine.itemref : [spine.itemref]
      for (const ref of refs) {
        itemrefs.push({
          idref: ref.idref,
          linear: ref.linear
        })
      }
    }

    return {
      metadata: {
        title: metadata['dc:title'] || metadata.title || '',
        creator: metadata['dc:creator'] || metadata.creator || '',
        language: metadata['dc:language'] || metadata.language || 'en',
        identifier: metadata['dc:identifier'] || metadata.identifier || ''
      },
      manifest: items,
      spine: itemrefs
    }
  })
}

export function parseNCX(xmlString) {
  return parseXML(xmlString).then(doc => {
    const ncx = doc.ncx
    if (!ncx) throw new Error('NCX: 缺少 ncx 元素')

    const navMap = ncx.navMap
    if (!navMap) return { navPoints: [] }

    const navPoints = []
    function extractNavPoints(navList, depth = 0) {
      if (!navList) return
      const items = Array.isArray(navList) ? navList : [navList]
      for (const item of items) {
        navPoints.push({
          id: item.id,
          label: item.navLabel?.text || '',
          src: item.content?.src || '',
          depth
        })
        if (item.navPoint) {
          extractNavPoints(item.navPoint, depth + 1)
        }
      }
    }

    extractNavPoints(navMap.navPoint)

    return { navPoints }
  })
}

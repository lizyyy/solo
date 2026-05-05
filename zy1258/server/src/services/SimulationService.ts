import { PrismaClient, ReleaseBatch, Resource, HitChain, PurgeEvent, DebugTask } from '@prisma/client'
import { SimulationConfig, RiskResult } from '../types'
import prisma from '../prisma'
import { v4 as uuidv4 } from 'uuid'

export class SimulationService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  async simulateCanaryRelease(
    oldBatchId: string,
    newBatchId: string,
    parameters: {
      canaryPercentage: number
      affectedEdgeNodes: string[]
      durationMinutes: number
    }
  ): Promise<{ hitChains: HitChain[]; risks: RiskResult[] }> {
    const { canaryPercentage, affectedEdgeNodes, durationMinutes } = parameters

    const oldBatch = await this.prisma.releaseBatch.findUnique({
      where: { id: oldBatchId },
      include: { resources: true }
    })
    const newBatch = await this.prisma.releaseBatch.findUnique({
      where: { id: newBatchId },
      include: { resources: true }
    })

    if (!oldBatch || !newBatch) {
      throw new Error('Release batch not found')
    }

    const hitChains: HitChain[] = []
    const risks: RiskResult[] = []
    const allResources = [...oldBatch.resources, ...newBatch.resources]

    const baseTime = Date.now()
    const edgeNodes = affectedEdgeNodes || ['node-hkg-001', 'node-sgp-001', 'node-tok-001']

    for (let i = 0; i < 100; i++) {
      const isNewVersion = Math.random() * 100 < canaryPercentage
      const batch = isNewVersion ? newBatch : oldBatch
      const resource = batch.resources[Math.floor(Math.random() * batch.resources.length)]
      const edgeNode = edgeNodes[Math.floor(Math.random() * edgeNodes.length)]

      const requestTime = new Date(baseTime + Math.random() * durationMinutes * 60 * 1000)
      const cacheStatus = this.getRandomCacheStatus(isNewVersion, canaryPercentage)
      const age = cacheStatus === 'HIT' ? Math.floor(Math.random() * 3600) : 0

      const hitChain = await this.prisma.hitChain.create({
        data: {
          requestId: uuidv4(),
          url: resource.path,
          method: 'GET',
          statusCode: 200,
          edgeNodeId: edgeNode,
          cacheStatus: cacheStatus,
          cacheHitMiss: cacheStatus === 'HIT' ? 'HIT' : 'MISS',
          age: age,
          requestTime: requestTime,
          clientIp: this.generateRandomIp(),
          userAgent: this.generateRandomUserAgent(),
          releaseBatchId: batch.id,
          resourceId: resource.id
        }
      })
      hitChains.push(hitChain)
    }

    risks.push(...this.detectCanaryRisks(hitChains, oldBatch, newBatch, canaryPercentage))

    return { hitChains, risks }
  }

  async simulateRollback(
    newBatchId: string,
    oldBatchId: string,
    parameters: {
      rollbackTime: string
      missingResources: string[]
      browserCacheDuration: number
    }
  ): Promise<{ hitChains: HitChain[]; risks: RiskResult[] }> {
    const { rollbackTime, missingResources, browserCacheDuration } = parameters

    const oldBatch = await this.prisma.releaseBatch.findUnique({
      where: { id: oldBatchId },
      include: { resources: true }
    })
    const newBatch = await this.prisma.releaseBatch.findUnique({
      where: { id: newBatchId },
      include: { resources: true }
    })

    if (!oldBatch || !newBatch) {
      throw new Error('Release batch not found')
    }

    const hitChains: HitChain[] = []
    const risks: RiskResult[] = []
    const rollbackTimestamp = new Date(rollbackTime).getTime()

    for (let i = 0; i < 50; i++) {
      const isBeforeRollback = Math.random() > 0.5
      const requestTime = new Date(
        isBeforeRollback
          ? rollbackTimestamp - Math.random() * 3600000
          : rollbackTimestamp + Math.random() * browserCacheDuration * 1000
      )

      const batch = isBeforeRollback ? newBatch : oldBatch
      const resource = batch.resources[Math.floor(Math.random() * batch.resources.length)]

      const isMissingResource = missingResources.some(missing =>
        resource.path.includes(missing)
      )

      let statusCode = 200
      let cacheStatus: any = 'HIT'

      if (isMissingResource && !isBeforeRollback) {
        statusCode = 404
        cacheStatus = 'MISS'
      } else if (!isBeforeRollback && Math.random() > 0.7) {
        cacheStatus = 'STALE'
      }

      const hitChain = await this.prisma.hitChain.create({
        data: {
          requestId: uuidv4(),
          url: resource.path,
          method: 'GET',
          statusCode: statusCode,
          edgeNodeId: ['node-hkg-001', 'node-sgp-001'][Math.floor(Math.random() * 2)],
          cacheStatus: cacheStatus,
          cacheHitMiss: cacheStatus === 'HIT' ? 'HIT' : 'MISS',
          age: cacheStatus === 'HIT' ? Math.floor(Math.random() * 3600) : 0,
          requestTime: requestTime,
          clientIp: this.generateRandomIp(),
          userAgent: this.generateRandomUserAgent(),
          releaseBatchId: batch.id,
          resourceId: resource.id
        }
      })
      hitChains.push(hitChain)
    }

    risks.push(...this.detectRollbackRisks(hitChains, missingResources, newBatch, oldBatch))

    return { hitChains, risks }
  }

  async simulateSWResidue(
    oldBatchId: string,
    newBatchId: string,
    parameters: {
      swVersion: string
      cachedUrls: string[]
      updateFrequency: number
    }
  ): Promise<{ hitChains: HitChain[]; risks: RiskResult[] }> {
    const { swVersion, cachedUrls, updateFrequency } = parameters

    const oldBatch = await this.prisma.releaseBatch.findUnique({
      where: { id: oldBatchId },
      include: { resources: true }
    })
    const newBatch = await this.prisma.releaseBatch.findUnique({
      where: { id: newBatchId },
      include: { resources: true }
    })

    if (!oldBatch || !newBatch) {
      throw new Error('Release batch not found')
    }

    const hitChains: HitChain[] = []
    const risks: RiskResult[] = []
    const baseTime = Date.now()

    for (let i = 0; i < 60; i++) {
      const usesSWCache = Math.random() > updateFrequency
      const requestTime = new Date(baseTime - Math.random() * 24 * 3600000)

      let batch: ReleaseBatch
      let resource: Resource
      let cacheStatus: any = 'HIT'

      if (usesSWCache) {
        const oldResource = oldBatch.resources[Math.floor(Math.random() * oldBatch.resources.length)]
        batch = oldBatch
        resource = oldResource
        cacheStatus = 'STALE'
      } else {
        const newResource = newBatch.resources[Math.floor(Math.random() * newBatch.resources.length)]
        batch = newBatch
        resource = newResource
        cacheStatus = 'MISS'
      }

      const hitChain = await this.prisma.hitChain.create({
        data: {
          requestId: uuidv4(),
          url: resource.path,
          method: 'GET',
          statusCode: 200,
          edgeNodeId: ['node-hkg-001'][0],
          cacheStatus: cacheStatus,
          cacheHitMiss: cacheStatus === 'HIT' ? 'HIT' : 'MISS',
          age: Math.floor(Math.random() * 86400),
          requestTime: requestTime,
          clientIp: this.generateRandomIp(),
          userAgent: this.generateRandomUserAgent() + ` (SW/${swVersion})`,
          releaseBatchId: batch.id,
          resourceId: resource.id
        }
      })
      hitChains.push(hitChain)
    }

    risks.push(...this.detectSWRisks(hitChains, oldBatch, newBatch, cachedUrls))

    return { hitChains, risks }
  }

  async simulatePurgeMiss(
    batchId: string,
    parameters: {
      purgeUrls: string[]
      skippedEdgeNodes: string[]
      missedUrls: string[]
    }
  ): Promise<{ hitChains: HitChain[]; risks: RiskResult[] }> {
    const { purgeUrls, skippedEdgeNodes, missedUrls } = parameters

    const batch = await this.prisma.releaseBatch.findUnique({
      where: { id: batchId },
      include: { resources: true }
    })

    if (!batch) {
      throw new Error('Release batch not found')
    }

    await this.prisma.purgeEvent.create({
      data: {
        purgeId: uuidv4(),
        action: 'invalidate',
        urls: purgeUrls,
        status: 'completed',
        createdAt: new Date(Date.now() - 3600000),
        completedAt: new Date(),
        edgeNodes: [
          { id: 'node-hkg-001', location: 'Hong Kong', status: 'purged' },
          ...skippedEdgeNodes.map(id => ({ id, location: id, status: 'skipped' as const }))
        ],
        skippedNodes: skippedEdgeNodes,
        releaseBatchId: batchId
      }
    })

    const hitChains: HitChain[] = []
    const risks: RiskResult[] = []
    const allEdgeNodes = ['node-hkg-001', 'node-sgp-001', 'node-tok-001']

    for (let i = 0; i < 80; i++) {
      const resource = batch.resources[Math.floor(Math.random() * batch.resources.length)]
      const edgeNode = allEdgeNodes[Math.floor(Math.random() * allEdgeNodes.length)]

      const isMissedPurge = missedUrls.some(url => resource.path.includes(url)) ||
        skippedEdgeNodes.includes(edgeNode)

      let cacheStatus: any = 'MISS'
      let age = 0

      if (isMissedPurge) {
        cacheStatus = 'HIT'
        age = Math.floor(Math.random() * 86400)
      }

      const hitChain = await this.prisma.hitChain.create({
        data: {
          requestId: uuidv4(),
          url: resource.path,
          method: 'GET',
          statusCode: 200,
          edgeNodeId: edgeNode,
          cacheStatus: cacheStatus,
          cacheHitMiss: cacheStatus === 'HIT' ? 'HIT' : 'MISS',
          age: age,
          requestTime: new Date(),
          clientIp: this.generateRandomIp(),
          userAgent: this.generateRandomUserAgent(),
          releaseBatchId: batch.id,
          resourceId: resource.id
        }
      })
      hitChains.push(hitChain)
    }

    risks.push(...this.detectPurgeMissRisks(hitChains, skippedEdgeNodes, missedUrls))

    return { hitChains, risks }
  }

  private getRandomCacheStatus(isNewVersion: boolean, canaryPercentage: number): string {
    if (isNewVersion && Math.random() > 0.5) {
      return 'MISS'
    }
    const rand = Math.random()
    if (rand < 0.6) return 'HIT'
    if (rand < 0.8) return 'EXPIRED'
    return 'STALE'
  }

  private generateRandomIp(): string {
    return [
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255)
    ].join('.')
  }

  private generateRandomUserAgent(): string {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    ]
    return agents[Math.floor(Math.random() * agents.length)]
  }

  private detectCanaryRisks(
    hitChains: HitChain[],
    oldBatch: ReleaseBatch & { resources: Resource[] },
    newBatch: ReleaseBatch & { resources: Resource[] },
    canaryPercentage: number
  ): RiskResult[] {
    const risks: RiskResult[] = []

    const oldVersionUrls = hitChains
      .filter(h => h.releaseBatchId === oldBatch.id)
      .map(h => h.url)
    const newVersionUrls = hitChains
      .filter(h => h.releaseBatchId === newBatch.id)
      .map(h => h.url)

    const htmlEntries = [...oldBatch.resources, ...newBatch.resources].filter(r => r.type === 'html')
    const jsEntries = [...oldBatch.resources, ...newBatch.resources].filter(r => r.type === 'javascript')

    for (const html of htmlEntries) {
      for (const js of jsEntries) {
        const htmlUsesOld = html.releaseBatchId === oldBatch.id
        const jsUsesNew = js.releaseBatchId === newBatch.id

        if (htmlUsesOld && jsUsesNew) {
          risks.push({
            type: 'OLD_HTML_NEW_JS',
            severity: 'critical',
            title: '旧 HTML 引用新 JS',
            description: `HTML 版本 ${oldBatch.version} 的页面可能引用了 JS 版本 ${newBatch.version} 的资源，导致版本不兼容`,
            affectedUrls: [html.path, js.path],
            evidence: {
              htmlVersion: oldBatch.version,
              jsVersion: newBatch.version,
              htmlHash: html.hash,
              jsHash: js.hash
            },
            suggestion: '检查 HTML 中的资源引用，确保 HTML 和引用的 JS/CSS 来自同一版本'
          })
        }
      }
    }

    const actualCanaryPercentage = (newVersionUrls.length / hitChains.length) * 100
    if (Math.abs(actualCanaryPercentage - canaryPercentage) > 10) {
      risks.push({
        type: 'CANARY_DISTRIBUTION_ISSUE',
        severity: 'high',
        title: '灰度分发异常',
        description: `实际灰度比例 ${actualCanaryPercentage.toFixed(1)}% 与配置的 ${canaryPercentage}% 差异较大`,
        affectedUrls: [...new Set([...oldVersionUrls, ...newVersionUrls])],
        evidence: {
          expected: canaryPercentage,
          actual: actualCanaryPercentage,
          oldVersionCount: oldVersionUrls.length,
          newVersionCount: newVersionUrls.length
        },
        suggestion: '检查 CDN 灰度配置和边缘节点同步状态'
      })
    }

    return risks
  }

  private detectRollbackRisks(
    hitChains: HitChain[],
    missingResources: string[],
    newBatch: ReleaseBatch,
    oldBatch: ReleaseBatch
  ): RiskResult[] {
    const risks: RiskResult[] = []

    const rollbackHits = hitChains.filter(h => h.releaseBatchId === oldBatch.id)
    const newVersionHits = hitChains.filter(h => h.releaseBatchId === newBatch.id)

    const missingResourceHits = rollbackHits.filter(h =>
      missingResources.some(missing => h.url?.includes(missing))
    )

    if (missingResourceHits.length > 0) {
      risks.push({
        type: 'ROLLBACK_MISSING_RESOURCES',
        severity: 'critical',
        title: '回滚资源缺失',
        description: `回滚到旧版本 ${oldBatch.version} 时，部分资源不存在`,
        affectedUrls: [...new Set(missingResourceHits.map(h => h.url!))],
        evidence: {
          oldVersion: oldBatch.version,
          newVersion: newBatch.version,
          missingResources: missingResources,
          hitCount: missingResourceHits.length
        },
        suggestion: '确保回滚时旧版本的所有资源仍然可用，或在回滚前预部署旧版本资源'
      })
    }

    const staleHits = hitChains.filter(h => h.cacheStatus === 'STALE')
    if (staleHits.length > 0) {
      risks.push({
        type: 'NEW_HTML_OLD_CSS',
        severity: 'high',
        title: '浏览器缓存污染',
        description: `检测到 STALE 缓存命中，可能是浏览器或 CDN 缓存了新版本 HTML 但仍使用旧版本 CSS/JS`,
        affectedUrls: [...new Set(staleHits.map(h => h.url!))],
        evidence: {
          staleHitCount: staleHits.length,
          affectedEdgeNodes: [...new Set(staleHits.map(h => h.edgeNodeId!))]
        },
        suggestion: '检查 Service Worker 缓存策略，确保资源版本一致性；考虑使用强制刷新或 purge 操作'
      })
    }

    return risks
  }

  private detectSWRisks(
    hitChains: HitChain[],
    oldBatch: ReleaseBatch,
    newBatch: ReleaseBatch,
    cachedUrls: string[]
  ): RiskResult[] {
    const risks: RiskResult[] = []

    const staleHits = hitChains.filter(h => h.cacheStatus === 'STALE')
    const swHits = hitChains.filter(h => h.userAgent?.includes('SW/'))

    if (staleHits.length > 0 && swHits.length > 0) {
      risks.push({
        type: 'SW_CACHE_RESIDUE',
        severity: 'critical',
        title: 'Service Worker 缓存残留',
        description: '检测到 Service Worker 缓存了旧版本资源，即使服务器已更新，用户仍可能看到旧版本',
        affectedUrls: [...new Set(staleHits.map(h => h.url!))],
        evidence: {
          staleHitCount: staleHits.length,
          swHitCount: swHits.length,
          oldVersion: oldBatch.version,
          newVersion: newBatch.version,
          cachedUrls: cachedUrls
        },
        suggestion: '更新 Service Worker 的缓存版本号，添加版本校验逻辑，或使用 skipWaiting 强制更新'
      })
    }

    return risks
  }

  private detectPurgeMissRisks(
    hitChains: HitChain[],
    skippedEdgeNodes: string[],
    missedUrls: string[]
  ): RiskResult[] {
    const risks: RiskResult[] = []

    const skippedNodeHits = hitChains.filter(h =>
      skippedEdgeNodes.includes(h.edgeNodeId || '') && h.cacheStatus === 'HIT'
    )

    if (skippedNodeHits.length > 0) {
      risks.push({
        type: 'PURGE_SKIPPED_NODES',
        severity: 'high',
        title: 'Purge 漏节点',
        description: `部分边缘节点未被 purge，仍返回旧版本缓存`,
        affectedUrls: [...new Set(skippedNodeHits.map(h => h.url!))],
        evidence: {
          skippedNodes: skippedEdgeNodes,
          hitCount: skippedNodeHits.length,
          affectedEdgeNodes: [...new Set(skippedNodeHits.map(h => h.edgeNodeId!))]
        },
        suggestion: '对遗漏的边缘节点执行单独的 purge 操作，或使用全量 purge'
      })
    }

    const missedUrlHits = hitChains.filter(h =>
      missedUrls.some(url => h.url?.includes(url)) && h.cacheStatus === 'HIT'
    )

    if (missedUrlHits.length > 0) {
      risks.push({
        type: 'PURGE_MISSED_URLS',
        severity: 'critical',
        title: 'Purge 漏 URL',
        description: '部分 URL 未被包含在 purge 列表中，用户仍获取到旧版本资源',
        affectedUrls: [...new Set(missedUrlHits.map(h => h.url!))],
        evidence: {
          missedUrls: missedUrls,
          hitCount: missedUrlHits.length,
          purgeList: '需要补充这些 URL 到 purge 列表'
        },
        suggestion: '检查 manifest 中的所有资源路径，确保关键资源（HTML、入口 JS）都被 purge'
      })
    }

    return risks
  }
}

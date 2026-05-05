import { PrismaClient, ReleaseBatch, Resource, HitChain, AnomalyUser, PurgeEvent, DebugTask, Risk } from '@prisma/client'
import { RiskResult } from '../types'
import prisma from '../prisma'
import { jsonStringify } from '../utils/json'

export class RiskDetectionService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  async detectAllRisks(batchId: string): Promise<RiskResult[]> {
    const batch = await this.prisma.releaseBatch.findUnique({
      where: { id: batchId },
      include: {
        resources: true,
        hitChains: true,
        anomalyUsers: true,
        purgeEvents: true
      }
    })

    if (!batch) {
      throw new Error('Release batch not found')
    }

    const risks: RiskResult[] = []

    risks.push(...this.detectVersionMismatch(batch))
    risks.push(...this.detectCacheStaleness(batch))
    risks.push(...this.detectHtmlJsMismatch(batch))
    risks.push(...this.detectResourceMissing(batch))
    risks.push(...this.detectPurgeIssues(batch))
    risks.push(...this.detectAnomalyPatterns(batch))

    return risks
  }

  private detectVersionMismatch(batch: ReleaseBatch & {
    resources: Resource[]
    hitChains: HitChain[]
  }): RiskResult[] {
    const risks: RiskResult[] = []
    const { hitChains, resources } = batch

    const urlToHash: Map<string, string> = new Map()
    resources.forEach(r => {
      urlToHash.set(r.path, r.hash)
    })

    const hashPatterns = new Map<string, Set<string>>()

    hitChains.forEach(hit => {
      const url = hit.url || ''
      const hashMatch = url.match(/[.-]([a-f0-9]{8,20})\./)

      if (hashMatch) {
        const hash = hashMatch[1]
        const baseUrl = url.replace(/[.-][a-f0-9]{8,20}\./, '.')

        if (!hashPatterns.has(baseUrl)) {
          hashPatterns.set(baseUrl, new Set())
        }
        hashPatterns.get(baseUrl)!.add(hash)
      }
    })

    hashPatterns.forEach((hashes, baseUrl) => {
      if (hashes.size > 1) {
        risks.push({
          type: 'MULTIPLE_HASHES_SAME_RESOURCE',
          severity: 'high',
          title: '同一资源存在多个版本',
          description: `URL 基础路径 ${baseUrl} 检测到 ${hashes.size} 个不同的 hash 版本，可能是 CDN 缓存混版`,
          affectedUrls: [baseUrl],
          evidence: {
            baseUrl: baseUrl,
            hashes: Array.from(hashes),
            hashCount: hashes.size
          },
          suggestion: '执行全量 purge 操作，确认最新版本资源已部署到所有边缘节点'
        })
      }
    })

    return risks
  }

  private detectCacheStaleness(batch: ReleaseBatch & {
    resources: Resource[]
    hitChains: HitChain[]
  }): RiskResult[] {
    const risks: RiskResult[] = []
    const { hitChains } = batch

    const staleHits = hitChains.filter(h =>
      h.cacheStatus === 'STALE' || h.cacheStatus === 'EXPIRED'
    )

    if (staleHits.length > 0) {
      const staleByEdgeNode = new Map<string, number>()
      staleHits.forEach(hit => {
        const node = hit.edgeNodeId || 'unknown'
        staleByEdgeNode.set(node, (staleByEdgeNode.get(node) || 0) + 1)
      })

      risks.push({
        type: 'STALE_CACHE_HITS',
        severity: staleHits.length > hitChains.length * 0.1 ? 'critical' : 'medium',
        title: '过期缓存命中',
        description: `检测到 ${staleHits.length} 次过期缓存命中（STALE/EXPIRED），占总请求的 ${((staleHits.length / hitChains.length) * 100).toFixed(1)}%`,
        affectedUrls: [...new Set(staleHits.map(h => h.url!))],
        evidence: {
          staleHitCount: staleHits.length,
          totalHitCount: hitChains.length,
          byEdgeNode: Object.fromEntries(staleByEdgeNode)
        },
        suggestion: '检查缓存 TTL 配置，考虑缩短关键资源的缓存时间，或使用更强的 purge 策略'
      })
    }

    return risks
  }

  private detectHtmlJsMismatch(batch: ReleaseBatch & {
    resources: Resource[]
    hitChains: HitChain[]
  }): RiskResult[] {
    const risks: RiskResult[] = []
    const { resources, hitChains } = batch

    const htmlResources = resources.filter(r => r.type === 'html')
    const jsResources = resources.filter(r => r.type === 'javascript')

    const htmlHashes = new Set(htmlResources.map(r => r.hash))
    const jsHashes = new Set(jsResources.map(r => r.hash))

    const htmlHits = hitChains.filter(h =>
      h.url?.endsWith('.html') || h.url?.includes('/index')
    )
    const jsHits = hitChains.filter(h =>
      h.url?.endsWith('.js') || h.url?.includes('.js?')
    )

    const htmlHashCounts = new Map<string, number>()
    const jsHashCounts = new Map<string, number>()

    htmlHits.forEach(hit => {
      const url = hit.url || ''
      const hashMatch = url.match(/[.-]([a-f0-9]{8,20})\./)
      if (hashMatch) {
        const hash = hashMatch[1]
        htmlHashCounts.set(hash, (htmlHashCounts.get(hash) || 0) + 1)
      }
    })

    jsHits.forEach(hit => {
      const url = hit.url || ''
      const hashMatch = url.match(/[.-]([a-f0-9]{8,20})\./)
      if (hashMatch) {
        const hash = hashMatch[1]
        jsHashCounts.set(hash, (jsHashCounts.get(hash) || 0) + 1)
      }
    })

    const dominantHtmlHash = this.getDominantHash(htmlHashCounts)
    const dominantJsHash = this.getDominantHash(jsHashCounts)

    if (dominantHtmlHash && dominantJsHash) {
      const htmlJsPairs = this.analyzeRequestPairs(htmlHits, jsHits)

      const mismatchedPairs = htmlJsPairs.filter(pair => {
        const htmlHash = pair.htmlUrl?.match(/[.-]([a-f0-9]{8,20})\./)?.[1]
        const jsHash = pair.jsUrl?.match(/[.-]([a-f0-9]{8,20})\./)?.[1]
        return htmlHash && jsHash && htmlHash !== jsHash
      })

      if (mismatchedPairs.length > 0) {
        risks.push({
          type: 'HTML_JS_VERSION_MISMATCH',
          severity: 'critical',
          title: 'HTML 与 JS 版本不匹配',
          description: `检测到 ${mismatchedPairs.length} 次请求中 HTML 和 JS 来自不同版本，这是典型的缓存混版导致白屏的原因`,
          affectedUrls: [...new Set([
            ...mismatchedPairs.map(p => p.htmlUrl),
            ...mismatchedPairs.map(p => p.jsUrl)
          ]) as string[]],
          evidence: {
            mismatchedCount: mismatchedPairs.length,
            dominantHtmlHash: dominantHtmlHash,
            dominantJsHash: dominantJsHash,
            samplePairs: mismatchedPairs.slice(0, 5)
          },
          suggestion: '这是高风险情况！需要立即：1) 检查最新的 HTML 和资源是否引用了正确的 hash；2) 执行全量 purge 包括 HTML 入口；3) 检查 CDN 缓存配置是否有分层缓存导致旧内容残留'
        })
      }
    }

    return risks
  }

  private detectResourceMissing(batch: ReleaseBatch & {
    resources: Resource[]
    hitChains: HitChain[]
  }): RiskResult[] {
    const risks: RiskResult[] = []
    const { hitChains } = batch

    const errorHits = hitChains.filter(h =>
      h.statusCode >= 400 && h.statusCode < 600
    )

    if (errorHits.length > 0) {
      const errorByStatus = new Map<number, number>()
      const errorUrls = new Set<string>()

      errorHits.forEach(hit => {
        errorByStatus.set(hit.statusCode, (errorByStatus.get(hit.statusCode) || 0) + 1)
        if (hit.url) errorUrls.add(hit.url)
      })

      const notFoundCount = errorByStatus.get(404) || 0

      if (notFoundCount > 0) {
        risks.push({
          type: 'MISSING_RESOURCES_404',
          severity: 'critical',
          title: '资源缺失 (404)',
          description: `检测到 ${notFoundCount} 次 404 错误，用户可能遇到白屏或功能缺失`,
          affectedUrls: [...errorUrls],
          evidence: {
            notFoundCount: notFoundCount,
            totalErrors: errorHits.length,
            errorByStatus: Object.fromEntries(errorByStatus)
          },
          suggestion: '检查缺失的资源是否在新版本中被删除或重命名，确保回滚时旧版本资源仍然可用'
        })
      }
    }

    return risks
  }

  private detectPurgeIssues(batch: ReleaseBatch & {
    resources: Resource[]
    hitChains: HitChain[]
    purgeEvents: PurgeEvent[]
  }): RiskResult[] {
    const risks: RiskResult[] = []
    const { purgeEvents, hitChains } = batch

    if (purgeEvents.length > 0) {
      const latestPurge = purgeEvents.reduce((latest, current) =>
        new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest
      )

      if (latestPurge.skippedNodes && latestPurge.skippedNodes.length > 0) {
        const skippedNodeHits = hitChains.filter(h =>
          latestPurge.skippedNodes?.includes(h.edgeNodeId || '')
        )

        if (skippedNodeHits.length > 0) {
          risks.push({
            type: 'PURGE_SKIPPED_NODES_STILL_SERVING',
            severity: 'high',
            title: '跳过的边缘节点仍在提供旧缓存',
            description: `Purge 操作跳过了 ${latestPurge.skippedNodes.length} 个节点，这些节点仍在处理 ${skippedNodeHits.length} 次请求`,
            affectedUrls: [...new Set(skippedNodeHits.map(h => h.url!))],
            evidence: {
              skippedNodes: latestPurge.skippedNodes,
              hitCount: skippedNodeHits.length,
              latestPurgeTime: latestPurge.createdAt
            },
            suggestion: '对跳过的节点执行单独的 purge 操作，或联系 CDN 服务商确认这些节点的状态'
          })
        }
      }

      const hitsAfterPurge = hitChains.filter(h =>
        new Date(h.requestTime || 0) > new Date(latestPurge.createdAt)
      )

      const cacheHitsAfterPurge = hitsAfterPurge.filter(h => h.cacheStatus === 'HIT')

      if (cacheHitsAfterPurge.length > hitsAfterPurge.length * 0.5) {
        risks.push({
          type: 'PURGE_NOT_EFFECTIVE',
          severity: 'medium',
          title: 'Purge 效果不明显',
          description: `Purge 后仍有 ${cacheHitsAfterPurge.length} 次缓存命中（${((cacheHitsAfterPurge.length / hitsAfterPurge.length) * 100).toFixed(1)}%），可能是 purge 不彻底或有多层缓存`,
          affectedUrls: [...new Set(cacheHitsAfterPurge.map(h => h.url!))],
          evidence: {
            hitsAfterPurge: hitsAfterPurge.length,
            cacheHitsAfterPurge: cacheHitsAfterPurge.length,
            latestPurgeTime: latestPurge.createdAt
          },
          suggestion: '考虑使用 "delete" 类型的 purge 而非 "invalidate"，或检查是否有浏览器缓存/Service Worker 缓存'
        })
      }
    }

    return risks
  }

  private detectAnomalyPatterns(batch: ReleaseBatch & {
    resources: Resource[]
    hitChains: HitChain[]
    anomalyUsers: AnomalyUser[]
  }): RiskResult[] {
    const risks: RiskResult[] = []
    const { anomalyUsers, hitChains } = batch

    if (anomalyUsers.length > 0) {
      const errorTypes = new Map<string, number>()
      anomalyUsers.forEach(user => {
        if (user.errorType) {
          errorTypes.set(user.errorType, (errorTypes.get(user.errorType) || 0) + 1)
        }
      })

      const jsErrorUsers = anomalyUsers.filter(u =>
        u.errorType === 'JS_ERROR' ||
        (u.errorMessage && (
          u.errorMessage.includes('Unexpected token') ||
          u.errorMessage.includes('is not defined') ||
          u.errorMessage.includes('is not a function') ||
          u.errorMessage.includes('Loading chunk')
        ))
      )

      if (jsErrorUsers.length > 0) {
        risks.push({
          type: 'JS_ERRORS_LIKELY_CACHE_MISMATCH',
          severity: 'critical',
          title: '疑似缓存混版导致的 JS 错误',
          description: `检测到 ${jsErrorUsers.length} 个用户遇到 JS 错误，错误模式与"旧 HTML 引用新 JS"或"新 HTML 命中旧 CSS"高度一致`,
          affectedUrls: [...new Set(
            jsErrorUsers.flatMap(u => u.affectedUrls as string[] || [])
          )],
          evidence: {
            affectedUserCount: jsErrorUsers.length,
            totalAnomalyUsers: anomalyUsers.length,
            errorTypes: Object.fromEntries(errorTypes),
            sampleErrors: jsErrorUsers.slice(0, 5).map(u => ({
              sessionId: u.sessionId,
              errorMessage: u.errorMessage,
              errorType: u.errorType
            }))
          },
          suggestion: '这是紧急情况！建议：1) 立即回滚到上一个稳定版本；2) 执行全量 purge 包括 HTML 入口；3) 检查新版本的资源引用是否正确；4) 考虑添加版本校验和降级策略'
        })
      }
    }

    return risks
  }

  private getDominantHash(hashCounts: Map<string, number>): string | null {
    if (hashCounts.size === 0) return null

    let dominantHash: string | null = null
    let maxCount = 0

    hashCounts.forEach((count, hash) => {
      if (count > maxCount) {
        maxCount = count
        dominantHash = hash
      }
    })

    return dominantHash
  }

  private analyzeRequestPairs(
    htmlHits: HitChain[],
    jsHits: HitChain[]
  ): { htmlUrl: string | null; jsUrl: string | null; timeDiff: number }[] {
    const pairs: { htmlUrl: string | null; jsUrl: string | null; timeDiff: number }[] = []

    htmlHits.forEach(htmlHit => {
      const htmlTime = new Date(htmlHit.requestTime || 0).getTime()

      const relatedJsHits = jsHits.filter(jsHit => {
        const jsTime = new Date(jsHit.requestTime || 0).getTime()
        const timeDiff = Math.abs(jsTime - htmlTime)
        return timeDiff < 5000
      })

      relatedJsHits.forEach(jsHit => {
        const jsTime = new Date(jsHit.requestTime || 0).getTime()
        pairs.push({
          htmlUrl: htmlHit.url,
          jsUrl: jsHit.url,
          timeDiff: Math.abs(jsTime - htmlTime)
        })
      })
    })

    return pairs
  }

  async saveRisks(taskId: string, risks: RiskResult[]): Promise<Risk[]> {
    const savedRisks = await Promise.all(
      risks.map(risk =>
        this.prisma.risk.create({
          data: {
            type: risk.type,
            severity: risk.severity,
            title: risk.title,
            description: risk.description,
            affectedUrls: risk.affectedUrls ? jsonStringify(risk.affectedUrls) : null,
            evidence: risk.evidence ? jsonStringify(risk.evidence) : null,
            suggestion: risk.suggestion,
            debugTaskId: taskId
          }
        })
      )
    )

    return savedRisks
  }
}

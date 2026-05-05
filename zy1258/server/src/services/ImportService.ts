import { PrismaClient, ReleaseBatch, Resource, HitChain, AnomalyUser, PurgeEvent } from '@prisma/client'
import { ManifestJson, EdgeLogEntry, PurgeEventYaml } from '../types'
import yaml from 'js-yaml'
import prisma from '../prisma'
import { jsonStringify } from '../utils/json'

export class ImportService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  async importManifest(manifestContent: string): Promise<ReleaseBatch & { resources: Resource[] }> {
    const manifest: ManifestJson = JSON.parse(manifestContent)

    const releaseBatch = await this.prisma.releaseBatch.create({
      data: {
        version: manifest.version,
        commitHash: manifest.commitHash,
        createdAt: new Date(manifest.createdAt),
        manifest: jsonStringify(manifest),
        status: 'active'
      }
    })

    const resources = await Promise.all(
      manifest.entries.map(entry =>
        this.prisma.resource.create({
          data: {
            path: entry.path,
            type: entry.type,
            hash: entry.hash,
            contentLength: entry.contentLength,
            lastModified: new Date(entry.lastModified),
            etag: entry.etag,
            releaseBatchId: releaseBatch.id
          }
        })
      )
    )

    return { ...releaseBatch, resources }
  }

  async importEdgeLogs(
    logsContent: string,
    releaseBatchId?: string
  ): Promise<HitChain[]> {
    const lines = logsContent.trim().split('\n')
    const logs: EdgeLogEntry[] = lines
      .filter(line => line.trim())
      .map(line => JSON.parse(line))

    const hitChains = await Promise.all(
      logs.map(log =>
        this.prisma.hitChain.create({
          data: {
            requestId: log.requestId,
            url: log.url,
            method: log.method,
            statusCode: log.statusCode,
            edgeNodeId: log.edgeNodeId,
            cacheStatus: log.cacheStatus,
            cacheHitMiss: log.cacheHitMiss,
            age: log.age,
            serverTiming: log.serverTiming,
            xCache: log.xCache,
            xEdgeLocation: log.xEdgeLocation,
            requestTime: new Date(log.timestamp),
            clientIp: log.clientIp,
            userAgent: log.userAgent,
            referer: log.referer,
            releaseBatchId: releaseBatchId
          }
        })
      )
    )

    return hitChains
  }

  async importPurgeEvents(
    yamlContent: string,
    releaseBatchId?: string
  ): Promise<PurgeEvent[]> {
    const events: PurgeEventYaml[] = yaml.load(yamlContent) as PurgeEventYaml[]

    const purgeEvents = await Promise.all(
      events.map(event =>
        this.prisma.purgeEvent.create({
          data: {
            purgeId: event.purgeId,
            action: event.action,
            urls: jsonStringify(event.urls),
            surrogateKeys: event.surrogateKeys ? jsonStringify(event.surrogateKeys) : null,
            status: event.status,
            createdAt: new Date(event.createdAt),
            completedAt: event.completedAt ? new Date(event.completedAt) : null,
            edgeNodes: event.edgeNodes ? jsonStringify(event.edgeNodes) : null,
            skippedNodes: event.skippedNodes ? jsonStringify(event.skippedNodes) : null,
            releaseBatchId: releaseBatchId
          }
        })
      )
    )

    return purgeEvents
  }

  async detectAnomalyUsers(
    releaseBatchId: string
  ): Promise<AnomalyUser[]> {
    const errorPatterns = [
      'Unexpected token',
      'Unexpected identifier',
      'Cannot read property',
      'is not defined',
      'is not a function',
      'Module not found',
      'Failed to fetch',
      'NetworkError',
      'Loading chunk',
      'Loading CSS chunk',
      'Failed to load resource'
    ]

    const hitChains = await this.prisma.hitChain.findMany({
      where: {
        OR: [
          { releaseBatchId: releaseBatchId },
          { releaseBatchId: null }
        ]
      },
      orderBy: { requestTime: 'desc' }
    })

    const userSessions: Map<string, any[]> = new Map()

    hitChains.forEach(hit => {
      const key = hit.clientIp || hit.userAgent || 'unknown'
      if (!userSessions.has(key)) {
        userSessions.set(key, [])
      }
      userSessions.get(key)!.push(hit)
    })

    const anomalyUsers: AnomalyUser[] = []

    for (const [sessionKey, userHits] of userSessions.entries()) {
      const errorHits = userHits.filter(hit => {
        const hasErrorStatus = hit.statusCode >= 400
        const hasErrorUrl = errorPatterns.some(pattern =>
          hit.url?.includes(pattern) || hit.userAgent?.includes(pattern)
        )
        return hasErrorStatus || hasErrorUrl
      })

      const mixedVersionHits = this.detectMixedVersions(userHits)

      if (errorHits.length > 0 || mixedVersionHits.length > 0) {
        const firstSeen = new Date(Math.min(...userHits.map(h => h.requestTime?.getTime() || Date.now())))
        const lastSeen = new Date(Math.max(...userHits.map(h => h.requestTime?.getTime() || Date.now())))

        const anomaly = await this.prisma.anomalyUser.create({
          data: {
            sessionId: sessionKey,
            clientIp: userHits[0]?.clientIp,
            userAgent: userHits[0]?.userAgent,
            firstSeen: firstSeen,
            lastSeen: lastSeen,
            errorType: errorHits.length > 0 ? 'JS_ERROR' : 'MIXED_VERSION',
            errorMessage: errorHits.length > 0 ? errorHits[0].url : 'Mixed version resources detected',
            affectedUrls: jsonStringify([...new Set([...errorHits, ...mixedVersionHits].map(h => h.url))]),
            releaseBatchId: releaseBatchId
          }
        })
        anomalyUsers.push(anomaly)
      }
    }

    return anomalyUsers
  }

  private detectMixedVersions(hits: any[]): any[] {
    const hashes = new Set<string>()
    const mixedHits: any[] = []

    hits.forEach(hit => {
      const hashMatch = hit.url?.match(/[.-]([a-f0-9]{8,20})\./)
      if (hashMatch) {
        const hash = hashMatch[1]
        if (hashes.size > 0 && !hashes.has(hash)) {
          mixedHits.push(hit)
        }
        hashes.add(hash)
      }
    })

    return mixedHits
  }
}

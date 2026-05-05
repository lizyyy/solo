import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'

const prisma = new PrismaClient()

function jsonStringify(obj: any): string {
  return JSON.stringify(obj)
}

async function main() {
  console.log('Seeding database...')

  const oldVersion = '1.0.0'
  const newVersion = '1.1.0'
  const baseTime = new Date()

  const oldBatch = await prisma.releaseBatch.create({
    data: {
      version: oldVersion,
      commitHash: 'a1b2c3d4e5f6g7h8i9j0',
      status: 'active',
      description: '稳定版本 v1.0.0 - 用于回滚测试',
      manifest: jsonStringify({
        version: oldVersion,
        commitHash: 'a1b2c3d4e5f6g7h8i9j0',
        createdAt: new Date(baseTime.getTime() - 86400000 * 3).toISOString(),
        entries: []
      })
    }
  })

  const newBatch = await prisma.releaseBatch.create({
    data: {
      version: newVersion,
      commitHash: 'z9y8x7w6v5u4t3s2r1q0',
      status: 'active',
      description: '新版本 v1.1.0 - 有缓存混版问题',
      manifest: jsonStringify({
        version: newVersion,
        commitHash: 'z9y8x7w6v5u4t3s2r1q0',
        createdAt: new Date(baseTime.getTime() - 86400000).toISOString(),
        entries: []
      })
    }
  })

  const oldResources = [
    { path: '/index.html', type: 'html', hash: 'abcdef1234', contentLength: 2048 },
    { path: '/assets/index.abcdef1234.js', type: 'javascript', hash: 'abcdef1234', contentLength: 512000 },
    { path: '/assets/vendor.1234abcdef.js', type: 'javascript', hash: '1234abcdef', contentLength: 307200 },
    { path: '/assets/style.abcdef1234.css', type: 'css', hash: 'abcdef1234', contentLength: 102400 },
    { path: '/assets/logo.png', type: 'image', hash: 'fedcba4321', contentLength: 51200 }
  ]

  const newResources = [
    { path: '/index.html', type: 'html', hash: 'xyz9876543', contentLength: 2100 },
    { path: '/assets/index.xyz9876543.js', type: 'javascript', hash: 'xyz9876543', contentLength: 520000 },
    { path: '/assets/vendor.6543xyz987.js', type: 'javascript', hash: '6543xyz987', contentLength: 310000 },
    { path: '/assets/style.xyz9876543.css', type: 'css', hash: 'xyz9876543', contentLength: 105000 },
    { path: '/assets/logo.png', type: 'image', hash: 'fedcba4321', contentLength: 51200 }
  ]

  for (const resource of oldResources) {
    await prisma.resource.create({
      data: {
        ...resource,
        lastModified: new Date(baseTime.getTime() - 86400000 * 3),
        etag: `W/"${resource.hash}"`,
        releaseBatchId: oldBatch.id
      }
    })
  }

  for (const resource of newResources) {
    await prisma.resource.create({
      data: {
        ...resource,
        lastModified: new Date(baseTime.getTime() - 86400000),
        etag: `W/"${resource.hash}"`,
        releaseBatchId: newBatch.id
      }
    })
  }

  const edgeNodes = ['node-hkg-001', 'node-sgp-001', 'node-tok-001', 'node-nyc-001']
  const cacheStatuses = ['HIT', 'MISS', 'STALE', 'EXPIRED']
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36'
  ]

  for (let i = 0; i < 50; i++) {
    const useOldVersion = Math.random() > 0.3
    const batch = useOldVersion ? oldBatch : newBatch
    const resources = useOldVersion ? oldResources : newResources
    const resource = resources[Math.floor(Math.random() * resources.length)]

    const isMixedCase = i < 15
    const actualVersion = isMixedCase ? (Math.random() > 0.5 ? oldVersion : newVersion) : (useOldVersion ? oldVersion : newVersion)

    const edgeNode = edgeNodes[Math.floor(Math.random() * edgeNodes.length)]
    const isSkippedNode = edgeNode === 'node-tok-001'
    const cacheStatus = isSkippedNode && isMixedCase ? 'HIT' : cacheStatuses[Math.floor(Math.random() * cacheStatuses.length)]

    await prisma.hitChain.create({
      data: {
        requestId: uuidv4(),
        url: resource.path,
        method: 'GET',
        statusCode: isMixedCase && resource.type === 'javascript' ? (Math.random() > 0.7 ? 404 : 200) : 200,
        edgeNodeId: edgeNode,
        cacheStatus: cacheStatus,
        cacheHitMiss: cacheStatus === 'HIT' ? 'HIT' : 'MISS',
        age: cacheStatus === 'HIT' ? Math.floor(Math.random() * 3600) : 0,
        xCache: `${edgeNode} ${cacheStatus}`,
        xEdgeLocation: edgeNode.split('-')[1].toUpperCase(),
        requestTime: new Date(baseTime.getTime() - Math.random() * 3600000),
        clientIp: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
        releaseBatchId: batch.id
      }
    })
  }

  await prisma.purgeEvent.create({
    data: {
      purgeId: uuidv4(),
      action: 'invalidate',
      urls: jsonStringify(['/index.html', '/assets/*']),
      status: 'completed',
      createdAt: new Date(baseTime.getTime() - 7200000),
      completedAt: new Date(baseTime.getTime() - 7100000),
      edgeNodes: jsonStringify([
        { id: 'node-hkg-001', location: 'Hong Kong', status: 'purged' },
        { id: 'node-sgp-001', location: 'Singapore', status: 'purged' },
        { id: 'node-tok-001', location: 'Tokyo', status: 'skipped' },
        { id: 'node-nyc-001', location: 'New York', status: 'purged' }
      ]),
      skippedNodes: jsonStringify(['node-tok-001']),
      releaseBatchId: newBatch.id
    }
  })

  const anomalySessions = [
    {
      errorType: 'JS_ERROR',
      errorMessage: 'Unexpected token \'<\' in JSON at position 0',
      affectedUrls: ['/assets/index.xyz9876543.js', '/index.html']
    },
    {
      errorType: 'JS_ERROR',
      errorMessage: 'Loading chunk 123 failed',
      affectedUrls: ['/assets/vendor.6543xyz987.js']
    },
    {
      errorType: 'MIXED_VERSION',
      errorMessage: 'Mixed version resources detected',
      affectedUrls: ['/index.html', '/assets/index.abcdef1234.js']
    }
  ]

  for (const session of anomalySessions) {
    await prisma.anomalyUser.create({
      data: {
        sessionId: uuidv4(),
        clientIp: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
        firstSeen: new Date(baseTime.getTime() - Math.random() * 3600000),
        lastSeen: new Date(baseTime.getTime() - Math.random() * 1800000),
        errorType: session.errorType,
        errorMessage: session.errorMessage,
        affectedUrls: jsonStringify(session.affectedUrls),
        releaseBatchId: newBatch.id
      }
    })
  }

  console.log('Database seeded successfully!')
  console.log(`Old batch: ${oldBatch.id} (v${oldVersion})`)
  console.log(`New batch: ${newBatch.id} (v${newVersion})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

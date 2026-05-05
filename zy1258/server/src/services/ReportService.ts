import { PrismaClient, ReleaseBatch, Resource, HitChain, AnomalyUser, PurgeEvent, DebugTask, Risk } from '@prisma/client'
import prisma from '../prisma'
import { jsonParse } from '../utils/json'

export class ReportService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }

  async exportMarkdown(taskId: string): Promise<string> {
    const task = await this.prisma.debugTask.findUnique({
      where: { id: taskId },
      include: {
        releaseBatches: {
          include: {
            resources: true,
            hitChains: true,
            anomalyUsers: true,
            purgeEvents: true
          }
        },
        risks: true
      }
    })

    if (!task) {
      throw new Error('Debug task not found')
    }

    let md = `# CDN 缓存混版排查报告

> 任务 ID: ${task.id}
> 任务名称: ${task.name}
> 任务类型: ${task.type}
> 状态: ${task.status}
> 创建时间: ${task.createdAt.toISOString()}
> 开始时间: ${task.startedAt?.toISOString() || '-'}
> 完成时间: ${task.completedAt?.toISOString() || '-'}

---

## 执行结论

${task.conclusion || '*暂无结论*'}

---

## 风险分析

共检测到 **${task.risks.length}** 个风险问题

`

    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    }

    const sortedRisks = [...task.risks].sort((a, b) => {
      return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99)
    })

    const severityLabels: Record<string, string> = {
      critical: '🔴 严重',
      high: '🟠 高危',
      medium: '🟡 中等',
      low: '🟢 低危'
    }

    sortedRisks.forEach((risk, index) => {
      const affectedUrls = jsonParse<string[]>(risk.affectedUrls, [])
      const evidence = jsonParse<any>(risk.evidence, {})
      
      md += `
### ${index + 1}. ${risk.title}

**级别**: ${severityLabels[risk.severity] || risk.severity}
**类型**: ${risk.type}

**描述**:
${risk.description}

**受影响 URL**:
${affectedUrls.length > 0 ? affectedUrls.map(url => `- ${url}`).join('\n') : '*无*'}

**证据**:
\`\`\`json
${JSON.stringify(evidence, null, 2)}
\`\`\`

${risk.suggestion ? `**建议**: ${risk.suggestion}` : ''}

---
`
    })

    md += `
## 发布批次详情

`

    task.releaseBatches.forEach(batch => {
      md += `
### 版本 ${batch.version}

- **状态**: ${batch.status}
- **创建时间**: ${batch.createdAt.toISOString()}
- **提交哈希**: ${batch.commitHash || '-'}
- **描述**: ${batch.description || '-'}

#### 资源统计
- HTML 资源: ${batch.resources.filter(r => r.type === 'html').length} 个
- JavaScript 资源: ${batch.resources.filter(r => r.type === 'javascript').length} 个
- CSS 资源: ${batch.resources.filter(r => r.type === 'css').length} 个
- 其他资源: ${batch.resources.filter(r => !['html', 'javascript', 'css'].includes(r.type)).length} 个

#### 边缘日志统计
- 总请求数: ${batch.hitChains.length}
- 缓存命中 (HIT): ${batch.hitChains.filter(h => h.cacheStatus === 'HIT').length}
- 缓存未命中 (MISS): ${batch.hitChains.filter(h => h.cacheStatus === 'MISS').length}
- 过期缓存 (STALE/EXPIRED): ${batch.hitChains.filter(h => h.cacheStatus === 'STALE' || h.cacheStatus === 'EXPIRED').length}

#### 异常用户
- 异常用户数: ${batch.anomalyUsers.length}

#### Purge 记录
- Purge 次数: ${batch.purgeEvents.length}

`
    })

    const snapshot = jsonParse<any>(task.snapshot, null)
    if (snapshot) {
      md += `
---

## 执行快照

\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`
`
    }

    return md
  }

  async exportJson(taskId: string): Promise<string> {
    const task = await this.prisma.debugTask.findUnique({
      where: { id: taskId },
      include: {
        releaseBatches: {
          include: {
            resources: true,
            hitChains: true,
            anomalyUsers: true,
            purgeEvents: true
          }
        },
        risks: true
      }
    })

    if (!task) {
      throw new Error('Debug task not found')
    }

    const exportData = {
      task: {
        id: task.id,
        name: task.name,
        type: task.type,
        status: task.status,
        conclusion: task.conclusion,
        snapshot: jsonParse<any>(task.snapshot, null),
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt
      },
      risks: task.risks.map(r => ({
        id: r.id,
        type: r.type,
        severity: r.severity,
        title: r.title,
        description: r.description,
        affectedUrls: jsonParse<string[]>(r.affectedUrls, []),
        evidence: jsonParse<any>(r.evidence, {}),
        suggestion: r.suggestion,
        createdAt: r.createdAt
      })),
      releaseBatches: task.releaseBatches.map(batch => ({
        id: batch.id,
        version: batch.version,
        commitHash: batch.commitHash,
        status: batch.status,
        description: batch.description,
        createdAt: batch.createdAt,
        resources: batch.resources.map(r => ({
          path: r.path,
          type: r.type,
          hash: r.hash,
          contentLength: r.contentLength,
          etag: r.etag
        })),
        hitChains: {
          total: batch.hitChains.length,
          byStatus: {
            HIT: batch.hitChains.filter(h => h.cacheStatus === 'HIT').length,
            MISS: batch.hitChains.filter(h => h.cacheStatus === 'MISS').length,
            STALE: batch.hitChains.filter(h => h.cacheStatus === 'STALE').length,
            EXPIRED: batch.hitChains.filter(h => h.cacheStatus === 'EXPIRED').length
          },
          byStatusCode: this.countByStatusCode(batch.hitChains)
        },
        anomalyUsers: batch.anomalyUsers.length,
        purgeEvents: batch.purgeEvents.length
      })),
      summary: {
        totalRisks: task.risks.length,
        criticalRisks: task.risks.filter(r => r.severity === 'critical').length,
        highRisks: task.risks.filter(r => r.severity === 'high').length,
        mediumRisks: task.risks.filter(r => r.severity === 'medium').length,
        lowRisks: task.risks.filter(r => r.severity === 'low').length
      }
    }

    return JSON.stringify(exportData, null, 2)
  }

  private countByStatusCode(hitChains: HitChain[]): Record<number, number> {
    const counts: Record<number, number> = {}
    hitChains.forEach(h => {
      counts[h.statusCode] = (counts[h.statusCode] || 0) + 1
    })
    return counts
  }

  async generateConclusion(risks: Risk[]): Promise<string> {
    const criticalCount = risks.filter(r => r.severity === 'critical').length
    const highCount = risks.filter(r => r.severity === 'high').length
    const mediumCount = risks.filter(r => r.severity === 'medium').length

    if (criticalCount > 0) {
      return `⚠️ **高紧急度**: 检测到 ${criticalCount} 个严重风险，建议立即回滚或执行全量 purge。

主要问题包括:
${risks.filter(r => r.severity === 'critical').map(r => `- ${r.title}`).join('\n')}

建议步骤:
1. 立即回滚到上一个稳定版本
2. 执行全量 purge 操作（包括 HTML 入口）
3. 检查新版本的资源引用是否正确
4. 验证所有边缘节点缓存已更新`
    }

    if (highCount > 0) {
      return `⚠️ **中等紧急度**: 检测到 ${highCount} 个高危风险，建议尽快处理。

主要问题包括:
${risks.filter(r => r.severity === 'high').map(r => `- ${r.title}`).join('\n')}

建议步骤:
1. 执行 targeted purge 操作
2. 检查 CDN 缓存配置
3. 监控后续请求是否恢复正常`
    }

    if (mediumCount > 0) {
      return `ℹ️ **低紧急度**: 检测到 ${mediumCount} 个中等风险，建议观察和优化。

主要问题包括:
${risks.filter(r => r.severity === 'medium').map(r => `- ${r.title}`).join('\n')}

建议步骤:
1. 优化缓存策略
2. 定期检查缓存状态
3. 考虑添加版本校验机制`
    }

    return `✅ **无风险**: 未检测到高优先级风险。系统运行正常。

建议:
- 持续监控边缘日志
- 定期检查缓存命中率
- 确保每次发布都执行正确的 purge 操作`
  }
}

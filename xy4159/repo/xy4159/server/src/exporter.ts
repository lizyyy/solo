import { ReviewCard, PullRequest, CodeLocation, Attachment, ReviewRecord, ExportMarkdownOptions, Severity, CardStatus } from '../../src/types';

export class Exporter {
  exportToMarkdown(
    pr: PullRequest,
    cards: ReviewCard[],
    options: ExportMarkdownOptions = {}
  ): string {
    const { 
      includeAttachments = false, 
      includeReviewHistory = false,
      statusFilter,
      severityFilter
    } = options;

    let filteredCards = [...cards];
    
    if (statusFilter && statusFilter.length > 0) {
      filteredCards = filteredCards.filter(c => statusFilter.includes(c.status));
    }
    
    if (severityFilter && severityFilter.length > 0) {
      filteredCards = filteredCards.filter(c => severityFilter.includes(c.severity));
    }

    const criticalCards = filteredCards.filter(c => c.severity === Severity.CRITICAL);
    const highCards = filteredCards.filter(c => c.severity === Severity.HIGH);
    const mediumCards = filteredCards.filter(c => c.severity === Severity.MEDIUM);
    const lowCards = filteredCards.filter(c => c.severity === Severity.LOW);

    const now = new Date().toISOString();
    
    let markdown = `# PR 评审摘要 - ${pr.title}\n\n`;
    markdown += `> 生成时间: ${now}\n`;
    markdown += `> 源分支: ${pr.sourceBranch || '未知'} → 目标分支: ${pr.targetBranch || '未知'}\n`;
    if (pr.author) {
      markdown += `> 作者: ${pr.author}\n`;
    }
    markdown += '\n';

    markdown += `## 统计概览\n\n`;
    markdown += `| 严重级别 | 数量 |\n`;
    markdown += `|----------|------|\n`;
    markdown += `| 🔴 Critical | ${criticalCards.length} |\n`;
    markdown += `| 🟠 High | ${highCards.length} |\n`;
    markdown += `| 🟡 Medium | ${mediumCards.length} |\n`;
    markdown += `| 🟢 Low | ${lowCards.length} |\n`;
    markdown += `| **总计** | **${filteredCards.length}** |\n\n`;

    const exportCardGroup = (title: string, cardList: ReviewCard[], emoji: string) => {
      if (cardList.length === 0) return;
      
      markdown += `## ${emoji} ${title} (${cardList.length})\n\n`;
      
      for (const card of cardList) {
        markdown += `### ${card.title}\n\n`;
        markdown += `- **状态**: ${this.statusToEmoji(card.status)} ${card.status}\n`;
        markdown += `- **创建时间**: ${card.createdAt}\n`;
        markdown += '\n';
        
        if (card.description) {
          markdown += `**描述**:\n\n`;
          markdown += `${card.description}\n\n`;
        }

        if (card.codeLocations.length > 0) {
          markdown += `**代码位置**:\n\n`;
          for (const loc of card.codeLocations) {
            markdown += `\`${loc.filePath}\`:${loc.startLine}-${loc.endLine}\n\n`;
            if (loc.contextBefore.length > 0 || loc.contextAfter.length > 0) {
              markdown += `\`\`\`\n`;
              for (const ctx of loc.contextBefore) {
                markdown += `${ctx}\n`;
              }
              markdown += `>>> ${loc.lineContent}\n`;
              for (const ctx of loc.contextAfter) {
                markdown += `${ctx}\n`;
              }
              markdown += `\`\`\`\n\n`;
            }
          }
        }

        if (includeAttachments && card.attachments.length > 0) {
          markdown += `**附件** (${card.attachments.length}):\n\n`;
          for (const att of card.attachments) {
            markdown += `- \`${att.name}\` (${att.type})\n`;
          }
          markdown += '\n';
        }

        if (includeReviewHistory && card.reviewRecords.length > 0) {
          markdown += `**评审历史**:\n\n`;
          for (const record of card.reviewRecords) {
            markdown += `- ${record.createdAt} - ${record.reviewer}: ${record.action}`;
            if (record.comment) {
              markdown += ` - ${record.comment}`;
            }
            markdown += '\n';
          }
          markdown += '\n';
        }

        markdown += '---\n\n';
      }
    };

    exportCardGroup('Critical 问题', criticalCards, '🔴');
    exportCardGroup('High 问题', highCards, '🟠');
    exportCardGroup('Medium 问题', mediumCards, '🟡');
    exportCardGroup('Low 问题', lowCards, '🟢');

    return markdown;
  }

  exportToJson(
    pr: PullRequest,
    cards: ReviewCard[],
    options: ExportMarkdownOptions = {}
  ): string {
    const { statusFilter, severityFilter } = options;

    let filteredCards = [...cards];
    
    if (statusFilter && statusFilter.length > 0) {
      filteredCards = filteredCards.filter(c => statusFilter.includes(c.status));
    }
    
    if (severityFilter && severityFilter.length > 0) {
      filteredCards = filteredCards.filter(c => severityFilter.includes(c.severity));
    }

    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      pullRequest: pr,
      statistics: {
        total: filteredCards.length,
        bySeverity: {
          critical: filteredCards.filter(c => c.severity === Severity.CRITICAL).length,
          high: filteredCards.filter(c => c.severity === Severity.HIGH).length,
          medium: filteredCards.filter(c => c.severity === Severity.MEDIUM).length,
          low: filteredCards.filter(c => c.severity === Severity.LOW).length
        },
        byStatus: {
          open: filteredCards.filter(c => c.status === CardStatus.OPEN).length,
          in_progress: filteredCards.filter(c => c.status === CardStatus.IN_PROGRESS).length,
          resolved: filteredCards.filter(c => c.status === CardStatus.RESOLVED).length,
          dismissed: filteredCards.filter(c => c.status === CardStatus.DISMISSED).length
        }
      },
      cards: filteredCards
    };

    return JSON.stringify(exportData, null, 2);
  }

  private statusToEmoji(status: CardStatus): string {
    switch (status) {
      case CardStatus.OPEN: return '🔵';
      case CardStatus.IN_PROGRESS: return '🟡';
      case CardStatus.RESOLVED: return '🟢';
      case CardStatus.DISMISSED: return '⚪';
      default: return '⚪';
    }
  }
}

export const exporter = new Exporter();

import * as dayjs from 'dayjs';
import { LostItem, ExportOptions, ItemStatus, ItemCategory } from '../../shared/types';

const STATUS_LABELS: Record<ItemStatus, string> = {
  [ItemStatus.PENDING]: '待处理',
  [ItemStatus.PROCESSING]: '处理中',
  [ItemStatus.APPROVED]: '可归还',
  [ItemStatus.NEED_PROOF]: '需补充证明',
  [ItemStatus.NEED_SUPERVISOR]: '需值班长复核',
  [ItemStatus.RETURNED]: '已归还',
  [ItemStatus.CLOSED]: '已关闭',
};

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  [ItemCategory.ELECTRONICS]: '电子设备',
  [ItemCategory.DOCUMENTS]: '证件',
  [ItemCategory.CLOTHING]: '衣物',
  [ItemCategory.BAGS]: '箱包',
  [ItemCategory.VALUABLES]: '贵重物品',
  [ItemCategory.KEYS]: '钥匙',
  [ItemCategory.OTHER]: '其他',
};

export class ExportService {
  filterItems(items: LostItem[], options: ExportOptions): LostItem[] {
    let filtered = [...items];

    if (options.stationFilter && options.stationFilter.length > 0) {
      filtered = filtered.filter((item) => options.stationFilter.includes(item.station));
    }

    if (options.statusFilter && options.statusFilter.length > 0) {
      filtered = filtered.filter((item) => options.statusFilter.includes(item.status));
    }

    if (options.dateRange) {
      filtered = filtered.filter((item) => {
        const itemDate = dayjs(item.foundTime || item.createdAt);
        const start = dayjs(options.dateRange!.start);
        const end = dayjs(options.dateRange!.end).endOf('day');
        return itemDate.isAfter(start.subtract(1, 'day')) && itemDate.isBefore(end.add(1, 'day'));
      });
    }

    return filtered;
  }

  exportToMarkdown(items: LostItem[], options: ExportOptions): string {
    const now = dayjs().format('YYYY年MM月DD日 HH:mm');
    const total = items.length;

    let md = `# 地铁失物招领交接清单\n\n`;
    md += `> 生成时间: ${now}\n`;
    md += `> 物品总数: ${total} 件\n\n`;

    if (options.stationFilter && options.stationFilter.length > 0) {
      md += `> 筛选站点: ${options.stationFilter.join(', ')}\n`;
    }
    if (options.statusFilter && options.statusFilter.length > 0) {
      md += `> 筛选状态: ${options.statusFilter.map((s) => STATUS_LABELS[s]).join(', ')}\n`;
    }
    if (options.dateRange) {
      md += `> 时间范围: ${dayjs(options.dateRange.start).format('YYYY-MM-DD')} 至 ${dayjs(options.dateRange.end).format('YYYY-MM-DD')}\n`;
    }

    md += `\n---\n\n`;

    if (items.length === 0) {
      md += `## 暂无物品记录\n`;
      return md;
    }

    const groupedByStation = this.groupByStation(items);
    const groupedByStatus = this.groupByStatus(items);

    md += `## 统计概览\n\n`;
    md += `### 按状态分布\n\n`;
    md += `| 状态 | 数量 |\n`;
    md += `|------|------|\n`;
    Object.entries(groupedByStatus).forEach(([status, count]) => {
      md += `| ${STATUS_LABELS[status as ItemStatus] || status} | ${count} |\n`;
    });
    md += `\n`;

    md += `### 按站点分布\n\n`;
    md += `| 站点 | 数量 |\n`;
    md += `|------|------|\n`;
    Object.entries(groupedByStation).forEach(([station, count]) => {
      md += `| ${station} | ${count} |\n`;
    });
    md += `\n---\n\n`;

    md += `## 物品明细\n\n`;

    const sortedItems = [...items].sort((a, b) => {
      return dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf();
    });

    sortedItems.forEach((item, index) => {
      md += `### ${index + 1}. ${item.itemCode}\n\n`;
      md += `**物品描述**: ${item.description}\n\n`;
      md += `**站点**: ${item.station}  \n`;
      md += `**类型**: ${CATEGORY_LABELS[item.category] || item.category}  \n`;
      md += `**状态**: ${STATUS_LABELS[item.status] || item.status}  \n`;
      md += `**发现时间**: ${dayjs(item.foundTime).format('YYYY-MM-DD HH:mm')}  \n`;
      md += `**发现地点**: ${item.foundLocation || '未记录'}  \n`;
      md += `**交件人**: ${item.finderName || '未记录'}  \n`;
      if (item.estimatedValue > 0) {
        md += `**预估价值**: ¥${item.estimatedValue}  \n`;
      }
      if (item.specialMarks) {
        md += `**特殊标识**: ${item.specialMarks}  \n`;
      }

      if (options.includePhotos && item.photos.length > 0) {
        md += `\n**照片**: ${item.photos.length} 张\n`;
        item.photos.forEach((photo) => {
          md += `- ${photo.fileName}`;
          if (photo.tags.length > 0) {
            md += ` (标签: ${photo.tags.join(', ')})`;
          }
          md += `\n`;
        });
      }

      if (item.claimAppointments.length > 0) {
        md += `\n**认领预约**:\n`;
        item.claimAppointments.forEach((apt) => {
          md += `- 认领人: ${apt.claimantName}`;
          if (apt.claimantContact) {
            md += ` (${apt.claimantContact})`;
          }
          md += `\n`;
          md += `  预约时间: ${dayjs(apt.appointmentTime).format('YYYY-MM-DD HH:mm')}\n`;
          if (apt.description) {
            md += `  描述: ${apt.description}\n`;
          }
        });
      }

      if (options.includeHistory && item.autoJudgeResult) {
        md += `\n**自动判断结果**:\n`;
        md += `- 可归还: ${item.autoJudgeResult.canReturn ? '是' : '否'}\n`;
        md += `- 需补充证明: ${item.autoJudgeResult.needProof ? '是' : '否'}\n`;
        md += `- 需值班长复核: ${item.autoJudgeResult.needSupervisor ? '是' : '否'}\n`;
        if (item.autoJudgeResult.reasons.length > 0) {
          md += `- 判断原因:\n`;
          item.autoJudgeResult.reasons.forEach((reason) => {
            md += `  - ${reason}\n`;
          });
        }
        if (item.autoJudgeResult.suggestedActions.length > 0) {
          md += `- 建议操作:\n`;
          item.autoJudgeResult.suggestedActions.forEach((action) => {
            md += `  - ${action}\n`;
          });
        }
      }

      if (item.manualReview) {
        md += `\n**人工复核**:\n`;
        md += `- 复核人: ${item.manualReview.reviewerName}\n`;
        md += `- 复核时间: ${dayjs(item.manualReview.reviewTime).format('YYYY-MM-DD HH:mm')}\n`;
        md += `- 最终决定: ${STATUS_LABELS[item.manualReview.finalDecision] || item.manualReview.finalDecision}\n`;
        if (item.manualReview.notes) {
          md += `- 复核备注: ${item.manualReview.notes}\n`;
        }
      }

      md += `\n---\n\n`;
    });

    md += `\n---\n\n`;
    md += `*此文档由地铁失物招领管理系统自动生成\n`;

    return md;
  }

  exportToJson(items: LostItem[], options: ExportOptions): string {
    const exportData = {
      generatedAt: new Date().toISOString(),
      total: items.length,
      filters: {
        stations: options.stationFilter || [],
        statuses: options.statusFilter || [],
        dateRange: options.dateRange || null,
      },
      items: items.map((item) => {
        const exportItem: Record<string, unknown> = {
          id: item.id,
          itemCode: item.itemCode,
          station: item.station,
          category: item.category,
          categoryLabel: CATEGORY_LABELS[item.category],
          description: item.description,
          finderName: item.finderName,
          finderContact: item.finderContact,
          foundTime: item.foundTime,
          foundLocation: item.foundLocation,
          estimatedValue: item.estimatedValue,
          specialMarks: item.specialMarks,
          status: item.status,
          statusLabel: STATUS_LABELS[item.status],
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };

        if (options.includePhotos) {
          exportItem.photos = item.photos;
        }

        if (options.includeHistory) {
          exportItem.lockerRecords = item.lockerRecords;
          exportItem.claimAppointments = item.claimAppointments;
          exportItem.autoJudgeResult = item.autoJudgeResult;
          exportItem.manualReview = item.manualReview;
        }

        return exportItem;
      }),
    };

    return JSON.stringify(exportData, null, 2);
  }

  private groupByStation(items: LostItem[]): Record<string, number> {
    const result: Record<string, number> = {};
    items.forEach((item) => {
      result[item.station] = (result[item.station] || 0) + 1;
    });
    return result;
  }

  private groupByStatus(items: LostItem[]): Record<string, number> {
    const result: Record<string, number> = {};
    items.forEach((item) => {
      result[item.status] = (result[item.status] || 0) + 1;
    });
    return result;
  }
}

import { utils, write } from 'xlsx';
import { lineChangeService } from './lineChangeService';
import { moldInspectionService } from './moldInspectionService';
import { materialKittingService } from './materialKittingService';
import { firstArticleService } from './firstArticleService';
import { missingItemService } from './missingItemService';
import { store } from '../store';

interface ExportFilter {
  responsiblePerson?: string;
  startDate?: string;
  endDate?: string;
  planId?: string;
}

export class ExportService {
  exportToExcel(filter: ExportFilter): Buffer {
    const wb = utils.book_new();

    const plansData = this.getPlansData(filter);
    const plansWs = utils.json_to_sheet(plansData);
    utils.book_append_sheet(wb, plansWs, '换线计划');

    const moldData = this.getMoldInspectionData(filter);
    const moldWs = utils.json_to_sheet(moldData);
    utils.book_append_sheet(wb, moldWs, '模具点检');

    const materialData = this.getMaterialKittingData(filter);
    const materialWs = utils.json_to_sheet(materialData);
    utils.book_append_sheet(wb, materialWs, '物料齐套');

    const firstArticleData = this.getFirstArticleData(filter);
    const firstArticleWs = utils.json_to_sheet(firstArticleData);
    utils.book_append_sheet(wb, firstArticleWs, '首件检验');

    const missingData = this.getMissingItemsData(filter);
    const missingWs = utils.json_to_sheet(missingData);
    utils.book_append_sheet(wb, missingWs, '缺项清单');

    const historyData = this.getHistoryData(filter);
    const historyWs = utils.json_to_sheet(historyData);
    utils.book_append_sheet(wb, historyWs, '状态历史');

    const changeLogData = this.getChangeLogData(filter);
    const changeLogWs = utils.json_to_sheet(changeLogData);
    utils.book_append_sheet(wb, changeLogWs, '变更记录');

    return write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  private filterByDateAndResponsible(
    item: { createdAt?: string; updatedAt?: string; responsiblePerson?: string; checkedBy?: string; reviewedBy?: string },
    filter: ExportFilter
  ): boolean {
    if (filter.responsiblePerson) {
      const persons = [item.responsiblePerson, item.checkedBy, item.reviewedBy].filter(Boolean);
      if (!persons.includes(filter.responsiblePerson)) {
        return false;
      }
    }

    if (filter.startDate || filter.endDate) {
      const dates = [item.createdAt, item.updatedAt].filter(Boolean).map(d => new Date(d!));
      if (dates.length === 0) return false;

      const itemDate = dates[0];
      if (filter.startDate && itemDate < new Date(filter.startDate)) return false;
      if (filter.endDate && itemDate > new Date(filter.endDate)) return false;
    }

    return true;
  }

  private getPlansData(filter: ExportFilter) {
    const plans = lineChangeService.getAllPlans();
    return plans
      .filter(p => this.filterByDateAndResponsible(p, filter))
      .filter(p => !filter.planId || p.id === filter.planId)
      .map(p => ({
        计划编号: p.planNo,
        产线: p.line,
        产品编码: p.productCode,
        产品名称: p.productName,
        计划开始时间: p.plannedStartTime,
        计划结束时间: p.plannedEndTime,
        实际开始时间: p.actualStartTime || '',
        实际结束时间: p.actualEndTime || '',
        状态: p.status,
        负责人: p.responsiblePerson,
        备注: p.remarks || '',
        创建时间: p.createdAt,
        更新时间: p.updatedAt,
        版本: p.version
      }));
  }

  private getMoldInspectionData(filter: ExportFilter) {
    const inspections = moldInspectionService.getAllInspections();
    const result: any[] = [];

    inspections
      .filter(i => this.filterByDateAndResponsible(i, filter))
      .filter(i => !filter.planId || i.planId === filter.planId)
      .forEach(inspection => {
        inspection.items.forEach(item => {
          result.push({
            模具编码: inspection.moldCode,
            模具名称: inspection.moldName,
            点检项目: item.name,
            标准: item.standard,
            检验结果: item.result || '',
            是否通过: item.isPassed !== undefined ? (item.isPassed ? '是' : '否') : '',
            检验人: item.checkedBy || '',
            检验时间: item.checkedAt || '',
            整体状态: inspection.status,
            复核人: inspection.reviewedBy || '',
            复核时间: inspection.reviewedAt || '',
            创建时间: inspection.createdAt
          });
        });
      });

    return result;
  }

  private getMaterialKittingData(filter: ExportFilter) {
    const kittings = materialKittingService.getAllKittings();
    const result: any[] = [];

    kittings
      .filter(k => this.filterByDateAndResponsible(k, filter))
      .filter(k => !filter.planId || k.planId === filter.planId)
      .forEach(kitting => {
        kitting.items.forEach(item => {
          result.push({
            物料编码: item.materialCode,
            物料名称: item.materialName,
            需求数量: item.requiredQty,
            实际数量: item.actualQty,
            单位: item.unit,
            库位: item.location,
            状态: item.status,
            确认人: item.checkedBy || '',
            确认时间: item.checkedAt || '',
            整体状态: kitting.status,
            复核人: kitting.reviewedBy || '',
            复核时间: kitting.reviewedAt || '',
            创建时间: kitting.createdAt
          });
        });
      });

    return result;
  }

  private getFirstArticleData(filter: ExportFilter) {
    const inspections = firstArticleService.getAllInspections();
    const result: any[] = [];

    inspections
      .filter(i => this.filterByDateAndResponsible(i, filter))
      .filter(i => !filter.planId || i.planId === filter.planId)
      .forEach(inspection => {
        inspection.items.forEach(item => {
          result.push({
            序列号: inspection.serialNo,
            检验项目: item.name,
            标准: item.standard,
            测量值: item.measuredValue || '',
            结果: item.result || '',
            是否通过: item.isPassed !== undefined ? (item.isPassed ? '是' : '否') : '',
            检验人: item.checkedBy || '',
            检验时间: item.checkedAt || '',
            整体状态: inspection.status,
            复核人: inspection.reviewedBy || '',
            复核时间: inspection.reviewedAt || '',
            创建时间: inspection.createdAt
          });
        });
      });

    return result;
  }

  private getMissingItemsData(filter: ExportFilter) {
    const items = missingItemService.getAllMissingItems();
    return items
      .filter(i => this.filterByDateAndResponsible(i, filter))
      .filter(i => !filter.planId || i.planId === filter.planId)
      .map(item => ({
        类别: item.category,
        名称: item.name,
        描述: item.description,
        负责人: item.responsiblePerson,
        截止日期: item.dueDate,
        状态: item.status,
        解决时间: item.resolvedAt || '',
        创建人: item.createdBy,
        创建时间: item.createdAt
      }));
  }

  private getHistoryData(filter: ExportFilter) {
    const histories = store.getStatusHistoriesByEntity('');
    return Array.from(store.statusHistories.values())
      .filter(h => this.filterByDateAndResponsible({ createdAt: h.createdAt, responsiblePerson: h.operator }, filter))
      .map(h => ({
        实体类型: h.entityType,
        状态: h.status,
        前状态: h.previousStatus || '',
        操作人: h.operator,
        备注: h.remark || '',
        操作时间: h.createdAt
      }));
  }

  private getChangeLogData(filter: ExportFilter) {
    return Array.from(store.changeLogs.values())
      .filter(c => this.filterByDateAndResponsible({ createdAt: c.createdAt, responsiblePerson: c.operator }, filter))
      .map(c => ({
        实体类型: c.entityType,
        字段: c.field,
        旧值: JSON.stringify(c.oldValue),
        新值: JSON.stringify(c.newValue),
        操作人: c.operator,
        操作时间: c.createdAt
      }));
  }
}

export const exportService = new ExportService();

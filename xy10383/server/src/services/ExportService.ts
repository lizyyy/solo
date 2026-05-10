import * as XLSX from 'xlsx';
import { LeadModel } from '../models/Lead';
import { SalesPersonModel } from '../models/SalesPerson';
import { 
  ILead, 
  ISalesPerson, 
  IExportLead,
  LeadStatus,
  CustomerLevel,
  AssignmentReason
} from '../types';

const STATUS_LABELS: Record<string, string> = {
  [LeadStatus.PENDING]: '待分配',
  [LeadStatus.ASSIGNED]: '已分配',
  [LeadStatus.FOLLOWING]: '跟进中',
  [LeadStatus.CONVERTED]: '已转化',
  [LeadStatus.REJECTED]: '已拒绝',
  [LeadStatus.NEEDS_REVIEW]: '待复核'
};

const LEVEL_LABELS: Record<string, string> = {
  [CustomerLevel.HIGH]: '高价值',
  [CustomerLevel.MEDIUM]: '中价值',
  [CustomerLevel.LOW]: '低价值'
};

export class ExportService {
  static async exportLeadsToExcel(filters?: any): Promise<Buffer> {
    const query: any = {};
    
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.assignedTo) {
      query.assignedTo = filters.assignedTo;
    }

    const leads = await LeadModel.find(query).sort({ createdAt: -1 }).lean() as ILead[];
    const salesPeople = await SalesPersonModel.find().lean() as ISalesPerson[];
    
    const salesMap = new Map(salesPeople.map(s => [s.id, s]));

    const exportData: IExportLead[] = leads.map(lead => {
      const salesPerson = lead.assignedTo ? salesMap.get(lead.assignedTo) : null;
      
      return {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || '',
        company: lead.company || '',
        position: lead.position || '',
        region: lead.region || '未知',
        productInterest: lead.productInterest.join('、') || '无',
        customerLevel: LEVEL_LABELS[lead.customerLevel] || lead.customerLevel,
        source: lead.source,
        status: STATUS_LABELS[lead.status] || lead.status,
        assignedTo: salesPerson ? salesPerson.name : '未分配',
        assignmentReason: lead.assignmentReason || '无',
        assignmentDetails: lead.assignmentDetails || '',
        followUpStatus: lead.followUpStatus || '无',
        isDuplicate: lead.isDuplicate ? '是' : '否',
        duplicateOf: lead.duplicateOf || '',
        createdAt: new Date(lead.createdAt).toLocaleString('zh-CN')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    const colWidths = [
      { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 20 },
      { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 10 }, { wch: 15 },
      { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 },
      { wch: 8 }, { wch: 15 }, { wch: 20 }
    ];
    worksheet['!cols'] = colWidths;

    const notesSheetData = this.getExportNotes();
    const notesWorksheet = XLSX.utils.aoa_to_sheet(notesSheetData);
    notesWorksheet['!cols'] = [{ wch: 20 }, { wch: 80 }];

    const statsSheetData = await this.getStatsSheet(salesMap);
    const statsWorksheet = XLSX.utils.aoa_to_sheet(statsSheetData);
    statsWorksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '线索数据');
    XLSX.utils.book_append_sheet(workbook, notesWorksheet, '导出口径说明');
    XLSX.utils.book_append_sheet(workbook, statsWorksheet, '销售统计');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }

  private static getExportNotes(): any[][] {
    return [
      ['字段', '说明'],
      ['线索ID', '系统唯一标识'],
      ['姓名', '联系人姓名'],
      ['手机号', '唯一标识，用于查重'],
      ['邮箱', '可选标识，用于查重'],
      ['公司', '客户公司名称'],
      ['地区', '客户所在地区，用于分配规则'],
      ['产品兴趣', '客户感兴趣的产品列表'],
      ['客户等级', '高/中/低价值客户'],
      ['来源', '线索来源渠道'],
      ['状态', '当前处理状态'],
      ['分配给', '当前负责人'],
      ['分配原因', '自动分配的判断依据'],
      ['分配详情', '分配的具体说明'],
      ['跟进状态', '销售跟进记录摘要'],
      ['是否重复', '是否被标记为重复线索'],
      ['重复关联', '合并到的线索ID'],
      ['创建时间', '线索导入时间'],
      [],
      ['【分配原因说明】'],
      [AssignmentReason.REGION_MATCH, '根据线索地区与销售负责区域匹配分配'],
      [AssignmentReason.PRODUCT_MATCH, '根据产品兴趣与销售专长匹配分配'],
      [AssignmentReason.LOAD_BALANCE, '根据当前负载均衡分配'],
      [AssignmentReason.CUSTOMER_LEVEL, '根据客户等级优先级规则分配'],
      [AssignmentReason.FALLBACK, '默认分配或手动分配'],
      [AssignmentReason.OVERLOAD, '销售负载超过上限，无法分配'],
      [AssignmentReason.VACATION, '销售休假中，无法分配'],
      [AssignmentReason.UNKNOWN_REGION, '地区信息缺失，需要人工复核'],
      [],
      ['【状态流转说明】'],
      ['待分配 → 已分配', '系统自动分配或手动分配'],
      ['已分配 → 跟进中', '销售开始跟进'],
      ['跟进中 → 已转化', '客户成功签约/下单'],
      ['跟进中 → 已拒绝', '客户明确拒绝或无效'],
      ['待复核', '需要人工介入判断']
    ];
  }

  private static async getStatsSheet(salesMap: Map<string, ISalesPerson>): Promise<any[][]> {
    const header = ['销售人员', '状态', '待跟进', '跟进中', '已转化', '已拒绝', '转化率(%)'];
    const rows: any[][] = [header];

    for (const [id, sales] of salesMap) {
      const total = sales.stats.pending + sales.stats.following + sales.stats.converted + sales.stats.rejected;
      const conversionRate = total > 0 
        ? ((sales.stats.converted / (sales.stats.following + sales.stats.converted + sales.stats.rejected)) * 100).toFixed(1)
        : 0;

      rows.push([
        sales.name,
        sales.isOnVacation ? '休假中' : '在职',
        sales.stats.pending,
        sales.stats.following,
        sales.stats.converted,
        sales.stats.rejected,
        conversionRate
      ]);
    }

    rows.push([]);
    rows.push(['【统计口径说明】']);
    rows.push(['待跟进', '已分配但未开始跟进的线索数量']);
    rows.push(['跟进中', '正在跟进中的线索数量']);
    rows.push(['已转化', '成功转化为客户的线索数量']);
    rows.push(['已拒绝', '已确认无效或拒绝的线索数量']);
    rows.push(['转化率', '已转化 / (跟进中 + 已转化 + 已拒绝) × 100%']);

    return rows;
  }
}

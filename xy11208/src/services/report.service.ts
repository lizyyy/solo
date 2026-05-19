import XLSX from 'xlsx';
import { RepairModel } from '../models/repair.model';
import { InspectionModel } from '../models/inspection.model';
import { QueryFilters } from '../types';

export class ReportService {
  static generateRepairReport(filters: QueryFilters = {}): {
    data: any[];
    summary: {
      total: number;
      pending: number;
      inProgress: number;
      completed: number;
      escalated: number;
      retestFailed: number;
    };
  } {
    const repairs = RepairModel.getAll(filters);

    const summary = {
      total: repairs.length,
      pending: repairs.filter(r => r.status === '待派单').length,
      inProgress: repairs.filter(r => r.status === '处理中').length,
      completed: repairs.filter(r => r.status === '已完成').length,
      escalated: repairs.filter(r => r.escalated).length,
      retestFailed: repairs.filter(r => r.retest_failed).length
    };

    const formattedData = repairs.map(repair => ({
      '报修ID': repair.id,
      '泵房名称': (repair as any).pump_room_name || repair.pump_room_id,
      '报修人': (repair as any).reporter_name || repair.reporter_id,
      '处理人': (repair as any).handler_name || repair.handler_id || '未派单',
      '问题描述': repair.problem_description,
      '状态': repair.status,
      '优先级': repair.priority,
      '是否超时升级': repair.escalated ? '是' : '否',
      '复测是否失败': repair.retest_failed ? '是' : '否',
      '复测备注': repair.retest_remark || '',
      '创建时间': repair.created_at,
      '截止时间': repair.due_date || '',
      '解决时间': repair.resolved_at || '',
      '解决方案': repair.resolution || ''
    }));

    return { data: formattedData, summary };
  }

  static generateInspectionReport(filters: QueryFilters = {}): {
    data: any[];
    summary: {
      total: number;
      pending: number;
      repaired: number;
      completed: number;
      hasException: number;
      needsRepair: number;
    };
  } {
    const inspections = InspectionModel.getAll(filters);

    const summary = {
      total: inspections.length,
      pending: inspections.filter(i => i.status === '待处理').length,
      repaired: inspections.filter(i => i.status === '已报修').length,
      completed: inspections.filter(i => i.status === '已完成').length,
      hasException: inspections.filter(i => i.exception_type).length,
      needsRepair: inspections.filter(i => i.is_needs_repair).length
    };

    const formattedData = inspections.map(inspection => ({
      '巡检ID': inspection.id,
      '泵房名称': (inspection as any).pump_room_name || inspection.pump_room_id,
      '巡检人': (inspection as any).inspector_name || inspection.inspector_id,
      '巡检日期': inspection.inspection_date,
      '状态': inspection.status,
      '水压': inspection.water_pressure || '',
      '水设备状态': inspection.water_equipment_status || '',
      '是否漏水': inspection.has_leakage ? '是' : '否',
      '噪音等级': inspection.noise_level || '',
      '异常类型': inspection.exception_type || '',
      '是否需要报修': inspection.is_needs_repair ? '是' : '否',
      '备注': inspection.remarks || '',
      '创建时间': inspection.created_at
    }));

    return { data: formattedData, summary };
  }

  static exportToExcel(data: any[], sheetName: string): Buffer {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  static exportRepairReportExcel(filters: QueryFilters = {}): {
    buffer: Buffer;
    summary: any;
  } {
    const { data, summary } = this.generateRepairReport(filters);

    const summaryRow = [
      { '统计项': '总数', '数值': summary.total },
      { '统计项': '待派单', '数值': summary.pending },
      { '统计项': '处理中', '数值': summary.inProgress },
      { '统计项': '已完成', '数值': summary.completed },
      { '统计项': '超时升级', '数值': summary.escalated },
      { '统计项': '复测不合格', '数值': summary.retestFailed }
    ];

    const worksheet1 = XLSX.utils.json_to_sheet(summaryRow);
    const worksheet2 = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet1, '统计汇总');
    XLSX.utils.book_append_sheet(workbook, worksheet2, '报修明细');

    return {
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      summary
    };
  }

  static exportInspectionReportExcel(filters: QueryFilters = {}): {
    buffer: Buffer;
    summary: any;
  } {
    const { data, summary } = this.generateInspectionReport(filters);

    const summaryRow = [
      { '统计项': '总数', '数值': summary.total },
      { '统计项': '待处理', '数值': summary.pending },
      { '统计项': '已报修', '数值': summary.repaired },
      { '统计项': '已完成', '数值': summary.completed },
      { '统计项': '有异常', '数值': summary.hasException },
      { '统计项': '需报修', '数值': summary.needsRepair }
    ];

    const worksheet1 = XLSX.utils.json_to_sheet(summaryRow);
    const worksheet2 = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet1, '统计汇总');
    XLSX.utils.book_append_sheet(workbook, worksheet2, '巡检明细');

    return {
      buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
      summary
    };
  }
}

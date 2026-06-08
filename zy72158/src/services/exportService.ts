import { OutdoorStall } from '@/types';
import { formatDate } from '@/utils/timeUtils';

const statusMap: Record<string, string> = {
  pending: '待审批',
  approved: '审批通过',
  rejected: '审批驳回',
  need_confirm: '需人工确认',
  legacy: '历史遗留',
};

const sourceTypeMap: Record<string, string> = {
  street_form: '街道表格',
  site_photo: '现场照片',
  approval_record: '审批记录',
  gis_legacy: 'GIS点位',
};

export function exportToCSV(stalls: OutdoorStall[]): string {
  const headers = ['序号', '商户名称', '位置', '外摆面积(㎡)', '允许面积(㎡)', '经营时间段', '审批状态', '人工备注', '创建时间', '更新时间'];
  const rows = stalls.map((stall, index) => [
    index + 1,
    stall.name,
    stall.location,
    stall.area,
    stall.maxArea,
    stall.timePeriod,
    statusMap[stall.status],
    stall.humanRemark || '',
    formatDate(stall.createdAt),
    formatDate(stall.updatedAt),
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return '\uFEFF' + csvContent;
}

export function exportPublicNotice(stalls: OutdoorStall[]): string {
  const approvedStalls = stalls.filter(s => s.status === 'approved' || s.status === 'legacy');
  const date = formatDate(new Date());
  
  let content = `
=========================================
        商业街外摆审批公示清单
=========================================

公示时间：${date}
公示单位：市政设计科
公示编号：GS-${Date.now().toString().slice(-8)}

=========================================
              审批通过清单
=========================================

`;

  approvedStalls.forEach((stall, index) => {
    content += `【${index + 1}】${stall.name}
    位置：${stall.location}
    外摆面积：${stall.area}㎡
    经营时间：${stall.timePeriod}
    审批状态：${statusMap[stall.status]}
    审批记录：
`;
    stall.approvalRecords.forEach(record => {
      content += `      • [${record.operator}] ${record.description}\n`;
    });
    content += '\n';
  });

  const needConfirm = stalls.filter(s => s.status === 'need_confirm');
  if (needConfirm.length > 0) {
    content += `
=========================================
              待人工确认清单
=========================================

`;
    needConfirm.forEach((stall, index) => {
      content += `【${index + 1}】${stall.name}
    位置：${stall.location}
    外摆面积：${stall.area}㎡
    经营时间：${stall.timePeriod}
    问题说明：
`;
      const warnings = stall.approvalRecords.filter(r => r.result === 'warning');
      warnings.forEach(record => {
        content += `      • ${record.description}\n`;
      });
      content += '\n';
    });
  }

  content += `
=========================================
              数据来源追溯
=========================================
`;

  stalls.forEach(stall => {
    content += `\n${stall.name}：\n`;
    stall.sources.forEach(source => {
      content += `  • [${sourceTypeMap[source.sourceType]}] ${source.sourceName} (${formatDate(source.importTime)})\n`;
    });
  });

  content += `
=========================================
                    备注
  本清单为系统自动生成，数据可追溯，如有疑问
  请联系市政设计师老曹。
=========================================
`;

  return content;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToJSON(stalls: OutdoorStall[]): string {
  return JSON.stringify(stalls, null, 2);
}

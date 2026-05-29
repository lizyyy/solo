import type { BorrowRecord, DamageRecord, AnomalyItem, Prop } from '@/types';

export function generateCSVReport(
  props: Prop[],
  records: BorrowRecord[],
  damages: DamageRecord[],
  anomalies: AnomalyItem[]
): string {
  const headers = [
    '道具名称',
    '道具编号',
    '分类',
    '存放位置',
    '场次',
    '借用人',
    '借出时间',
    '预计返库时间',
    '实际返库时间',
    '状态',
    '录入类型',
    '原始借出时间',
    '原始返库时间',
    '是否补录',
    '是否撤回',
    '损伤描述',
    '损伤已确认',
    '异常信息',
  ];

  const rows = records.map((r) => {
    const prop = props.find((p) => p.id === r.propId);
    const dmg = damages.filter((d) => d.borrowRecordId === r.id);
    const anom = anomalies.filter((a) => a.borrowRecordId === r.id && !a.resolved);

    return [
      prop?.name || '',
      prop?.code || '',
      prop?.category || '',
      prop?.location || '',
      r.sceneNumber,
      r.borrower,
      r.borrowTime ? new Date(r.borrowTime).toLocaleString() : '',
      r.expectedReturnTime ? new Date(r.expectedReturnTime).toLocaleString() : '',
      r.actualReturnTime ? new Date(r.actualReturnTime).toLocaleString() : '',
      statusLabel(r.status),
      entryTypeLabel(r.entryType),
      r.originalBorrowTime ? new Date(r.originalBorrowTime).toLocaleString() : '',
      r.originalReturnTime ? new Date(r.originalReturnTime).toLocaleString() : '',
      r.isSupplemented ? '是' : '否',
      r.isWithdrawn ? '是' : '否',
      dmg.map((d) => d.description).join('; '),
      dmg.every((d) => d.confirmed) ? (dmg.length > 0 ? '是' : '') : dmg.length > 0 ? '否' : '',
      anom.map((a) => a.message).join('; '),
    ].map(escapeCSV);
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function generateJSONReport(
  props: Prop[],
  records: BorrowRecord[],
  damages: DamageRecord[],
  anomalies: AnomalyItem[]
): string {
  const enrichedRecords = records.map((r) => {
    const prop = props.find((p) => p.id === r.propId);
    const dmg = damages.filter((d) => d.borrowRecordId === r.id);
    const anom = anomalies.filter((a) => a.borrowRecordId === r.id && !a.resolved);

    return {
      prop: prop ? { name: prop.name, code: prop.code, category: prop.category } : null,
      record: {
        ...r,
        statusLabel: statusLabel(r.status),
        entryTypeLabel: entryTypeLabel(r.entryType),
      },
      damages: dmg,
      anomalies: anom,
    };
  });

  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRecords: records.length,
        byStatus: {
          borrowed: records.filter((r) => r.status === 'borrowed').length,
          returned: records.filter((r) => r.status === 'returned').length,
          on_stage: records.filter((r) => r.status === 'on_stage').length,
          pending_review: records.filter((r) => r.status === 'pending_review').length,
        },
        totalAnomalies: anomalies.filter((a) => !a.resolved).length,
        totalUnconfirmedDamages: damages.filter((d) => !d.confirmed).length,
      },
      records: enrichedRecords,
    },
    null,
    2
  );
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    borrowed: '借出',
    returned: '已返库',
    on_stage: '舞台上',
    pending_review: '待复核',
  };
  return map[s] || s;
}

export function entryTypeLabel(e: string): string {
  const map: Record<string, string> = {
    normal: '正常录入',
    supplement: '补录',
    withdrawn: '已撤回',
  };
  return map[e] || e;
}

export function anomalyTypeLabel(t: string): string {
  const map: Record<string, string> = {
    duplicate_borrow: '重复借出',
    unconfirmed_damage: '损伤未确认',
    late_return: '返库超时',
    pending_review: '待复核',
  };
  return map[t] || t;
}

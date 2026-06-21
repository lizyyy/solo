import { AnomalyItem, AnomalyType, LabRecord, RecordStatus } from '../types';

const OUTLIER_CRITERION =
  '任一检测指标超出该指标正常参考范围，或指标数值偏离同期其他采样点均值超过 2 倍标准差。离群值不可直接删除，需人工核实采样环境、仪器状态与操作记录后再决定。';

const DUPLICATE_CRITERION =
  '同一采样瓶编号（bottleNo）在结果表中出现多次。可能原因：录入重复、同瓶分样标注遗漏、或瓶号书写冲突。会影响所有重复记录的指标汇总，需人工确认归属。';

const INCOMPLETE_CRITERION =
  '材料清单（采样瓶标签、现场记录表、GPS定位记录、水质检测原始数据、样品交接单、冷藏运输记录）任一项缺失。缺材料的记录数据不可采信，需退回补齐。';

const NORMAL_CRITERION =
  '所有检测指标在正常范围内，采样瓶编号唯一，材料齐全，可直接纳入统计口径。';

export const OUTLIER_SUGGESTION =
  '请核对采样当天气象/海况记录、仪器校准证书、采样员现场记录；若确认为真实异常值则保留并标注，若为操作失误则退回重测。';

export const DUPLICATE_SUGGESTION =
  '请联系实验室确认瓶号对应关系；如为录入重复请删除冗余记录，如为同瓶分样请补充子样标识，如为瓶号冲突请重编瓶号并在备注中说明。';

export const INCOMPLETE_SUGGESTION =
  '请退回采样组补填缺失材料；补齐后重新提交复核，未补齐前该记录不进入统计。';

export function isOutOfRange(record: LabRecord): boolean {
  return record.indicators.some(
    (ind) => ind.value < ind.normalRange[0] || ind.value > ind.normalRange[1]
  );
}

export function detectOutlierIndicators(record: LabRecord): string[] {
  return record.indicators
    .filter((ind) => ind.value < ind.normalRange[0] || ind.value > ind.normalRange[1])
    .map((ind) => ind.name);
}

export function detectDuplicates(records: LabRecord[]): Map<string, LabRecord[]> {
  const map = new Map<string, LabRecord[]>();
  records.forEach((r) => {
    const list = map.get(r.bottleNo) ?? [];
    list.push(r);
    map.set(r.bottleNo, list);
  });
  for (const [k, v] of Array.from(map.entries())) {
    if (v.length <= 1) map.delete(k);
  }
  return map;
}

export function detectIncomplete(record: LabRecord): string[] {
  return record.materialMissing ?? [];
}

export function buildAnomalies(records: LabRecord[]): AnomalyItem[] {
  const items: AnomalyItem[] = [];
  const duplicates = detectDuplicates(records);
  const dupAffected = new Map<string, string[]>();
  duplicates.forEach((list) => {
    const ids = list.map((r) => r.id);
    list.forEach((r) => dupAffected.set(r.id, ids.filter((id) => id !== r.id)));
  });

  records.forEach((r) => {
    if (r.detectedAnomalies.includes('outlier') || isOutOfRange(r)) {
      const badIndicators = detectOutlierIndicators(r);
      items.push({
        id: `anom-outlier-${r.id}`,
        recordId: r.id,
        record: r,
        type: 'outlier',
        criterion: OUTLIER_CRITERION,
        description: `指标 ${badIndicators.join('、')} 超出正常参考范围，疑似离群噪声但不直接删除。`,
        affectedRecordIds: [],
        suggestion: OUTLIER_SUGGESTION
      });
    }

    if (dupAffected.has(r.id)) {
      const affected = dupAffected.get(r.id) ?? [];
      items.push({
        id: `anom-dup-${r.id}`,
        recordId: r.id,
        record: r,
        type: 'duplicate_bottle',
        criterion: DUPLICATE_CRITERION,
        description: `采样瓶编号 ${r.bottleNo} 与其他记录冲突，暂不给出最终统计数。`,
        affectedRecordIds: affected,
        affectedRecords: records.filter((x) => affected.includes(x.id)),
        suggestion: DUPLICATE_SUGGESTION
      });
    }

    const missing = detectIncomplete(r);
    if (missing.length > 0) {
      items.push({
        id: `anom-mat-${r.id}`,
        recordId: r.id,
        record: r,
        type: 'incomplete_material',
        criterion: INCOMPLETE_CRITERION,
        description: `缺失材料：${missing.join('、')}。`,
        affectedRecordIds: [],
        suggestion: INCOMPLETE_SUGGESTION
      });
    }
  });

  return items;
}

export const ANOMALY_TYPE_LABEL: Record<AnomalyType, string> = {
  outlier: '离群值',
  duplicate_bottle: '采样瓶重复',
  incomplete_material: '材料不齐整',
  normal: '正常'
};

export const ANOMALY_TYPE_COLOR: Record<AnomalyType, string> = {
  outlier: '#fa8c16',
  duplicate_bottle: '#d4380d',
  incomplete_material: '#d48806',
  normal: '#389e0d'
};

export const STATUS_LABEL: Record<RecordStatus, string> = {
  confirmed: '已确认',
  pending: '待补件',
  returned: '退回'
};

export const STATUS_COLOR: Record<RecordStatus, string> = {
  confirmed: 'green',
  pending: 'gold',
  returned: 'red'
};

export { NORMAL_CRITERION, OUTLIER_CRITERION, DUPLICATE_CRITERION, INCOMPLETE_CRITERION };

import type { TimelineRecord, Artwork, ChangeType } from '../data/types';

const MATERIAL_KEYWORDS = ['补充', '补全', '说明', '附件', '添加', '备注'];
const CONCLUSION_KEYWORDS = ['修改', '调整', '变更', '重设', '移动', '改为', '更新'];
const CORE_FIELDS = ['位置', '尺寸', '灯光', '方案', '区域', '编号', '说明', '学术'];

export function judgeChangeType(
  noteRecord: TimelineRecord,
  inventoryRecords: TimelineRecord[],
  artwork: Artwork
): { type: ChangeType; reason: string } {
  const inventoryRecord = inventoryRecords.find(r => r.artworkId === artwork.id);
  const noteTime = noteRecord.timestamp;
  const inventoryTime = inventoryRecord?.timestamp;

  const isAfterInventory = inventoryTime ? noteTime > inventoryTime : true;
  const content = noteRecord.content;

  const hasMaterialKeyword = MATERIAL_KEYWORDS.some(kw => content.includes(kw));
  const hasConclusionKeyword = CONCLUSION_KEYWORDS.some(kw => content.includes(kw));
  const hasCoreField = CORE_FIELDS.some(field => content.includes(field));

  if (hasConclusionKeyword && hasCoreField) {
    const matchedKeyword = CONCLUSION_KEYWORDS.find(kw => content.includes(kw));
    const matchedField = CORE_FIELDS.find(f => content.includes(f));
    return {
      type: 'conclusion-change',
      reason: `内容包含「${matchedKeyword}」+「${matchedField}」关键词组合，判定为核心结论变更。` +
              (isAfterInventory ? ` 策展备注时间晚于作品清单，变更有效。` : ` 注意：策展备注时间早于作品清单，请确认时序。`)
    };
  }

  if (hasMaterialKeyword || (isAfterInventory && !hasConclusionKeyword)) {
    const matchedKeyword = MATERIAL_KEYWORDS.find(kw => content.includes(kw)) || '补充材料';
    return {
      type: 'material-only',
      reason: `内容包含「${matchedKeyword}」，未涉及核心字段变更，判定为补材料。` +
              (isAfterInventory ? ` 时间晚于作品清单，属于后续补充。` : ` 时间早于作品清单，属于预先说明。`)
    };
  }

  return {
    type: 'material-only',
    reason: '未检测到明确的结论变更关键词，默认判定为补材料。建议人工复核。'
  };
}

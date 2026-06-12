import type { Material, DetectorMatchResult, ConflictDetectionResult } from '../../shared/types.js';

const REWORK_KEYWORDS = ['返工', '重录', '修改', '调整', '补录', '重混', '重编', '修正', '改版', 'V2', 'V3', 'v2', 'v3'];

export function detectDuplicate(
  incoming: Pick<Material, 'material_name' | 'isrc_code' | 'license_start_date'>,
  existingMaterials: Array<Pick<Material, 'id' | 'material_name' | 'isrc_code' | 'license_start_date'>>
): DetectorMatchResult {
  let bestMatch: DetectorMatchResult = {
    is_duplicate: false,
    match_score: 0,
    matched_fields: []
  };

  for (const existing of existingMaterials) {
    const matched_fields: string[] = [];
    let score = 0;

    if (incoming.material_name.trim() === existing.material_name.trim()) {
      matched_fields.push('material_name');
      score += 1;
    }
    if (incoming.isrc_code.trim() === existing.isrc_code.trim()) {
      matched_fields.push('isrc_code');
      score += 1;
    }
    if (incoming.license_start_date === existing.license_start_date) {
      matched_fields.push('license_start_date');
      score += 1;
    }

    if (score > bestMatch.match_score) {
      bestMatch = {
        is_duplicate: score >= 3,
        match_score: score,
        matched_fields,
        existing_material_id: score >= 2 ? existing.id : undefined
      };
    }
  }

  return bestMatch;
}

export function detectReworkReason(remarks: string): boolean {
  if (!remarks || remarks.trim().length === 0) return false;
  const lowerRemarks = remarks.toLowerCase();
  return REWORK_KEYWORDS.some(keyword => lowerRemarks.includes(keyword.toLowerCase()));
}

export function detectConflict(
  material: Material,
  messageContent: string
): ConflictDetectionResult {
  const conflicts: ConflictDetectionResult['conflicts'] = [];

  const datePattern = /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/g;
  const datesInMessage = messageContent.match(datePattern) || [];

  const episodePattern = /(\d+)\s*集/g;
  const episodesInMessage = messageContent.match(episodePattern);
  if (episodesInMessage) {
    const msgEpisodes = parseInt(episodesInMessage[0].replace(/\D/g, ''), 10);
    if (msgEpisodes !== material.episode_count) {
      conflicts.push({
        field_name: 'episode_count',
        original_value: String(material.episode_count),
        message_value: String(msgEpisodes),
        evidence: [
          `授权期限页记载：${material.episode_count}集`,
          `调音师留言提到：${msgEpisodes}集`,
          `集数不一致，影响费用计算`
        ]
      });
    }
  }

  const feePattern = /(?:保底|费用|金额)[：:]\s*(\d+(?:\.\d+)?)\s*(?:元|万|k)?/gi;
  const feesInMessage = [...messageContent.matchAll(feePattern)];
  if (feesInMessage.length > 0) {
    const msgFee = parseFloat(feesInMessage[0][1]);
    const unit = feesInMessage[0][0].includes('万') ? 10000 : 1;
    if (Math.abs(msgFee * unit - material.license_fee) > 1) {
      conflicts.push({
        field_name: 'license_fee',
        original_value: `${material.license_fee}元`,
        message_value: `${msgFee}${feesInMessage[0][0].includes('万') ? '万' : '元'}`,
        evidence: [
          `授权期限页记载：${material.license_fee}元`,
          `调音师留言提到：${msgFee}${feesInMessage[0][0].includes('万') ? '万' : '元'}`,
          `保底费用不一致，需财务确认`
        ]
      });
    }
  }

  const royaltyPattern = /(?:分成|比例)[：:]\s*(\d+(?:\.\d+)?)\s*%?/gi;
  const royaltiesInMessage = [...messageContent.matchAll(royaltyPattern)];
  if (royaltiesInMessage.length > 0) {
    const msgRoyalty = parseFloat(royaltiesInMessage[0][1]);
    const rate = msgRoyalty > 1 ? msgRoyalty / 100 : msgRoyalty;
    const existingRate = parseFloat(material.revenue_ratio);
    if (Math.abs(rate - existingRate) > 0.001) {
      conflicts.push({
        field_name: 'revenue_ratio',
        original_value: `${(existingRate * 100).toFixed(1)}%`,
        message_value: `${msgRoyalty}%`,
        evidence: [
          `授权期限页记载：${(existingRate * 100).toFixed(1)}%`,
          `调音师留言提到：${msgRoyalty}%`,
          `分成比例不一致，影响后续结算`
        ]
      });
    }
  }

  const dramaPattern = /《([^》]+)》/g;
  const dramasInMessage = [...messageContent.matchAll(dramaPattern)];
  if (dramasInMessage.length > 0) {
    const msgDrama = dramasInMessage[0][1];
    if (msgDrama !== material.project_name && !material.project_name.includes(msgDrama) && !msgDrama.includes(material.project_name)) {
      conflicts.push({
        field_name: 'project_name',
        original_value: material.project_name,
        message_value: msgDrama,
        evidence: [
          `授权期限页记载：《${material.project_name}》`,
          `调音师留言提到：《${msgDrama}》`,
          `影视剧名称不一致，可能影响授权范围`
        ]
      });
    }
  }

  if (datesInMessage.length >= 2) {
    const startPattern = /(?:开始|起始|起)[^年月日]*?(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/;
    const endPattern = /(?:结束|截止|止)[^年月日]*?(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/;
    const startMatch = messageContent.match(startPattern);
    const endMatch = messageContent.match(endPattern);

    if (startMatch && startMatch[1] !== material.license_start_date) {
      conflicts.push({
        field_name: 'license_start_date',
        original_value: material.license_start_date,
        message_value: startMatch[1],
        evidence: [
          `授权期限页起始日期：${material.license_start_date}`,
          `调音师留言起始日期：${startMatch[1]}`,
          `授权起始日期不一致`
        ]
      });
    }
    if (endMatch && endMatch[1] !== material.license_end_date) {
      conflicts.push({
        field_name: 'license_end_date',
        original_value: material.license_end_date,
        message_value: endMatch[1],
        evidence: [
          `授权期限页结束日期：${material.license_end_date}`,
          `调音师留言结束日期：${endMatch[1]}`,
          `授权结束日期不一致`
        ]
      });
    }
  }

  return {
    has_conflict: conflicts.length > 0,
    conflicts
  };
}

export function generateFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    license_start_date: '授权起始日期',
    license_end_date: '授权结束日期',
    project_name: '影视剧名称',
    episode_count: '集数',
    license_fee: '保底费用',
    revenue_ratio: '分成比例'
  };
  return labels[fieldName] || fieldName;
}

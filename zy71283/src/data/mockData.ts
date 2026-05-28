import type { Work, ColorSwatch, PendingRecord } from './types';
import { hexToHsl, hexToOklch } from '@/utils/colorSpace';

const RAW_WORKS: Work[] = [
  { id: 'w1', studentName: '陈晓雨', title: '日落海岸', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=seascape%20sunset%20painting%20warm%20orange%20purple%20sky%20watercolor%20style&image_size=landscape_16_9', themeTag: '风景', status: 'complete' },
  { id: 'w2', studentName: '李明远', title: '秋叶飘零', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=autumn%20falling%20leaves%20warm%20red%20brown%20gold%20painting&image_size=landscape_16_9', themeTag: '自然', status: 'complete' },
  { id: 'w3', studentName: '王思琪', title: '深海幽蓝', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=deep%20ocean%20blue%20dark%20teal%20underwater%20abstract%20painting&image_size=landscape_16_9', themeTag: '自然', status: 'complete' },
  { id: 'w4', studentName: '张博文', title: '城市霓虹', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=neon%20city%20night%20cyberpunk%20pink%20blue%20purple%20glowing&image_size=landscape_16_9', themeTag: '都市', status: 'complete' },
  { id: 'w5', studentName: '刘雅婷', title: '春风樱花', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cherry%20blossom%20spring%20pink%20soft%20pastel%20watercolor&image_size=landscape_16_9', themeTag: '自然', status: 'complete' },
  { id: 'w6', studentName: '赵天宇', title: '极光之舞', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=aurora%20borealis%20green%20purple%20night%20sky%20painting&image_size=landscape_16_9', themeTag: '风景', status: 'complete' },
  { id: 'w7', studentName: '孙艺涵', title: '沙漠黄昏', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=desert%20dusk%20sand%20warm%20amber%20terracotta%20painting&image_size=landscape_16_9', themeTag: '风景', status: 'complete' },
  { id: 'w8', studentName: '周梦然', title: '雪夜寂静', imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=snowy%20night%20cold%20blue%20white%20silver%20quiet%20painting&image_size=landscape_16_9', themeTag: '风景', status: 'complete' },
  { id: 'w9', studentName: '吴晓峰', title: '热带雨林', imageUrl: '', themeTag: '', status: 'incomplete' },
];

const RAW_COLORS: { workId: string; hex: string; colorName: string; isBackground: boolean }[] = [
  { workId: 'w1', hex: '#E8713A', colorName: '落日橙', isBackground: false },
  { workId: 'w1', hex: '#8B3A62', colorName: '暮紫', isBackground: false },
  { workId: 'w1', hex: '#F5D6A8', colorName: '沙滩金', isBackground: false },
  { workId: 'w1', hex: '#2D5F8A', colorName: '深海蓝', isBackground: false },
  { workId: 'w1', hex: '#FFFFFF', colorName: '画布白', isBackground: true },
  { workId: 'w2', hex: '#C4463A', colorName: '枫叶红', isBackground: false },
  { workId: 'w2', hex: '#8B6914', colorName: '枯叶褐', isBackground: false },
  { workId: 'w2', hex: '#DAA520', colorName: '金秋黄', isBackground: false },
  { workId: 'w2', hex: '#556B2F', colorName: '暗绿', isBackground: false },
  { workId: 'w3', hex: '#0A3D6B', colorName: '深海蓝', isBackground: false },
  { workId: 'w3', hex: '#1B6B93', colorName: '潮汐蓝', isBackground: false },
  { workId: 'w3', hex: '#2E8B8B', colorName: '碧绿', isBackground: false },
  { workId: 'w3', hex: '#0D1B2A', colorName: '深渊黑', isBackground: false },
  { workId: 'w3', hex: '#F0F0F0', colorName: '留白', isBackground: false },
  { workId: 'w4', hex: '#FF1493', colorName: '霓虹粉', isBackground: false },
  { workId: 'w4', hex: '#4169E1', colorName: '电光蓝', isBackground: false },
  { workId: 'w4', hex: '#9400D3', colorName: '幻紫', isBackground: false },
  { workId: 'w4', hex: '#E8713A', colorName: '暮光橙', isBackground: false },
  { workId: 'w5', hex: '#FFB7C5', colorName: '樱花粉', isBackground: false },
  { workId: 'w5', hex: '#FFF0F5', colorName: '花瓣白', isBackground: false },
  { workId: 'w5', hex: '#C71585', colorName: '花芯紫红', isBackground: false },
  { workId: 'w5', hex: '#98D8C8', colorName: '嫩叶绿', isBackground: false },
  { workId: 'w6', hex: '#00FF7F', colorName: '极光绿', isBackground: false },
  { workId: 'w6', hex: '#8A2BE2', colorName: '极光紫', isBackground: false },
  { workId: 'w6', hex: '#0C1445', colorName: '夜空蓝', isBackground: false },
  { workId: 'w6', hex: '#4B0082', colorName: '靛蓝', isBackground: false },
  { workId: 'w7', hex: '#CD853F', colorName: '沙漠褐', isBackground: false },
  { workId: 'w7', hex: '#E8713A', colorName: '暮光橙', isBackground: false },
  { workId: 'w7', hex: '#8B4513', colorName: '赤陶棕', isBackground: false },
  { workId: 'w7', hex: '#DEB887', colorName: '沙金', isBackground: false },
  { workId: 'w8', hex: '#B0C4DE', colorName: '冰蓝', isBackground: false },
  { workId: 'w8', hex: '#F0F8FF', colorName: '雪白', isBackground: false },
  { workId: 'w8', hex: '#708090', colorName: '暮灰', isBackground: false },
  { workId: 'w8', hex: '#4682B4', colorName: '冬蓝', isBackground: false },
  { workId: 'w9', hex: '#228B22', colorName: '丛林绿', isBackground: false },
  { workId: 'w9', hex: '#006400', colorName: '深林绿', isBackground: false },
  { workId: 'w9', hex: '#8B4513', colorName: '树皮棕', isBackground: false },
];

function buildSwatches(): ColorSwatch[] {
  return RAW_COLORS.map((c, i) => {
    const hsl = hexToHsl(c.hex);
    const oklch = hexToOklch(c.hex);
    return {
      id: `cs-${i}`,
      workId: c.workId,
      hex: c.hex,
      colorName: c.colorName,
      hue: Math.round(hsl.h * 10) / 10,
      saturation: Math.round(hsl.s * 10) / 10,
      lightness: Math.round(hsl.l * 10) / 10,
      oklch_l: Math.round(oklch.L * 1000) / 1000,
      oklch_c: Math.round(oklch.C * 1000) / 1000,
      oklch_h: Math.round(oklch.H * 10) / 10,
      isBackground: c.isBackground,
    };
  });
}

function buildPendingRecords(): PendingRecord[] {
  const records: PendingRecord[] = [];
  for (const w of RAW_WORKS) {
    if (w.status === 'incomplete') {
      if (!w.imageUrl) {
        records.push({
          id: `pending-${w.id}-image`,
          workId: w.id,
          missingField: 'imageUrl',
          note: `作品"${w.title}"缺少图片，无法进行图片联动分析`,
          completed: false,
        });
      }
      if (!w.themeTag) {
        records.push({
          id: `pending-${w.id}-tag`,
          workId: w.id,
          missingField: 'themeTag',
          note: `作品"${w.title}"缺少主题标签，影响聚类解释准确性`,
          completed: false,
        });
      }
    }
  }
  return records;
}

export const WORKS: Work[] = RAW_WORKS;
export const SWATCHES: ColorSwatch[] = buildSwatches();
export const PENDING_RECORDS: PendingRecord[] = buildPendingRecords();

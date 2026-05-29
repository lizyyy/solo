import type { SamplePack, Credential, Track, PlatformLink, HistoryRecord } from '@/types';
import { createHistoryRecord } from '@/services/historyService';

const generateId = (prefix: string): string => {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}`;
};

const now = new Date().toISOString();
const twentyOneDaysLater = new Date();
twentyOneDaysLater.setDate(twentyOneDaysLater.getDate() + 21);
const expiryDateStr = twentyOneDaysLater.toISOString().split('T')[0];

export const initialSamplePacks: SamplePack[] = [
  {
    id: 'sp_neon_dreams',
    name: 'Neon Dreams - Synthwave Collection',
    vendor: 'Synthwave Samples Co.',
    purchaseDate: '2025-01-15',
    licenseType: 'perpetual',
    price: 599,
    notes: '包含80年代复古合成器音色，适合制作Synthwave风格曲目',
    status: 'active',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
  },
  {
    id: 'sp_vintage_soul',
    name: 'Vintage Soul Keys',
    vendor: 'Soul Sounds Library',
    purchaseDate: '2023-06-20',
    licenseType: 'annual',
    expiryDate: expiryDateStr,
    price: 299,
    notes: '复古钢琴和键盘音色，年度授权，每年需要续费',
    status: 'expiring',
    createdAt: '2023-06-20T14:20:00Z',
    updatedAt: '2025-10-01T09:15:00Z',
  },
];

export const initialCredentials: Credential[] = [
  {
    id: 'cred_inv_001',
    samplePackId: 'sp_neon_dreams',
    type: 'invoice',
    fileName: 'Invoice_ND_20250115.pdf',
    description: '正式增值税发票，编号 INV-2025-0115',
    uploadedAt: '2025-01-15T10:35:00Z',
  },
  {
    id: 'cred_email_001',
    samplePackId: 'sp_neon_dreams',
    type: 'email',
    fileName: 'License_Confirmation.eml',
    description: '供应商发送的授权确认邮件',
    uploadedAt: '2025-01-15T11:00:00Z',
  },
  {
    id: 'cred_receipt_001',
    samplePackId: 'sp_vintage_soul',
    type: 'receipt',
    fileName: 'Order_Receipt_VSK.png',
    description: '支付宝订单截图，正式发票还在找',
    uploadedAt: '2023-06-20T14:30:00Z',
  },
];

export const initialTracks: Track[] = [
  {
    id: 'trk_midnight_drive',
    title: 'Midnight Drive',
    artist: 'Neon Dreams',
    bpm: 118,
    genre: 'Synthwave',
    projectPath: '/Projects/Albums/2025/Synthwave Nights/Midnight Drive.ableton',
    samplePackIds: ['sp_neon_dreams'],
    createdAt: '2025-02-10T16:00:00Z',
    updatedAt: '2025-03-15T20:00:00Z',
  },
  {
    id: 'trk_coffee_shop',
    title: 'Coffee Shop',
    artist: 'Lo-Fi Collective',
    bpm: 85,
    genre: 'Lo-Fi Jazz',
    projectPath: '/Projects/Albums/2024/Cafe Vibes/Coffee Shop.logic',
    samplePackIds: ['sp_vintage_soul'],
    createdAt: '2024-03-20T10:00:00Z',
    updatedAt: '2024-05-10T15:30:00Z',
  },
  {
    id: 'trk_rainy_afternoon',
    title: 'Rainy Afternoon',
    artist: 'Lo-Fi Collective',
    bpm: 78,
    genre: 'Chillout',
    projectPath: '/Projects/Albums/2024/Cafe Vibes/Rainy Afternoon.logic',
    samplePackIds: ['sp_vintage_soul'],
    createdAt: '2024-04-05T11:00:00Z',
    updatedAt: '2024-06-01T14:20:00Z',
  },
  {
    id: 'trk_sunday_brunch',
    title: 'Sunday Brunch',
    artist: 'Lo-Fi Collective',
    bpm: 92,
    genre: 'Lo-Fi Jazz',
    projectPath: '/Projects/Albums/2024/Cafe Vibes/Sunday Brunch.logic',
    samplePackIds: ['sp_vintage_soul'],
    createdAt: '2024-05-12T09:30:00Z',
    updatedAt: '2024-07-20T16:45:00Z',
  },
];

export const initialPlatformLinks: PlatformLink[] = [
  {
    id: 'pl_001',
    trackId: 'trk_midnight_drive',
    platform: 'spotify',
    url: 'https://open.spotify.com/track/1aBcDeFgHiJkLmNoPqRsTu',
    publishedAt: '2025-04-01',
  },
  {
    id: 'pl_002',
    trackId: 'trk_midnight_drive',
    platform: 'netease',
    url: 'https://music.163.com/#/song?id=123456789',
    publishedAt: '2025-04-01',
  },
  {
    id: 'pl_003',
    trackId: 'trk_midnight_drive',
    platform: 'apple',
    url: 'https://music.apple.com/cn/album/midnight-drive/1234567890',
    publishedAt: '2025-04-01',
  },
  {
    id: 'pl_004',
    trackId: 'trk_coffee_shop',
    platform: 'netease',
    url: 'https://music.163.com/#/song?id=987654321',
    publishedAt: '2024-08-15',
  },
];

export const generateInitialHistory = (): HistoryRecord[] => {
  const history: HistoryRecord[] = [];

  const neonPack = initialSamplePacks.find((p) => p.id === 'sp_neon_dreams')!;
  history.push(
    createHistoryRecord(
      'samplePack',
      neonPack.id,
      'create',
      neonPack,
      undefined,
      '首次录入采样包信息',
      '制作人小王'
    )
  );

  const neonCred1 = initialCredentials.find((c) => c.id === 'cred_inv_001')!;
  history.push(
    createHistoryRecord(
      'credential',
      neonCred1.id,
      'create',
      neonCred1,
      undefined,
      '上传正式发票',
      '制作人小王'
    )
  );

  const neonCred2 = initialCredentials.find((c) => c.id === 'cred_email_001')!;
  history.push(
    createHistoryRecord(
      'credential',
      neonCred2.id,
      'create',
      neonCred2,
      undefined,
      '上传授权确认邮件',
      '制作人小王'
    )
  );

  const midnightDrive = initialTracks.find((t) => t.id === 'trk_midnight_drive')!;
  history.push(
    createHistoryRecord(
      'track',
      midnightDrive.id,
      'create',
      midnightDrive,
      undefined,
      '新建曲目工程',
      '制作人小王'
    )
  );

  history.push(
    createHistoryRecord(
      'samplePack',
      neonPack.id,
      'link',
      { samplePackId: neonPack.id, trackId: midnightDrive.id },
      undefined,
      '关联曲目《Midnight Drive》',
      '制作人小王'
    )
  );

  const vintagePack = initialSamplePacks.find((p) => p.id === 'sp_vintage_soul')!;
  history.push(
    createHistoryRecord(
      'samplePack',
      vintagePack.id,
      'create',
      vintagePack,
      undefined,
      '首次录入采样包信息',
      '制作人小李'
    )
  );

  const vintageCred = initialCredentials.find((c) => c.id === 'cred_receipt_001')!;
  history.push(
    createHistoryRecord(
      'credential',
      vintageCred.id,
      'create',
      vintageCred,
      undefined,
      '暂存订单截图，后续补发票',
      '制作人小李'
    )
  );

  const coffeeShop = initialTracks.find((t) => t.id === 'trk_coffee_shop')!;
  history.push(
    createHistoryRecord(
      'track',
      coffeeShop.id,
      'create',
      coffeeShop,
      undefined,
      '新建曲目工程',
      '制作人小李'
    )
  );

  history.push(
    createHistoryRecord(
      'samplePack',
      vintagePack.id,
      'link',
      { samplePackId: vintagePack.id, trackId: coffeeShop.id },
      undefined,
      '关联曲目《Coffee Shop》',
      '制作人小李'
    )
  );

  const vintagePackUpdated = {
    ...vintagePack,
    updatedAt: '2025-10-01T09:15:00Z',
    notes: '复古钢琴和键盘音色，年度授权，每年需要续费，2026年到期前记得续费',
  };
  history.push(
    createHistoryRecord(
      'samplePack',
      vintagePack.id,
      'update',
      vintagePackUpdated,
      vintagePack,
      '更新备注，增加续费提醒',
      '制作人小李'
    )
  );

  const rainyAfternoon = initialTracks.find((t) => t.id === 'trk_rainy_afternoon')!;
  history.push(
    createHistoryRecord(
      'track',
      rainyAfternoon.id,
      'create',
      rainyAfternoon,
      undefined,
      '新建曲目工程',
      '制作人小李'
    )
  );

  history.push(
    createHistoryRecord(
      'samplePack',
      vintagePack.id,
      'link',
      { samplePackId: vintagePack.id, trackId: rainyAfternoon.id },
      undefined,
      '关联曲目《Rainy Afternoon》',
      '制作人小李'
    )
  );

  const sundayBrunch = initialTracks.find((t) => t.id === 'trk_sunday_brunch')!;
  history.push(
    createHistoryRecord(
      'track',
      sundayBrunch.id,
      'create',
      sundayBrunch,
      undefined,
      '新建曲目工程',
      '制作人小李'
    )
  );

  history.push(
    createHistoryRecord(
      'samplePack',
      vintagePack.id,
      'link',
      { samplePackId: vintagePack.id, trackId: sundayBrunch.id },
      undefined,
      '关联曲目《Sunday Brunch》',
      '制作人小李'
    )
  );

  return history;
};

export { generateId };

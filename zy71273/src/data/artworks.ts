import { Artwork, ClassInfo } from '../types/artwork';
import { updateArtworkQualityFlags } from '../utils/qualityChecker';

export const CLASSES: ClassInfo[] = [
  { id: 'class-1', name: '高一(1)班', grade: '高一', artDirection: '素描', color: '#6366f1' },
  { id: 'class-2', name: '高一(2)班', grade: '高一', artDirection: '水彩', color: '#f59e0b' },
  { id: 'class-3', name: '高一(3)班', grade: '高一', artDirection: '油画', color: '#10b981' },
  { id: 'class-4', name: '高二(1)班', grade: '高二', artDirection: '版画', color: '#ef4444' },
  { id: 'class-5', name: '高二(2)班', grade: '高二', artDirection: '国画', color: '#8b5cf6' },
  { id: 'class-6', name: '高三(1)班', grade: '高三', artDirection: '综合材料', color: '#06b6d4' },
  { id: 'class-7', name: '高三(2)班', grade: '高三', artDirection: '数字艺术', color: '#f97316' },
  { id: 'class-8', name: '高三(3)班', grade: '高三', artDirection: '实验艺术', color: '#ec4899' },
];

const rawArtworks: Omit<Artwork, 'qualityFlags'>[] = [
  {
    id: 'art-1',
    title: '春晨',
    classId: 'class-1',
    className: '高一(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=spring%20morning%20landscape%20painting%20soft%20pastel%20colors%20impressionist%20style&image_size=square',
    hue: 120,
    lightness: 65,
    saturation: 45,
    score: 88,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-20T10:30:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-20T10:30:00Z',
      fields: { hue: 120, lightness: 65, saturation: 45, className: '高一(1)班' }
    }],
    notes: '典型的春天绿色调，画面柔和'
  },
  {
    id: 'art-2',
    title: '城市霓虹',
    classId: 'class-1',
    className: '高一(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=city%20neon%20lights%20night%20scene%20purple%20blue%20pink%20reflections&image_size=square',
    hue: 280,
    lightness: 45,
    saturation: 80,
    score: 92,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-21T14:20:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-21T14:20:00Z',
      fields: { hue: 280, lightness: 45, saturation: 80 }
    }]
  },
  {
    id: 'art-3',
    title: '秋日暖阳',
    classId: 'class-1',
    className: '高一(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=autumn%20landscape%20warm%20orange%20yellow%20golden%20sunlight%20trees&image_size=square',
    hue: 40,
    lightness: 60,
    saturation: 70,
    score: 85,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-22T09:15:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-22T09:15:00Z',
      fields: { hue: 40, lightness: 60, saturation: 70 }
    }]
  },
  {
    id: 'art-4',
    title: '深海',
    classId: 'class-2',
    className: '高一(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=deep%20ocean%20watercolor%20painting%20various%20shades%20of%20blue%20tranquil&image_size=square',
    hue: 210,
    lightness: 35,
    saturation: 60,
    score: 90,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-20T11:45:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-20T11:45:00Z',
      fields: { hue: 210, lightness: 35, saturation: 60 }
    }]
  },
  {
    id: 'art-5',
    title: '樱花雨',
    classId: 'class-2',
    className: '高一(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cherry%20blossom%20watercolor%20painting%20soft%20pink%20white%20petals%20falling&image_size=square',
    hue: 340,
    lightness: 80,
    saturation: 50,
    score: 95,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-21T16:30:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-21T16:30:00Z',
      fields: { hue: 340, lightness: 80, saturation: 50 }
    }]
  },
  {
    id: 'art-6',
    title: '山间晨雾',
    classId: 'class-2',
    className: '高一(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=misty%20mountains%20watercolor%20landscape%20gray%20blue%20atmospheric%20mood&image_size=square',
    hue: 200,
    lightness: 55,
    saturation: 25,
    score: 87,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-22T08:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-22T08:00:00Z',
      fields: { hue: 200, lightness: 55, saturation: 25 }
    }]
  },
  {
    id: 'art-7',
    title: '星空',
    classId: 'class-3',
    className: '高一(3)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=starry%20night%20sky%20painting%20dark%20blue%20with%20bright%20stars%20van%20gogh%20style&image_size=square',
    hue: 0,
    lightness: 95,
    saturation: 2,
    score: 78,
    dataVersion: 'v2.1',
    sampledAt: '2026-05-25T13:00:00Z',
    versionHistory: [
      {
        version: 'v1.0',
        timestamp: '2026-05-20T10:00:00Z',
        fields: { hue: null, lightness: null, saturation: null },
        note: '初始版本，只有图片'
      },
      {
        version: 'v2.0',
        timestamp: '2026-05-23T15:30:00Z',
        fields: { hue: 210, lightness: 20, saturation: 70, className: '高一(2)班' },
        note: '补充HSL数据，但班级标签错误'
      },
      {
        version: 'v2.1',
        timestamp: '2026-05-25T13:00:00Z',
        fields: { hue: 0, lightness: 95, saturation: 2, className: '高一(3)班', score: 78 },
        note: '修正班级标签，但透明背景被误采为白色'
      }
    ],
    notes: '⚠️ 透明背景误采高风险 - PNG透明通道被识别为白色'
  },
  {
    id: 'art-8',
    title: '向日葵',
    classId: 'class-3',
    className: '高一(3)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=sunflower%20oil%20painting%20vibrant%20yellow%20golden%20thick%20brushstrokes%20van%20gogh%20style&image_size=square',
    hue: 45,
    lightness: 55,
    saturation: 90,
    score: 94,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-21T11:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-21T11:00:00Z',
      fields: { hue: 45, lightness: 55, saturation: 90 }
    }]
  },
  {
    id: 'art-9',
    title: '黄昏港口',
    classId: 'class-3',
    className: '高一(3)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=harbor%20sunset%20oil%20painting%20orange%20purple%20sky%20reflection%20on%20water&image_size=square',
    hue: 30,
    lightness: 50,
    saturation: 85,
    score: 89,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-22T17:45:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-22T17:45:00Z',
      fields: { hue: 30, lightness: 50, saturation: 85 }
    }]
  },
  {
    id: 'art-10',
    title: '夜',
    classId: 'class-4',
    className: '高二(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20dark%20painting%20almost%20black%20subtle%20blue%20undertones%20minimalist&image_size=square',
    hue: 240,
    lightness: 3,
    saturation: 5,
    score: 82,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-23T20:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-23T20:00:00Z',
      fields: { hue: 240, lightness: 3, saturation: 5 }
    }],
    notes: 'ℹ️ 极端颜色 - 几乎全黑，位于3D空间角落'
  },
  {
    id: 'art-11',
    title: '阳光',
    classId: 'class-4',
    className: '高二(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20bright%20white%20yellow%20painting%20sunlight%20radiant%20pure%20light&image_size=square',
    hue: 45,
    lightness: 98,
    saturation: 95,
    score: 86,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-24T12:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-24T12:00:00Z',
      fields: { hue: 45, lightness: 98, saturation: 95 }
    }],
    notes: 'ℹ️ 极端颜色 - 几乎全白，位于3D空间顶部边缘'
  },
  {
    id: 'art-12',
    title: '几何韵律',
    classId: 'class-4',
    className: '高二(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=geometric%20abstract%20printmaking%20bold%20shapes%20red%20black%20white%20constructivist&image_size=square',
    hue: 5,
    lightness: 50,
    saturation: 95,
    score: 91,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-24T15:30:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-24T15:30:00Z',
      fields: { hue: 5, lightness: 50, saturation: 95 }
    }],
    notes: 'ℹ️ 极端色相 - 接近0°红色边界'
  },
  {
    id: 'art-13',
    title: '山水意境',
    classId: 'class-5',
    className: '高二(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chinese%20ink%20wash%20painting%20mountain%20landscape%20misty%20zen%20minimal&image_size=square',
    hue: 200,
    lightness: 45,
    saturation: 15,
    score: 93,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-20T14:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-20T14:00:00Z',
      fields: { hue: 200, lightness: 45, saturation: 15 }
    }]
  },
  {
    id: 'art-14',
    title: '梅',
    classId: 'class-5',
    className: '高二(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chinese%20plum%20blossom%20ink%20painting%20red%20flowers%20on%20dark%20branches%20traditional&image_size=square',
    hue: 350,
    lightness: 40,
    saturation: 75,
    score: 88,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-21T10:30:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-21T10:30:00Z',
      fields: { hue: 350, lightness: 40, saturation: 75 }
    }]
  },
  {
    id: 'art-15',
    title: '竹影',
    classId: 'class-5',
    className: '高二(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=chinese%20bamboo%20ink%20painting%20green%20leaves%20elegant%20traditional%20style&image_size=square',
    hue: 130,
    lightness: 35,
    saturation: 40,
    score: 90,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-22T09:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-22T09:00:00Z',
      fields: { hue: 130, lightness: 35, saturation: 40 }
    }]
  },
  {
    id: 'art-16',
    title: '废墟之美',
    classId: 'class-6',
    className: '高三(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mixed%20media%20art%20rusty%20metal%20texture%20weathered%20industrial%20decay%20aesthetic&image_size=square',
    hue: 30,
    lightness: 30,
    saturation: 35,
    score: 87,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-23T11:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-23T11:00:00Z',
      fields: { hue: 30, lightness: 30, saturation: 35 }
    }]
  },
  {
    id: 'art-17',
    title: '时间的痕迹',
    classId: 'class-6',
    className: '高三(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=abstract%20mixed%20media%20layers%20of%20newspaper%20paint%20texture%20collage%20vintage&image_size=square',
    hue: 45,
    lightness: 40,
    saturation: 25,
    score: 91,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-24T14:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-24T14:00:00Z',
      fields: { hue: 45, lightness: 40, saturation: 25 }
    }]
  },
  {
    id: 'art-18',
    title: '未完成',
    classId: 'class-6',
    className: '高三(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=unfinished%20artwork%20half%20painted%20canvas%20exposed%20canvas%20edges%20work%20in%20progress&image_size=square',
    hue: null,
    lightness: null,
    saturation: null,
    score: 0,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-25T10:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-25T10:00:00Z',
      fields: { hue: null, lightness: null, saturation: null, score: 0 },
      note: '作品尚未完成，缺少色彩采样数据'
    }],
    notes: '❌ 数据缺失 - 该作品尚未完成色彩采样'
  },
  {
    id: 'art-19',
    title: '赛博朋克',
    classId: 'class-7',
    className: '高三(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cyberpunk%20city%20digital%20art%20neon%20lights%20rain%20reflections%20futuristic%20purple%20pink%20blue&image_size=square',
    hue: 300,
    lightness: 40,
    saturation: 85,
    score: 94,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-20T16:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-20T16:00:00Z',
      fields: { hue: 300, lightness: 40, saturation: 85 }
    }]
  },
  {
    id: 'art-20',
    title: '数据之海',
    classId: 'class-7',
    className: '高三(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=digital%20data%20ocean%20flowing%20particles%20blue%20cyan%20glowing%20abstract%20technology&image_size=square',
    hue: 190,
    lightness: 50,
    saturation: 75,
    score: 89,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-21T13:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-21T13:00:00Z',
      fields: { hue: 190, lightness: 50, saturation: 75 }
    }]
  },
  {
    id: 'art-21',
    title: '虚拟森林',
    classId: 'class-7',
    className: '高三(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=virtual%20forest%20digital%20art%20glowing%20green%20trees%20magical%20fantasy%20neon%20nature&image_size=square',
    hue: 140,
    lightness: 45,
    saturation: 80,
    score: 92,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-22T15:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-22T15:00:00Z',
      fields: { hue: 140, lightness: 45, saturation: 80 }
    }]
  },
  {
    id: 'art-22',
    title: '色彩的呐喊',
    classId: 'class-8',
    className: '高三(3)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=expressionist%20screaming%20figure%20swirling%20vibrant%20colors%20emotional%20intense%20inspired%20by%20munch&image_size=square',
    hue: 25,
    lightness: 55,
    saturation: 90,
    score: 96,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-23T10:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-23T10:00:00Z',
      fields: { hue: 25, lightness: 55, saturation: 90 }
    }]
  },
  {
    id: 'art-23',
    title: '无意识',
    classId: 'class-8',
    className: '高三(3)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=surreal%20automatic%20drawing%20abstract%20biomorphic%20shapes%20subconscious%20dali%20style&image_size=square',
    hue: 280,
    lightness: 50,
    saturation: 60,
    score: 88,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-24T11:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-24T11:00:00Z',
      fields: { hue: 280, lightness: 50, saturation: 60 }
    }]
  },
  {
    id: 'art-24',
    title: '虚无',
    classId: 'class-8',
    className: '高三(3)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=minimalist%20conceptual%20art%20empty%20space%20light%20and%20shadow%20zen%20nothingness&image_size=square',
    hue: 355,
    lightness: 2,
    saturation: 3,
    score: 85,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-25T16:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-25T16:00:00Z',
      fields: { hue: 355, lightness: 2, saturation: 3 }
    }],
    notes: 'ℹ️ 极端颜色 - 接近纯黑的深红，双重边缘风险'
  },
  {
    id: 'art-25',
    title: '静物',
    classId: 'class-1',
    className: '高一(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=classic%20still%20life%20painting%20fruit%20bowl%20wine%20bottle%20drapery%20rembrandt%20lighting&image_size=square',
    hue: 35,
    lightness: 45,
    saturation: 55,
    score: 87,
    dataVersion: 'v3.0',
    sampledAt: '2026-05-28T09:00:00Z',
    versionHistory: [
      {
        version: 'v1.0',
        timestamp: '2026-05-20T08:00:00Z',
        fields: { hue: null, lightness: null, saturation: null },
        note: '第一版：只有图片，无HSL数据'
      },
      {
        version: 'v2.0',
        timestamp: '2026-05-25T14:00:00Z',
        fields: { hue: 35, lightness: 45, saturation: 55, className: '高一(2)班' },
        note: '第二版：补充HSL数据，但班级标签错误'
      },
      {
        version: 'v3.0',
        timestamp: '2026-05-28T09:00:00Z',
        fields: { hue: 35, lightness: 45, saturation: 55, className: '高一(1)班', score: 87 },
        note: '第三版：修正班级标签，增加评分数据'
      }
    ],
    notes: 'ℹ️ 存在3个版本的数据，请确认使用正确版本'
  },
  {
    id: 'art-26',
    title: '海边',
    classId: 'class-2',
    className: '高一(2)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=seaside%20watercolor%20beach%20turquoise%20water%20palm%20trees%20summer%20vacation&image_size=square',
    hue: 180,
    lightness: 60,
    saturation: 65,
    score: 84,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-26T10:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-26T10:00:00Z',
      fields: { hue: 180, lightness: 60, saturation: 65 }
    }]
  },
  {
    id: 'art-27',
    title: '老街',
    classId: 'class-4',
    className: '高二(1)班',
    imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=old%20street%20printmaking%20etching%20style%20nostalgic%20historic%20town%20black%20white&image_size=square',
    hue: 0,
    lightness: 50,
    saturation: 0,
    score: 86,
    dataVersion: 'v1.0',
    sampledAt: '2026-05-26T14:00:00Z',
    versionHistory: [{
      version: 'v1.0',
      timestamp: '2026-05-26T14:00:00Z',
      fields: { hue: 0, lightness: 50, saturation: 0 }
    }],
    notes: '黑白版画，饱和度为0，位于色彩空间中心'
  }
];

export const ARTWORKS: Artwork[] = rawArtworks.map(updateArtworkQualityFlags);

export function getArtworkById(id: string): Artwork | undefined {
  return ARTWORKS.find(a => a.id === id);
}

export function getArtworksByClass(classId: string): Artwork[] {
  return ARTWORKS.filter(a => a.classId === classId);
}

export function getClassById(classId: string): ClassInfo | undefined {
  return CLASSES.find(c => c.id === classId);
}

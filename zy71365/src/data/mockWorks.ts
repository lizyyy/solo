import type { StudentWork } from '../types';

const imagePrompts = [
  'minimalist graphic design poster with geometric shapes',
  'abstract oil painting with warm color palette',
  'modern product design sketch of a chair',
  'typography art poster with chinese characters',
  'mixed media collage with vintage elements',
  'sustainable fashion design collection sketch',
  'architectural rendering of a modern building',
  'digital illustration of a fantasy landscape',
  'package design for organic tea brand',
  'user interface design for mobile app',
  'ceramic pottery art photography',
  'experimental short film storyboard',
  'brand identity logo design set',
  'textile pattern design with floral motifs',
  'interactive installation art concept',
  'editorial magazine layout design',
  'sculpture in contemporary style',
  'motion graphics animation frames',
  'urban sketching watercolor painting',
  'virtual reality environment design'
];

const tags = [
  '平面设计', '品牌设计', '插画', '油画', '水彩', '素描', '产品设计',
  '交互设计', 'UI设计', '建筑设计', '服装设计', '纺织品设计', '陶艺',
  '雕塑', '装置艺术', '摄影', '动态设计', '叙事性', '概念性', '实验性',
  '极简主义', '抽象表现', '具象', '传统技法', '数字媒介', '可持续设计'
];

const mediums = [
  '油画颜料', '水彩', '丙烯', '铅笔', '马克笔', '数位板', 'Adobe Photoshop',
  'Adobe Illustrator', 'Figma', 'Blender', '陶瓷', '木材', '金属', '纺织品',
  '综合材料', '摄影', '视频', '装置', '3D打印'
];

const students = [
  '张明', '李华', '王芳', '刘伟', '陈静', '杨帆', '赵雪', '周涛',
  '吴琳', '郑浩', '孙悦', '马超', '朱婷', '胡军', '林希'
];

const descriptions = [
  '探索现代都市中人与自然的关系，通过抽象几何图形表达城市空间的秩序感。',
  '以个人记忆为出发点，用混合媒介重构童年生活片段，探讨时间与记忆的关系。',
  '针对老年群体的产品设计方案，注重易用性与情感关怀，融入传统美学元素。',
  '基于可持续发展理念的时尚系列，采用回收材料与自然染色工艺，反思快时尚问题。',
  '研究中国传统书法与现代平面设计的融合，探索东方美学在当代语境中的转译。',
  '通过交互装置探讨人与科技的关系，参与者的动作会实时影响作品呈现形态。',
  '以环保为主题的插画系列，描绘受气候变化影响的生态系统，呼唤公众意识。',
  '建筑方案设计，关注社区空间的开放性与包容性，融合本地文化与现代功能。',
  '品牌视觉系统设计，为独立咖啡品牌打造温暖而独特的视觉识别体系。',
  '实验性短片的故事板与视觉设计，探讨数字时代人类的注意力碎片化问题。',
  '通过陶瓷工艺研究器物与日常的关系，追求朴素而有温度的器物美学。',
  '纺织品图案设计，结合植物染工艺与数字印花技术，创造独特的视觉语言。',
  '用户体验设计项目，针对教育类APP进行交互优化，提升学习效率与乐趣。',
  '以身体为媒介的行为艺术记录，探讨性别、身份与社会规范之间的张力。',
  '动态图形设计，为音乐节创作系列视觉动效，融合迷幻美学与节奏表达。',
  '城市景观设计方案，激活城市消极空间为公共艺术区域，服务社区居民。',
  '书籍装帧设计，为诗集打造独特的阅读体验，纸张、印刷与内容融为一体。',
  '游戏概念设计，构建独特的世界观与角色体系，探讨科技与人性的边界。',
  '公共艺术提案，在历史街区植入当代艺术装置，对话过去与现在。',
  '数字绘画系列，以科幻视角想象未来城市的生态图景，反思发展与环境的平衡。'
];

function randomFrom<T>(arr: T[], count: number = 1): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const directions: Array<'视觉传达' | '产品设计' | '交互设计' | '纯艺术' | '服装设计' | '建筑设计'> = 
  ['视觉传达', '产品设计', '交互设计', '纯艺术', '服装设计', '建筑设计'];

export const mockWorks: StudentWork[] = Array.from({ length: 20 }, (_, i) => {
  const completion = randomInt(2, 5) as 1 | 2 | 3 | 4 | 5;
  const hasClearance = Math.random() > 0.25;
  
  return {
    id: `work-${i + 1}`,
    title: `作品 ${i + 1}：${['秩序', '记忆', '温度', '循环', '对话', '边界', '呼吸', '共鸣', '痕迹', '光影', '韵律', '容器', '脉络', '回响', '投射', '维度', '褶皱', '缝隙', '潮汐', '静默'][i]}`,
    studentName: students[i % students.length],
    thumbnail: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(imagePrompts[i])}&image_size=square_hd`,
    description: descriptions[i],
    tags: randomFrom(tags, randomInt(3, 6)),
    mediums: randomFrom(mediums, randomInt(2, 4)),
    completion,
    applicationDirection: randomFrom(directions, randomInt(1, 3)),
    copyright: {
      hasClearance,
      source: hasClearance ? '学生原创，已签署版权声明' : '素材来源待确认',
      notes: hasClearance ? '' : '需补充版权证明材料'
    },
    createdAt: new Date(Date.now() - randomInt(0, 365) * 24 * 60 * 60 * 1000).toISOString(),
    sourceMaterials: [
      {
        id: `src-${i}-1`,
        type: 'image',
        title: '创作过程草图',
        url: `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent('art studio sketchbook pages with drawings')}&image_size=square`,
        uploadedAt: new Date(Date.now() - randomInt(10, 60) * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: `src-${i}-2`,
        type: 'document',
        title: '创作说明文档',
        url: '#',
        uploadedAt: new Date(Date.now() - randomInt(5, 30) * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  };
});

export const allTags = tags;
export const allMediums = mediums;
export const allDirections = directions;

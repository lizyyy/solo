const db = require('./database')

const sampleMaterials = [
  {
    name: '欢快背景音乐 A',
    type: 'audio',
    tags: ['欢快', '积极', '短视频'],
    license_source: ' Epidemic Sound (商用授权)',
    allowed_platforms: ['抖音', '小红书', 'B站'],
    allowed_clients: [],
    commercial_allowed: true,
    expire_date: '2026-12-31',
    requires_attribution: false,
    notes: '年付订阅，有效期内无限制使用',
  },
  {
    name: '城市夜景 B-roll',
    type: 'video',
    tags: ['城市', '夜景', '车流'],
    license_source: 'Pexels (免费商用)',
    allowed_platforms: ['抖音', '小红书', 'B站', '微信视频号'],
    allowed_clients: [],
    commercial_allowed: true,
    expire_date: null,
    requires_attribution: true,
    attribution_text: '视频素材来自 Pexels',
    notes: '免费素材，需要标注来源',
  },
  {
    name: '思源黑体',
    type: 'font',
    tags: ['免费', '中文'],
    license_source: 'Google Fonts (SIL Open Font License)',
    allowed_platforms: ['抖音', '小红书', 'B站', '微信视频号', '微博'],
    allowed_clients: [],
    commercial_allowed: true,
    expire_date: null,
    requires_attribution: false,
    notes: '开源免费字体，无需授权',
  },
  {
    name: '某品牌专属音乐 (限小红书)',
    type: 'audio',
    tags: ['品牌', '专属'],
    license_source: '客户提供',
    allowed_platforms: ['小红书'],
    allowed_clients: ['某品牌客户'],
    commercial_allowed: true,
    expire_date: '2026-06-30',
    requires_attribution: false,
    notes: '只能在小红书发布，且仅限该品牌客户使用',
  },
  {
    name: '美食特写镜头素材',
    type: 'video',
    tags: ['美食', '特写', '4K'],
    license_source: 'Envato Elements (订阅授权)',
    allowed_platforms: ['抖音', '小红书', 'B站'],
    allowed_clients: [],
    commercial_allowed: false,
    expire_date: '2026-05-10',
    requires_attribution: false,
    notes: '个人订阅，不可商用，授权即将过期',
  },
  {
    name: '产品宣传图',
    type: 'image',
    tags: ['产品', '宣传', '品牌'],
    license_source: '客户提供',
    allowed_platforms: ['抖音', '小红书', '微信视频号'],
    allowed_clients: ['客户A'],
    commercial_allowed: true,
    expire_date: null,
    requires_attribution: false,
    notes: '客户自有素材，仅限客户A的项目使用',
  },
]

const sampleProjects = [
  {
    name: '某品牌 618 推广短视频',
    client_name: '某品牌客户',
    target_platforms: ['抖音', '小红书'],
    description: '618年中大促产品推广视频，时长约60秒',
    status: 'review',
  },
]

const sampleTimelines = (projectId, materialIdMap) => [
  {
    project_id: projectId,
    material_id: materialIdMap['欢快背景音乐 A'],
    material_name: '欢快背景音乐 A',
    start_time: 0,
    end_time: 60,
    purpose: '全程背景音乐',
    target_platform: '抖音',
    client_name: '某品牌客户',
  },
  {
    project_id: projectId,
    material_id: materialIdMap['城市夜景 B-roll'],
    material_name: '城市夜景 B-roll',
    start_time: 5,
    end_time: 15,
    purpose: '开场镜头',
    target_platform: '抖音',
    client_name: '某品牌客户',
  },
  {
    project_id: projectId,
    material_id: materialIdMap['某品牌专属音乐 (限小红书)'],
    material_name: '某品牌专属音乐 (限小红书)',
    start_time: 0,
    end_time: 58,
    purpose: '小红书版本背景音乐',
    target_platform: '抖音',
    client_name: '某品牌客户',
  },
  {
    project_id: projectId,
    material_id: materialIdMap['美食特写镜头素材'],
    material_name: '美食特写镜头素材',
    start_time: 20,
    end_time: 35,
    purpose: '产品展示',
    target_platform: '抖音',
    client_name: '某品牌客户',
  },
  {
    project_id: projectId,
    material_id: null,
    material_name: '未知音乐素材',
    start_time: 40,
    end_time: 50,
    purpose: '转场音乐',
    target_platform: '抖音',
    client_name: '某品牌客户',
    notes: '素材库中没有此素材记录',
  },
]

const initSampleData = () => {
  const results = { materials: 0, projects: 0, timelines: 0, errors: [] }
  
  try {
    const materialIdMap = {}
    for (const material of sampleMaterials) {
      const created = db.createMaterial(material)
      materialIdMap[material.name] = created.id
      results.materials++
    }
    
    for (const project of sampleProjects) {
      const createdProject = db.createProject(project)
      results.projects++
      
      const timelines = sampleTimelines(createdProject.id, materialIdMap)
      for (const timeline of timelines) {
        db.createTimeline(timeline)
        results.timelines++
      }
    }
    
    return { success: true, ...results }
  } catch (e) {
    results.errors.push(e.message)
    return { success: false, ...results }
  }
}

module.exports = {
  initSampleData,
  sampleMaterials,
  sampleProjects,
}

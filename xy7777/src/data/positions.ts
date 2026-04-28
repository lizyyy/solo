import { Position } from '../types';

export const positions: Position[] = [
  {
    id: 'book',
    name: '图书运营',
    description: '负责图书产品的策划、推广和销售，连接作者与读者',
    icon: 'book-open',
    color: '#6366F1',
    weeklyHours: 15,
    estimatedWeeks: 12,
    overview: '图书运营是出版行业的核心岗位，需要具备良好的文案能力、市场敏感度和数据分析能力。主要工作包括图书选题策划、作者关系维护、营销推广活动策划、电商平台运营等。',
    careerPath: ['图书运营专员', '图书运营主管', '图书运营经理', '运营总监', '出版人'],
    salaryRange: '6k-15k/月（专员），15k-30k/月（经理）',
    marketDemand: '稳定增长，随着知识付费和阅读文化的兴起，图书运营人才需求持续增加'
  },
  {
    id: 'live',
    name: '直播运营',
    description: '策划和执行直播活动，提升观看量、互动率和转化率',
    icon: 'mic2',
    color: '#EC4899',
    weeklyHours: 20,
    estimatedWeeks: 10,
    overview: '直播运营是电商和内容平台的热门岗位，负责直播间的整体策划和执行。需要具备良好的现场把控能力、数据分析能力和应急处理能力。主要工作包括直播脚本策划、主播培训、场控执行、数据分析优化等。',
    careerPath: ['直播运营助理', '直播运营专员', '直播运营主管', '直播运营经理', '内容运营总监'],
    salaryRange: '7k-18k/月（专员），18k-35k/月（经理）+ 提成',
    marketDemand: '非常旺盛，直播电商持续火爆，各平台都在争抢优秀的直播运营人才'
  },
  {
    id: 'shop',
    name: '店铺运营',
    description: '管理电商店铺，优化产品、流量、转化和用户体验',
    icon: 'store',
    color: '#10B981',
    weeklyHours: 18,
    estimatedWeeks: 14,
    overview: '店铺运营是电商行业的基础岗位，负责淘宝、天猫、京东、拼多多等平台店铺的整体运营。需要具备产品思维、数据分析能力和平台规则理解能力。主要工作包括产品上架优化、流量获取、转化率提升、客户服务、数据分析等。',
    careerPath: ['运营助理', '店铺运营专员', '运营主管', '运营经理', '电商总监'],
    salaryRange: '6k-16k/月（专员），16k-30k/月（经理）+ 提成',
    marketDemand: '持续稳定，电商行业发展成熟，店铺运营是每个电商公司的标配岗位'
  },
  {
    id: 'shortvideo',
    name: '短视频运营',
    description: '策划、制作和推广短视频内容，打造爆款和增长粉丝',
    icon: 'video',
    color: '#F59E0B',
    weeklyHours: 16,
    estimatedWeeks: 11,
    overview: '短视频运营是内容创业和品牌营销的热门岗位，负责抖音、快手、视频号等平台的内容运营。需要具备内容敏感度、网感、数据分析能力和创意能力。主要工作包括内容策划、脚本撰写、拍摄剪辑指导、发布推广、粉丝互动、数据分析优化等。',
    careerPath: ['短视频运营助理', '短视频运营专员', '内容主管', '内容经理', '内容总监'],
    salaryRange: '7k-20k/月（专员），20k-40k/月（经理）+ 绩效',
    marketDemand: '非常旺盛，短视频已经成为主流内容形式，各企业都在布局短视频营销'
  }
];

export const getPositionById = (id: string): Position | undefined => {
  return positions.find(p => p.id === id);
};
import { SourceData } from '../types'

export const rampDatabase: SourceData[] = [
  {
    communityName: '阳光花园',
    metroStation: '地铁2号线 人民广场站',
    detourRoute: '从3号口出，沿人民路向北200米，经无障碍坡道进入小区西门',
    hasRamp: true,
    rampCondition: '完好',
    barrierFreeInfo: '西门有无障碍坡道，坡度1:12，宽度1.5米',
    sourceDate: '2026-05-28',
  },
  {
    communityName: '幸福村小区',
    metroStation: '地铁3号线 幸福路站',
    detourRoute: '从2号口出，沿幸福路向东300米，经小区南门无障碍通道进入',
    hasRamp: true,
    rampCondition: '完好',
    barrierFreeInfo: '南门有无障碍坡道',
    sourceDate: '2026-03-15',
  },
  {
    communityName: '和平里小区',
    metroStation: '地铁1号线 和平里站',
    detourRoute: '从4号口出，沿和平街向西150米，经北门旁侧无障碍坡道进入',
    hasRamp: true,
    rampCondition: '完好',
    barrierFreeInfo: '北门东侧20米处有社区无障碍坡道，2026年5月10日建成并通过验收',
    sourceDate: '2026-05-25',
  },
  {
    communityName: '建设小区',
    metroStation: '地铁4号线 建设路站',
    detourRoute: '从1号口出，沿建设路向南400米，建议绕行南门',
    hasRamp: true,
    rampCondition: '损坏待修',
    barrierFreeInfo: '东门坡道5月28日因暴雨损坏，预计6月10日前修复，建议从南门进入',
    sourceDate: '2026-06-02',
  },
  {
    communityName: '翠湖苑',
    metroStation: '地铁5号线 翠湖站',
    detourRoute: '从1号口出，沿翠湖路向西250米，经南门无障碍坡道进入',
    hasRamp: true,
    rampCondition: '完好',
    barrierFreeInfo: '南门有无障碍坡道，坡度1:10，宽度1.8米',
    sourceDate: '2026-06-01',
  },
]

export const nameAliasMap: Record<string, string[]> = {
  '幸福家园': ['幸福村小区'],
  '幸福村小区': ['幸福家园'],
}

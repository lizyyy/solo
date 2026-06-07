import { IntersectionData } from "./types"

export const SAMPLE_SMOOTH: IntersectionData[] = [
  { id: "I001", name: "长安路与建国路", distanceFromStart: 0, cycle: 120, greenRatio: 0.55, offset: 0, direction: "上行", sourceRow: 2, sourceFile: "样例" },
  { id: "I002", name: "长安路与和平路", distanceFromStart: 450, cycle: 120, greenRatio: 0.50, offset: 30, direction: "上行", sourceRow: 3, sourceFile: "样例" },
  { id: "I003", name: "长安路与中山路", distanceFromStart: 980, cycle: 120, greenRatio: 0.48, offset: 55, direction: "上行", sourceRow: 4, sourceFile: "样例" },
  { id: "I004", name: "长安路与解放路", distanceFromStart: 1520, cycle: 120, greenRatio: 0.52, offset: 80, direction: "上行", sourceRow: 5, sourceFile: "样例" },
  { id: "I005", name: "长安路与人民路", distanceFromStart: 2100, cycle: 120, greenRatio: 0.50, offset: 105, direction: "上行", sourceRow: 6, sourceFile: "样例" },
]

export const SAMPLE_REWORK_CSV = `路口编号,路口名称,距起点距离,周期,绿信比,偏移量,方向
I001,光明路与朝阳路,0,100,0.50,0,上行
I002,光明路与安定路,380,100,0.45,25,上行
I002,光明路与安定路(旧),400,100,0.48,28,上行
I004,,,100,,,上行
I005,光明路与幸福路,1.1km,100,0.42,50,上行
I006,光明路与建设路,1500,100,0.00,60,上行
I007,光明路与创新路,1950,100,0.47,72,上行
I008,光明路与科技路,2400,100,0.44,85,上行`

export const SAMPLE_SMOOTH_CSV = `路口编号,路口名称,距起点距离,周期,绿信比,偏移量,方向
I001,长安路与建国路,0,120,0.55,0,上行
I002,长安路与和平路,450,120,0.50,30,上行
I003,长安路与中山路,980,120,0.48,55,上行
I004,长安路与解放路,1520,120,0.52,80,上行
I005,长安路与人民路,2100,120,0.50,105,上行`

export const SAMPLE_ALIAS_CSV = `交叉口编号,交叉口名称,距离,信号周期,green,相位差,行驶方向
J01,幸福大街与朝阳路,0,100,0.50,0,上行
J02,幸福大街与安定路,350,100,0.45,22,上行
J03,幸福大街与建设路,800,100,0.48,48,上行
J04,幸福大街与创新路,1250,100,0.52,70,上行
J05,幸福大街与科技路,1700,100,0.50,90,上行`

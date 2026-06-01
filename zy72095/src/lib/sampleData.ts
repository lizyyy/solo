import { IntersectionData } from "./types"

export const SAMPLE_SMOOTH: IntersectionData[] = [
  { id: "I001", name: "长安路与建国路", distanceFromStart: 0, cycle: 120, greenRatio: 0.55, offset: 0, direction: "上行" },
  { id: "I002", name: "长安路与和平路", distanceFromStart: 450, cycle: 120, greenRatio: 0.50, offset: 30, direction: "上行" },
  { id: "I003", name: "长安路与中山路", distanceFromStart: 980, cycle: 120, greenRatio: 0.48, offset: 55, direction: "上行" },
  { id: "I004", name: "长安路与解放路", distanceFromStart: 1520, cycle: 120, greenRatio: 0.52, offset: 80, direction: "上行" },
  { id: "I005", name: "长安路与人民路", distanceFromStart: 2100, cycle: 120, greenRatio: 0.50, offset: 105, direction: "上行" },
]

export const SAMPLE_REWORK_RAW = `路口编号\t路口名称\t距起点距离\t周期\t绿信比\t偏移量\t方向
I001\t光明路与朝阳路\t0\t100\t0.50\t0\t上行
I002\t光明路与安定路\t380\t100\t0.45\t25\t上行
I002\t光明路与安定路(旧)\t400\t100\t0.48\t28\t上行
I004\t\t\t100\t\t\t上行
I005\t光明路与幸福路\t1.1km\t100\t0.42\t50\t上行
I006\t光明路与建设路\t1500\t100\t0.00\t60\t上行
I007\t光明路与创新路\t1950\t100\t0.47\t72\t上行
I008\t光明路与科技路\t2400\t100\t0.44\t85\t上行`

export const SAMPLE_SMOOTH_RAW = `路口编号\t路口名称\t距起点距离\t周期\t绿信比\t偏移量\t方向
I001\t长安路与建国路\t0\t120\t0.55\t0\t上行
I002\t长安路与和平路\t450\t120\t0.50\t30\t上行
I003\t长安路与中山路\t980\t120\t0.48\t55\t上行
I004\t长安路与解放路\t1520\t120\t0.52\t80\t上行
I005\t长安路与人民路\t2100\t120\t0.50\t105\t上行`

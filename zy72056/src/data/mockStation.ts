import type { StationPoint } from "./types"

export const FLOORS = ["B1", "B2"]

export const FLOOR_LABELS: Record<string, string> = {
  B1: "B1 站厅层",
  B2: "B2 站台层",
}

export const STATION_BOUNDS = {
  B1: { minX: 0, maxX: 200, minY: 0, maxY: 140 },
  B2: { minX: 0, maxX: 200, minY: 0, maxY: 120 },
}

const BOUNDARY_THRESHOLD = 10

export function isOutOfBounds(point: { x: number; y: number; floor: string }): boolean {
  const bounds = STATION_BOUNDS[point.floor as keyof typeof STATION_BOUNDS]
  if (!bounds) return false
  return (
    point.x < bounds.minX - BOUNDARY_THRESHOLD ||
    point.x > bounds.maxX + BOUNDARY_THRESHOLD ||
    point.y < bounds.minY - BOUNDARY_THRESHOLD ||
    point.y > bounds.maxY + BOUNDARY_THRESHOLD
  )
}

export const mockStationPoints: StationPoint[] = [
  {
    id: "P001", name: "A入口", floor: "B1", type: "entrance",
    x: 20, y: 30, congestion: 0.6, photo: "entrance_a.jpg",
    rawNote: "A入口早高峰人多 门口有栏杆", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P002", name: "B入口", floor: "B1", type: "entrance",
    x: 180, y: 30, congestion: 0.4, photo: "entrance_b.jpg",
    rawNote: "B入口正常", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P003", name: "1号扶梯上行", floor: "B1", type: "escalator",
    x: 60, y: 70, congestion: 0.8, photo: "esc_1.jpg",
    rawNote: "早高峰排队到站厅中间 补了一根隔离带", qualityFlags: [], lastModified: "2026-05-28T08:30:00", supplements: [],
  },
  {
    id: "P004", name: "2号扶梯上行", floor: "B1", type: "escalator",
    x: 140, y: 70, congestion: 0.7, photo: "esc_2.jpg",
    rawNote: "还行", qualityFlags: [], lastModified: "2026-05-28T08:30:00", supplements: [],
  },
  {
    id: "P005", name: "3号扶梯下行", floor: "B1", type: "escalator",
    x: 60, y: 90, congestion: 0.5, photo: "esc_3.jpg",
    rawNote: "", qualityFlags: [], lastModified: "2026-05-28T09:00:00", supplements: [],
  },
  {
    id: "P006", name: "4号扶梯下行", floor: "B1", type: "escalator",
    x: 140, y: 90, congestion: 0.5, photo: "esc_4.jpg",
    rawNote: "旁边有广告牌挡视线", qualityFlags: [], lastModified: "2026-05-28T09:00:00", supplements: [],
  },
  {
    id: "P007", name: "A出口摄像头", floor: "B1", type: "camera",
    x: 30, y: 20, congestion: 0, photo: "cam_a.jpg",
    rawNote: "朝向A入口 能看到闸机区域", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P008", name: "A出口摄像", floor: "B1", type: "camera",
    x: 32, y: 22, congestion: 0, photo: "cam_a2.jpg",
    rawNote: "跟P007是不是同一个??", qualityFlags: [{ type: "duplicate", description: "与P007\"A出口摄像头\"名称高度相似", relatedIds: ["P007"], resolved: false }], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P009", name: "闸机组北", floor: "B1", type: "gate",
    x: 80, y: 50, congestion: 0.9, photo: "gate_n.jpg",
    rawNote: "8个闸机 早高峰全开还是挤", qualityFlags: [], lastModified: "2026-05-28T08:15:00", supplements: [],
  },
  {
    id: "P010", name: "闸机组南", floor: "B1", type: "gate",
    x: 120, y: 50, congestion: 0.7, photo: "gate_s.jpg",
    rawNote: "6个闸机", qualityFlags: [], lastModified: "2026-05-28T08:15:00", supplements: [],
  },
  {
    id: "P011", name: "北通道", floor: "B1", type: "corridor",
    x: 50, y: 40, congestion: 0.3, photo: "corr_n.jpg",
    rawNote: "窄通道 约3m宽", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P012", name: "南通道", floor: "B1", type: "corridor",
    x: 150, y: 40, congestion: 0.35, photo: "corr_s.jpg",
    rawNote: "比北通道宽一点", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P013", name: "中央通道", floor: "B1", type: "corridor",
    x: 100, y: 70, congestion: 0.65, photo: "corr_c.jpg",
    rawNote: "连接南北 主通道 5m宽", qualityFlags: [], lastModified: "2026-05-28T08:20:00", supplements: [],
  },
  {
    id: "P014", name: "C入口摄像头", floor: "B1", type: "camera",
    x: 100, y: 15, congestion: 0, photo: "cam_c.jpg",
    rawNote: "正对中央通道", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P015", name: "1号电梯", floor: "B1", type: "elevator",
    x: 90, y: 80, congestion: 0.2, photo: "elev_1.jpg",
    rawNote: "无障碍电梯 运行正常", qualityFlags: [], lastModified: "2026-05-28T08:30:00", supplements: [],
  },
  {
    id: "P016", name: "C入口", floor: "B1", type: "entrance",
    x: 100, y: 10, congestion: 0.55, photo: "entrance_c.jpg",
    rawNote: "C入口 连接商场", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P017", name: "D出口", floor: "B1", type: "exit",
    x: 30, y: 120, congestion: 0.3, photo: "exit_d.jpg",
    rawNote: "D出口晚高峰出站多", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P018", name: "E出口", floor: "B1", type: "exit",
    x: 170, y: 120, congestion: 0.25, photo: "exit_e.jpg",
    rawNote: "", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P019", name: "站厅西侧摄像头", floor: "B1", type: "camera",
    x: 40, y: 80, congestion: 0, photo: "",
    rawNote: "装了但好像没通电??", qualityFlags: [{ type: "missing_photo", description: "照片缺失", resolved: false }], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P020", name: "站厅东侧摄像头", floor: "B1", type: "camera",
    x: 160, y: 80, congestion: 0, photo: "",
    rawNote: "照片忘了拍 下次补", qualityFlags: [{ type: "missing_photo", description: "照片缺失", resolved: false }], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P021", name: "B1偏移点位X", floor: "B1", type: "camera",
    x: 220, y: 70, congestion: 0, photo: "cam_offset.jpg",
    rawNote: "这个坐标不太对 可能在墙外面 旧图纸上搬过来的",
    qualityFlags: [{ type: "offset", description: "坐标超出站厅边界", resolved: false }],
    lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P022", name: "B1偏移点位Y", floor: "B1", type: "camera",
    x: 100, y: 160, congestion: 0, photo: "",
    rawNote: "也超了 地图上标的位置不对 要核实",
    qualityFlags: [
      { type: "offset", description: "坐标超出站厅边界", resolved: false },
      { type: "missing_photo", description: "照片缺失", resolved: false },
    ],
    lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P023", name: "B2站台北扶梯", floor: "B2", type: "escalator",
    x: 60, y: 50, congestion: 0.75, photo: "b2_esc_n.jpg",
    rawNote: "站台层上行扶梯 排队人多", qualityFlags: [], lastModified: "2026-05-28T08:30:00", supplements: [],
  },
  {
    id: "P024", name: "B2站台南扶梯", floor: "B2", type: "escalator",
    x: 140, y: 50, congestion: 0.65, photo: "b2_esc_s.jpg",
    rawNote: "", qualityFlags: [], lastModified: "2026-05-28T08:30:00", supplements: [],
  },
  {
    id: "P025", name: "B2站台摄像头A", floor: "B2", type: "camera",
    x: 50, y: 30, congestion: 0, photo: "b2_cam_a.jpg",
    rawNote: "站台层北", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P026", name: "B2站台摄像头B", floor: "B2", type: "camera",
    x: 150, y: 30, congestion: 0, photo: "b2_cam_b.jpg",
    rawNote: "站台层南", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P027", name: "B2站台通道北", floor: "B2", type: "corridor",
    x: 70, y: 40, congestion: 0.45, photo: "b2_corr_n.jpg",
    rawNote: "窄", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P028", name: "B2站台通道南", floor: "B2", type: "corridor",
    x: 130, y: 40, congestion: 0.4, photo: "b2_corr_s.jpg",
    rawNote: "", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P029", name: "B2站台电梯", floor: "B2", type: "elevator",
    x: 90, y: 60, congestion: 0.15, photo: "b2_elev.jpg",
    rawNote: "无障碍电梯", qualityFlags: [], lastModified: "2026-05-28T08:30:00", supplements: [],
  },
  {
    id: "P030", name: "B2站台闸机组", floor: "B2", type: "gate",
    x: 100, y: 30, congestion: 0.85, photo: "b2_gate.jpg",
    rawNote: "站台上来的闸机 早高峰高峰", qualityFlags: [], lastModified: "2026-05-28T08:15:00", supplements: [],
  },
  {
    id: "P031", name: "跨楼层异常设备", floor: "B1", type: "camera",
    x: 100, y: 100, congestion: 0, photo: "",
    rawNote: "这个设备ID怎么B1和B2都有了?? 要核实",
    qualityFlags: [
      { type: "cross_floor", description: "同一设备ID出现在B1和B2", relatedIds: ["P032"], resolved: false },
      { type: "missing_photo", description: "照片缺失", resolved: false },
    ],
    lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P032", name: "跨楼层异常设备", floor: "B2", type: "camera",
    x: 100, y: 80, congestion: 0, photo: "",
    rawNote: "跟B1那个重复了 应该只有一个",
    qualityFlags: [
      { type: "cross_floor", description: "同一设备ID出现在B1和B2", relatedIds: ["P031"], resolved: false },
      { type: "missing_photo", description: "照片缺失", resolved: false },
    ],
    lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P033", name: "B2站台出口A", floor: "B2", type: "exit",
    x: 60, y: 90, congestion: 0.35, photo: "b2_exit_a.jpg",
    rawNote: "连接B1扶梯", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P034", name: "B2站台出口B", floor: "B2", type: "exit",
    x: 140, y: 90, congestion: 0.3, photo: "b2_exit_b.jpg",
    rawNote: "", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P035", name: "B1闸机旁摄像头", floor: "B1", type: "camera",
    x: 100, y: 55, congestion: 0, photo: "cam_gate.jpg",
    rawNote: "正对闸机组 画面清晰", qualityFlags: [], lastModified: "2026-05-28T08:00:00", supplements: [],
  },
  {
    id: "P036", name: "B1扶梯上方摄像头", floor: "B1", type: "camera",
    x: 60, y: 65, congestion: 0, photo: "",
    rawNote: "角度不太好 有盲区 要调整",
    qualityFlags: [{ type: "missing_photo", description: "照片缺失", resolved: false }],
    lastModified: "2026-05-28T08:00:00", supplements: [],
  },
]

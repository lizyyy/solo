import type { Checklist } from "../../shared/types.js";

export const LAYER_NAME_REGEX = /^[A-Z]-[A-Z0-9]{2,}-(DRAIN|ROOF|GUTTER)-[A-Z0-9-]+$/;

export const initialChecklists: Checklist[] = [
  {
    id: "rd-001",
    code: "RD-001",
    projectName: "A3 栋屋面排水",
    layerName: "A-ROOF-DRAIN-MAIN",
    isLayerNameValid: true,
    status: "confirmed",
    versions: [
      { version: "v1", isLatest: false, isValid: true, releasedAt: "2026-05-02 09:10", remark: "初版出图" },
      { version: "v2", isLatest: false, isValid: true, releasedAt: "2026-05-12 14:30", remark: "调整雨水斗位置" },
      { version: "v3", isLatest: true, isValid: true, releasedAt: "2026-05-28 10:00", remark: "按审图意见修改坡度" },
    ],
    drainPoints: [
      { id: "p1", label: "1# 雨水斗（DN100）", apiField: "drainPoint_1_spec", x: 18, y: 24, description: "1# 雨水斗，规格 DN100，位于屋面西北角，接立管 WL-1" },
      { id: "p2", label: "2# 雨水斗（DN100）", apiField: "drainPoint_2_spec", x: 72, y: 28, description: "2# 雨水斗，规格 DN100，位于屋面东北角，接立管 WL-2" },
      { id: "p3", label: "天沟找坡 i=0.5%", apiField: "gutter_slope_ratio", x: 46, y: 62, description: "天沟纵向找坡 i=0.5%，坡向两端雨水斗，沟底最低处设泄水口" },
    ],
    bimNotes: [
      { id: "n1", content: "按建施-37 第 3.2 条节点做法执行，防水层上翻 250mm。", createdAt: "2026-05-29 09:20", createdBy: "architect", isWithdrawn: false, isSupplementary: false, versionTag: "v3" },
      { id: "n2", content: "现场已核对：雨水斗品牌为吉博力，与清单一致。", createdAt: "2026-05-30 15:45", createdBy: "operations", isWithdrawn: false, isSupplementary: false, versionTag: "v3" },
    ],
    revisions: [],
    createdAt: "2026-05-02 09:10",
    updatedAt: "2026-05-30 15:45",
    handledBy: "architect",
    assignee: "小赵",
  },
  {
    id: "rd-002",
    code: "RD-002",
    projectName: "B1 栋虹吸排水",
    layerName: "B-SIPHON-DRAIN",
    isLayerNameValid: true,
    status: "pending",
    versions: [
      { version: "v1", isLatest: false, isValid: true, releasedAt: "2026-05-05 11:00", remark: "初版虹吸系统" },
      { version: "v2", isLatest: true, isValid: true, releasedAt: "2026-05-18 16:20", remark: "调整悬吊管标高" },
      { version: "v3", isLatest: false, isValid: false, releasedAt: "2026-06-02 08:50", remark: "（已撤回）编号错误，雨水斗数量统计反了" },
    ],
    drainPoints: [
      { id: "p1", label: "HD-1 虹吸雨水斗", apiField: "siphon_hd1_type", x: 22, y: 32, description: "HD-1 虹吸雨水斗，DN80，不锈钢斗体，配整流罩" },
      { id: "p2", label: "HD-2 虹吸雨水斗", apiField: "siphon_hd2_type", x: 78, y: 36, description: "HD-2 虹吸雨水斗，DN80，与 HD-1 同规格，对称布置" },
      { id: "p3", label: "悬吊管坡度 i=0.003", apiField: "hanger_pipe_slope", x: 50, y: 58, description: "悬吊管按 i=0.003 找坡，严禁倒坡；出户管标高 H=-0.800" },
    ],
    bimNotes: [
      { id: "n1", content: "v3 版本虹吸斗数量：北侧 6 个 / 南侧 4 个。", createdAt: "2026-06-02 08:55", createdBy: "architect", isWithdrawn: true, withdrawnAt: "2026-06-03 10:12", withdrawnBy: "architect", isSupplementary: false, versionTag: "v3" },
      { id: "n2", content: "（后补）撤回原因：v3 编号南北两侧数量写反，应为北侧 4 / 南侧 6。", createdAt: "2026-06-03 10:15", createdBy: "architect", isWithdrawn: false, isSupplementary: true, versionTag: "v2" },
      { id: "n3", content: "待补：施工方尚未提交虹吸系统第三方检测报告。", createdAt: "2026-06-05 14:00", createdBy: "operations", isWithdrawn: false, isSupplementary: false, versionTag: "v2" },
    ],
    revisions: [],
    createdAt: "2026-05-05 11:00",
    updatedAt: "2026-06-05 14:00",
    handledBy: "architect",
    assignee: "小赵",
  },
  {
    id: "rd-003",
    code: "RD-003",
    projectName: "C2 栋雨水斗布置",
    layerName: "layer-x-drain",
    isLayerNameValid: false,
    status: "suspended",
    versions: [
      { version: "v1", isLatest: true, isValid: true, releasedAt: "2026-06-04 13:30", remark: "出图仓促，图层命名暂用旧模板" },
    ],
    drainPoints: [
      { id: "p1", label: "C2-Y1 平箅式雨水斗", apiField: "c2_y1_flat_grate", x: 30, y: 30, description: "C2-Y1 平箅式雨水斗，DN150，设于露台排水最低点" },
      { id: "p2", label: "C2-Y2 侧入式雨水斗", apiField: "c2_y2_side_entry", x: 68, y: 66, description: "C2-Y2 侧入式雨水斗，DN150，女儿墙底部接入" },
    ],
    bimNotes: [
      { id: "n1", content: "图层命名 layer-x-drain 不符合《建筑专业图层统一规定》2025 版，已标记异常，待运营主管确认是否挂起。", createdAt: "2026-06-06 09:00", createdBy: "architect", isWithdrawn: false, isSupplementary: false, versionTag: "v1" },
    ],
    revisions: [],
    createdAt: "2026-06-04 13:30",
    updatedAt: "2026-06-06 09:00",
    handledBy: "operations",
    assignee: "小赵",
  },
  {
    id: "rd-004",
    code: "RD-004",
    projectName: "D 区天沟排水",
    layerName: "D-GUTTER-DRAIN-01",
    isLayerNameValid: true,
    status: "returned",
    versions: [
      { version: "v1", isLatest: false, isValid: true, releasedAt: "2026-05-20 10:00", remark: "初版" },
      { version: "v2", isLatest: true, isValid: true, releasedAt: "2026-06-01 11:30", remark: "增加天沟截面尺寸" },
    ],
    drainPoints: [
      { id: "p1", label: "D 区主天沟 W=400 H=300", apiField: "d_main_gutter_section", x: 50, y: 22, description: "D 区主天沟净截面 宽 400mm × 深 300mm，不锈钢内衬" },
      { id: "p2", label: "溢流口标高 H=+23.850", apiField: "d_overflow_elevation", x: 50, y: 50, description: "溢流口底标高 H=+23.850，净宽 300mm，溢流水排向西侧草坪" },
      { id: "p3", label: "落水口 DN200 ×2 处", apiField: "d_downlet_spec", x: 24, y: 78, description: "落水口 DN200，共 2 处；雨水斗规格（原标注 DN150 与清单不符）" },
    ],
    bimNotes: [
      { id: "n1", content: "v2 版已按意见增加天沟截面，提交确认。", createdAt: "2026-06-01 14:00", createdBy: "architect", isWithdrawn: false, isSupplementary: false, versionTag: "v2" },
      { id: "n2", content: "复核发现：落水口清单为 DN200，但场景标注雨水斗规格仍写 DN150，不一致，退回整改。", createdAt: "2026-06-07 16:30", createdBy: "operations", isWithdrawn: false, isSupplementary: false, versionTag: "v2" },
    ],
    revisions: [
      {
        id: "rev-1",
        changedAt: "2026-06-07 16:30",
        changedBy: "operations",
        fromStatus: "confirmed",
        toStatus: "returned",
        reason: "雨水斗规格与图纸标注不符：清单 DN200 vs 标注 DN150",
        fieldChanges: [
          { field: "status", oldValue: "已确认", newValue: "退回" },
          { field: "3# 落水口标注", oldValue: "雨水斗 DN150", newValue: "待更正为 DN200" },
          { field: "handledBy", oldValue: "architect", newValue: "operations（退回待整改）" },
        ],
      },
    ],
    createdAt: "2026-05-20 10:00",
    updatedAt: "2026-06-07 16:30",
    handledBy: "architect",
    assignee: "小赵",
  },
];

import type { ChangeLog, MaterialRecord } from "@/types";
import { uid } from "./id";

const ts = (offsetMin: number, d = new Date()): string => {
  const x = new Date(d.getTime() - offsetMin * 60 * 1000);
  return x.toISOString();
};

export const buildSampleData = (): {
  records: MaterialRecord[];
  logs: ChangeLog[];
} => {
  const now = new Date();
  const batch1 = `B${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate() - 2).padStart(2, "0")}0915782`;
  const batch2 = `B${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate() - 1).padStart(2, "0")}1430441`;
  const batch3 = `B${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}1005619`;

  const r1: MaterialRecord = {
    id: uid("R"),
    batchNo: batch1,
    materialNo: "MS-2026-0042",
    title: "A栋西翼幕墙玻璃 - 厚度变更 6mm→8mm",
    content: "材料送审表：经日照体量方案比选复核，西翼午后直射辐照偏高，建议幕墙玻璃增厚，同步更新遮阳系数。",
    status: "confirmed",
    remark: "已通知结构预留荷载余量，模型同步更新中",
    isLateChange: false,
    version: 1,
    operator: "小赵",
    createdAt: ts(60 * 48),
    updatedAt: ts(60 * 47),
  };
  const r2: MaterialRecord = {
    id: uid("R"),
    batchNo: batch1,
    materialNo: "MS-2026-0043",
    title: "B栋北侧阳台板 - 挑出缩减 300mm",
    content: "日照体量方案比选：北栋大寒日底层日照时间临界，调整挑板长度后可提高 12 分钟。",
    status: "pending",
    remark: "",
    isLateChange: false,
    version: 1,
    operator: "小赵",
    createdAt: ts(60 * 47.5),
    updatedAt: ts(60 * 47.5),
  };
  const r3: MaterialRecord = {
    id: uid("R"),
    batchNo: batch2,
    materialNo: "MS-2026-0042",
    title: "A栋西翼幕墙玻璃 - 补充Low-E性能参数",
    content: "后补材料：幕墙供应商提供 Low-E 膜系检测报告，遮阳系数 Sc=0.35（原 0.42），重新校核后无需额外增厚。",
    status: "confirmed",
    remark: "原 v1 备注已保留，本版补充性能参数，不覆盖早先判断",
    isLateChange: false,
    version: 2,
    parentId: r1.id,
    operator: "小赵",
    createdAt: ts(60 * 22),
    updatedAt: ts(60 * 21),
  };
  const r4: MaterialRecord = {
    id: uid("R"),
    batchNo: batch2,
    materialNo: "MS-2026-0044",
    title: "C栋架空层景观墙体 - 材质由面砖改为石材",
    content: "送审变更：景观墙体材质调整，建筑底部反射率下降，需复核首层公寓日照时长。",
    status: "revoked",
    remark: "方案评审未通过，保持原面砖方案",
    isLateChange: false,
    version: 1,
    operator: "小赵",
    createdAt: ts(60 * 23),
    updatedAt: ts(60 * 20),
  };
  const r5: MaterialRecord = {
    id: uid("R"),
    batchNo: batch3,
    materialNo: "MS-2026-0045",
    title: "A栋屋顶设备平台 - 高度追加 600mm",
    content: "【晚到变更单】机电专业补送设备基础高度，该变更在本周五下班后才抵达，原正常结果已出。",
    status: "pending",
    remark: "请算法值班人单独评估此变更对西侧住宅的遮挡影响",
    isLateChange: true,
    version: 1,
    operator: "小赵",
    createdAt: ts(90),
    updatedAt: ts(80),
  };
  const r6: MaterialRecord = {
    id: uid("R"),
    batchNo: batch3,
    materialNo: "MS-2026-0043",
    title: "B栋北侧阳台板 - 补充结构计算书",
    content: "后补：结构专业提供挑板缩减后的配筋计算书，挠度与裂缝均满足要求。",
    status: "confirmed",
    remark: "v1 备注保留，本版为结构计算补充件",
    isLateChange: false,
    version: 2,
    parentId: r2.id,
    operator: "小赵",
    createdAt: ts(120),
    updatedAt: ts(110),
  };

  const records = [r1, r2, r3, r4, r5, r6];

  const mkLog = (
    rec: MaterialRecord,
    action: ChangeLog["action"],
    operator: string,
    detail: string,
    offsetMin: number
  ): ChangeLog => ({
    id: uid("L"),
    recordId: rec.id,
    batchNo: rec.batchNo,
    action,
    operator,
    detail,
    timestamp: ts(offsetMin),
    materialNo: rec.materialNo,
    title: rec.title,
  });

  const logs: ChangeLog[] = [
    mkLog(r1, "import", "小赵", "新建记录，初始状态：待确认", 60 * 48),
    mkLog(r1, "confirm", "小赵", "已确认，进入正常结果", 60 * 47),
    mkLog(r2, "import", "小赵", "新建记录，初始状态：待确认", 60 * 47.5),
    mkLog(r4, "import", "小赵", "新建记录，初始状态：待确认", 60 * 23),
    mkLog(r4, "revoke", "小赵", "已撤回，从正常结果移除", 60 * 20),
    mkLog(
      r3,
      "supplement",
      "小赵",
      "后补材料新版本 v2（不覆盖 v1 的判断）",
      60 * 22
    ),
    mkLog(r3, "confirm", "小赵", "已确认，进入正常结果", 60 * 21),
    mkLog(
      r6,
      "supplement",
      "小赵",
      "后补材料新版本 v2（不覆盖 v1 的判断）",
      120
    ),
    mkLog(r6, "confirm", "小赵", "已确认，进入正常结果", 110),
    mkLog(r5, "import", "小赵", "新建记录，初始状态：待确认", 90),
    mkLog(
      r5,
      "mark_late",
      "算法值班人",
      "已标记为晚到变更单，单独拎出、与正常结果隔离",
      80
    ),
    mkLog(r2, "remark", "小赵", "人工备注已更新（已保护原备注不被空值覆盖）", 70),
  ];

  return { records, logs };
};

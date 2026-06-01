import type { LevelConfig, StudentRecord } from "@/types";

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: "sin-slope",
    name: "sin斜坡",
    requiredScore: 60,
    resourceBounds: { min: 0, max: 100 },
    events: [
      {
        id: "evt-sin-1",
        type: "计时",
        trigger: "到达坡顶",
        action: "记录用时并加分",
      },
      {
        id: "evt-sin-2",
        type: "扣分",
        trigger: "踩空滑落",
        action: "扣减当前分数5分",
      },
    ],
  },
  {
    id: "cos-platform",
    name: "cos平台",
    requiredScore: 70,
    resourceBounds: { min: 0, max: 100 },
    events: [],
  },
  {
    id: "tan-cliff",
    name: "tan峭壁",
    requiredScore: 80,
    resourceBounds: { min: 50, max: 30 },
    events: [
      {
        id: "evt-tan-1",
        type: "奖励",
        trigger: "连续攀爬10秒",
        action: "额外加10分",
      },
      {
        id: "evt-tan-1",
        type: "奖励",
        trigger: "连续攀爬10秒",
        action: "额外加10分",
      },
    ],
  },
];

export const STUDENT_RECORDS: StudentRecord[] = [
  {
    id: "rec-001",
    source: "三角函数攀岩馆",
    levelId: "sin-slope",
    score: 85,
    resourceValue: 75,
    rawNote: "sin斜坡完成 85分 资源75 正常提交✅",
    timestamp: "2026-05-28T14:22:00+08:00",
  },
  {
    id: "rec-002",
    source: "三角函数攀岩馆",
    levelId: "tan-cliff",
    score: 45,
    resourceValue: 200,
    rawNote: "tan峭壁??分好像不对 资源那边写的是200不知道哪个对，之前有人说是45也有人说是65 😵‍💫 还有就是事件触发了两次一样的？",
    timestamp: "2026-05-29T09:15:00+08:00",
  },
  {
    id: "rec-003",
    source: "学生练习记录",
    levelId: "sin-slope",
    score: 65,
    resourceValue: 50,
    rawNote: "2024旧版|已转|sin斜坡 65分 资源50 【旧口径录入-阿蓝确认】",
    timestamp: "2025-12-10T16:40:00+08:00",
  },
];

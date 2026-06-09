# 消防分区图纸复核 · Web3D

仅服务"消防分区图纸复核"判断的 Web3D 工具。解决早会场景的核心痛点：**图纸版本一多没人敢确认最新版**。

> 设计说明：Web3D 不做通用展示，只围绕「确认最新版 → 分清谁影响结论 → 补录后追溯改判」三件事。

## 两三步就能上手

### 1. 启动

```bash
pnpm install    # 首次克隆后执行一次
pnpm dev        # 启动本地服务，浏览器打开 http://localhost:5173
```

页面默认加载**最新版图纸**，右上角「页面摘要」卡片立即显示：当前版本、已复核/存疑/驳回数、整体结论。

### 2. 开始复核（三件事）

1. **切版本 → 看联动**：左侧时间轴从上到下点击 5 个版本节点，观察 3D 分区颜色和右上角摘要的联动变化。
2. **筛来源 → 辨影响**：左侧「材料来源筛选」分别关闭 CAD图层旧版 / 后补备注 / 口头备注 三档开关，查看摘要的结论如何变化。
3. **点对象 → 查详情**：3D 画布中点选任意分区盒子，右侧滑出详情，最底部「结论影响链」逐条告诉你——**到底是哪份材料影响了结论**。

### 3. 补录并追溯

1. 分区详情面板 → 右上角「补录备注」按钮 → 填写标题/内容/操作人 → 提交。
2. 结论自动重算，新改判记录会自动插入底部「历史追溯」面板。
3. 摘要卡底部出现「已选分区」行 → 点「追溯历史」→ 每条记录左右分栏：**旧材料快照 ➜ 新备注 + 改判原因**。

---

## 坏材料来了 · 去哪里看

早会最常见的三种"坏材料"场景，对照下表直接定位：

| 场景 | 去哪里看 | 关键入口 |
|------|----------|----------|
| 顶部出现红色「坐标偏移 mm」横幅，不知道先补什么 | 偏移条右侧「补材清单」按钮，按 ①→②→③ 优先级顺序 | [OffsetWarningBar.tsx](src/components/OffsetWarningBar.tsx) |
| 混进了一份 CAD 图层旧版，分不清哪些分区受了影响 | 左侧来源筛选只开「CAD图层旧版」，关闭其他两档 → 3D里灰色（未复核）的就是仅靠其他来源支撑的分区；再看摘要里"影响结论关键来源"的计数 | [SourceFilter.tsx](src/components/SourceFilter.tsx) + [SummaryCard.tsx](src/components/SummaryCard.tsx) |
| 一条后补备注让结论变了，想知道前后差异 | 底部历史追溯面板 → 该条记录左栏「旧材料快照」vs 右栏「新备注」+下方「改判原因」→ 点右上「跳到该版本」回看 | [HistoryPanel.tsx](src/components/HistoryPanel.tsx) |
| 阿乔几句口头备注让大家拿不定主意 | 点对应分区 → 右侧详情中「口头备注」卡片会标注是否"影响结论"（带橙色徽标的就是），底部影响链汇总列出 | [ZoneDetailPanel.tsx](src/components/ZoneDetailPanel.tsx) |
| 接手的人完全不知道怎么上手 | 右下角悬浮 `?` 圆形按钮 → 接手人指引抽屉：样例放哪 / 怎么重跑 / 页面摘要去哪看 + FAQ | [GuideDrawer.tsx](src/components/GuideDrawer.tsx) |

---

## 样例 / 数据 / 入口 速查

| 项 | 位置 | 说明 |
|----|------|------|
| 样例数据 | [src/data/mockData.ts](src/data/mockData.ts) | `VERSIONS`（5个版本）/ `ZONES`（20个分区）/ `HISTORY_EVENTS`（8条改判） |
| 结论计算规则 | [src/utils/conclusion.ts](src/utils/conclusion.ts) | `computeZoneStatusFromMaterials` —— 三类材料与筛选组合下的状态判定 |
| 四方联动 Store | [src/store/reviewStore.ts](src/store/reviewStore.ts) | 版本切换 / 来源筛选 / 对象点选 / 摘要刷新，全部由 Zustand `deriveState` 一次重算 |
| 页面摘要入口 | 画布右上角「页面摘要」卡片，任何操作后立即刷新 | [SummaryCard.tsx](src/components/SummaryCard.tsx) |
| 3D 场景入口 | 中央画布，正交相机 + 线框盒子，左键旋转/滚轮缩放/点选 | [Scene3D.tsx](src/components/Scene3D.tsx) |
| 类型定义 | [src/types/index.ts](src/types/index.ts) | `Zone / Material / VersionNode / HistoryEvent / PageSummary` 等 |

## 构建验证

```bash
pnpm check     # 类型检查
pnpm build     # 生产构建到 dist/
pnpm preview   # 预览生产构建
```

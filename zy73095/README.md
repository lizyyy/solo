# 消防分区图纸复核 · Web3D

仅服务**"消防分区图纸复核"判断**的 Web3D 工具。解决早会场景的核心痛点：**图纸版本一多没人敢确认最新版**。

> 设计原则：不做通用 3D 展示，只围绕「确认最新版 → 分清谁影响结论 → 补录后追溯改判」三件事。

---

## ⚠️ 运行前必读 · 无需任何手工改 node_modules

本项目用 **pnpm patch 持久化补丁**解决 Node 20+/24 下 Rollup 原生二进制签名不兼容问题，补丁随仓库一起交付，`pnpm install` 时会自动应用；每次 `pnpm dev` / `pnpm build` 前都会自动执行环境自检脚本，发现问题会给出明确修复指引，**完全不需要你手动改 node_modules**。

---

## 两三步就能上手（接手人照做即可）

### 第 1 步 · 切 Node + 安装依赖

> 建议用 [nvm](https://nvm.sh) / [fnm](https://github.com/Schniz/fnm) 自动读取 `.nvmrc`。

```bash
# 进入项目目录后先切版本（项目根有 .nvmrc 推荐 v20.18.3 LTS）
nvm use          # 或 fnm use，任何 Node >=18.0.0 或 >=20.0.0 都可以
pnpm install     # 仅首次克隆后执行一次，自动安装 + 自动应用 patches/rollup@4.61.1.patch
pnpm check-env   # 可选：手动确认环境是否就绪（pnpm dev / pnpm build 前会自动跑）
```

✅ `pnpm check-env` 全绿后再继续，如有红色报错按提示操作即可。

### 第 2 步 · 启动并进入复核

```bash
pnpm dev         # 启动本地开发服务
```

浏览器自动打开 **http://localhost:5173**，页面默认加载最新版图纸（v2024.05.28），进入后：

- **样例数据放哪**：所有版本 / 分区 / 材料 / 历史样例全部在 [src/data/mockData.ts](src/data/mockData.ts)
- **怎么重跑复核**：顶部菜单不存在，直接在当前页操作左侧时间轴 → 3D 点选 → 右上角摘要，三步形成闭环
- **页面摘要去哪看**：画布右上角固定「页面摘要」卡片，**任何操作后立即刷新**，不需要手动点击任何按钮

### 第 3 步 · 核心复核三件事

1. **切时间轴 → 看四方联动**：左侧竖排 5 个圆形节点代表 5 个版本，从上到下依次点击。切到 **v2024.04.20（带红色 FileWarning 图标的"坐标偏移 35 mm"版）**时，顶部会立刻弹出红色偏移预警横幅。
2. **筛来源 → 辨影响结论**：左侧「材料来源筛选」三档开关，每行显示"影响结论的材料 N 条"。先全开关闭再逐一打开，观察右上角摘要数字和颜色的联动变化。
3. **点对象 → 看影响链**：3D 画布中点击任意分区盒子，右侧滑出详情面板。面板底部「结论影响链」逐条列出——**到底是哪份材料、什么来源、为什么影响了结论**。

---

## 坏材料来了 · 先看哪里（早会高频 4 场景）

现场最常遇到的四类"坏材料"混入场景，按顺序查：

| # | 场景 | 第一步先看哪里 | 定位到什么内容 | 对应组件 |
|---|------|----------------|----------------|----------|
| 1 | **混进了旧 CAD 图层**，不知道哪些分区被拖垮 | 左侧来源筛选**只打开「CAD 图层旧版」**，同时关闭后补备注、口头备注 | 3D 里颜色变灰/变红的就是仅被旧版拖垮的分区；摘要卡的"影响结论关键来源"会直接显示被 CAD 旧版拉低的次数 | [SourceFilter.tsx](src/components/SourceFilter.tsx) + [SummaryCard.tsx](src/components/SummaryCard.tsx) |
| 2 | **一条后补备注改判了结论**，想知道前后差什么 | 底部「历史追溯」面板 → 找到对应的改判记录 → **左右分栏对照** | 左栏=旧材料快照，右栏=新备注内容，下方是改判原因文字；右上角"跳到该版本"可直接回到当时状态 | [HistoryPanel.tsx](src/components/HistoryPanel.tsx) |
| 3 | **几句口头备注让大家拿不定**，到底算不算数 | 点选对应分区 → 右侧滑出详情面板 → **每张材料卡右上角的橙色"影响结论"徽标** | 口头备注卡片会明确标注"是否影响结论"；底部"结论影响链"会汇总口头备注的权重 | [ZoneDetailPanel.tsx](src/components/ZoneDetailPanel.tsx) |
| 4 | **顶部出现红色坐标偏移横幅**，接手人不知道先补什么 | 横幅右侧「**补材清单**」按钮 → 展开按 ① → ② → ③ 优先级排序的缺失材料列表 | 清单直接告诉接手人"先补哪份、再补哪份"，避免无意义等待；横幅上还有「接手人指引」按钮直达操作说明 | [OffsetWarningBar.tsx](src/components/OffsetWarningBar.tsx) + [GuideDrawer.tsx](src/components/GuideDrawer.tsx) |

> 💡 任何时候完全不知道从哪下手 → 点击右下角悬浮 `?` 圆形按钮，打开「接手人指引抽屉」，三步卡片 + 坏材料场景对照表直接看。

---

## 样例 / 重跑 / 摘要 · 速查入口

| 问 | 答 | 对应文件 |
|---|---|---|
| 样例数据放哪？ | `VERSIONS`（5个版本，1个偏移35mm+3项缺失材料）/ `ZONES`（20个分区，B1/F1/F2三层）/ `HISTORY_EVENTS`（8条改判记录）全部在同一个文件里 | [src/data/mockData.ts](src/data/mockData.ts) |
| 结论怎么重算？ | `computeZoneStatusFromMaterials()` 纯函数，规则：CAD旧版存在→驳回；单条口头→待定；后补+多材料→通过 | [src/utils/conclusion.ts](src/utils/conclusion.ts) |
| 四方联动怎么保证？ | Zustand Store 中 `deriveState()` 单一入口，版本切换 / 来源筛选 / 对象点选 任何动作后一次性重算当前版本、可见分区、筛选后分区、已选分区、页面摘要，五者永远一致 | [src/store/reviewStore.ts](src/store/reviewStore.ts) |
| 页面摘要去哪看？ | 画布右上角**固定卡片**，4 个关键数字（总/已复核/待定+驳回）+ 颜色图标结论 + 关键来源标签云 + 已选分区追溯入口 | [SummaryCard.tsx](src/components/SummaryCard.tsx) |
| 补录备注怎么触发改判？ | 分区详情面板「补录备注」→ 填写提交 → 自动写入历史 + 重算结论 + 摘要刷新，改判后结论变化会同步在历史面板中显示旧材料快照、新备注内容和改判原因 | [ZoneDetailPanel.tsx](src/components/ZoneDetailPanel.tsx) |

---

## 构建验证 / 生产部署

```bash
pnpm check      # 类型检查（tsc --noEmit）
pnpm build      # 生产构建，自动先跑环境检查 → tsc -b → vite build，产出到 dist/
pnpm preview    # 本地预览 dist/ 生产版本
```

✅ 正常构建输出（参考）：
```
dist/index.html                  25.86 kB
dist/assets/index-*.css          19.16 kB
dist/assets/index-*.js         1,171.61 kB  gzip: 311.03 kB
✓ built in 8.26s
```

---

## 技术栈速览（交接备注）

| 领域 | 选型 |
|---|---|
| 前端 | React 18 + TypeScript + Vite 5 |
| 3D 引擎 | Three.js + @react-three/fiber + @react-three/drei（正交相机 / OrbitControls / HTML 悬浮标签） |
| 状态管理 | Zustand 5（单一 deriveState 纯函数驱动四方联动） |
| 样式 | Tailwind CSS 3 + JetBrains Mono（版本号/坐标） + Noto Sans SC（中文正文） |
| 图标 | lucide-react（工程风线性细描边） |
| 构建兼容修复 | `patches/rollup@4.61.1.patch` + `@rollup/wasm-node`（WASM 替代原生二进制，解决 Node 24 签名校验失败） |

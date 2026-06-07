# 音乐夏令营分班系统

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 跑完整演示（推荐新人先看这个）
```bash
npm run demo
```

这个命令会模拟完整的业务流程：
- 第一步：票务导出表第一次导入
- 第二步：琴行店长老周补看音频文件备注
- 第三步：排练变更记录更新
- 自动执行自检，验证数据一致性

### 3. 运行自检
```bash
npm run test
```

覆盖4项核心检查：
- ✅ 重复导入检测
- ✅ 返工原因记录完整性
- ✅ 补录重算一致性
- ✅ 导出一致性（页面/接口/导出同一份数据）

### 4. 启动API服务器
```bash
npm run dev
```

服务启动在 http://localhost:3000

---

## 核心特性

### 1. 三步核心流程
1. **票务导入**：支持CSV导入，自动检测文件级和记录级重复
2. **音频备注补充**：老周回看音频后补充备注，含返工原因自动标记
3. **排练变更更新**：记录每次变更，可关联返工备注

### 2. 返工原因处理机制
- 轨道备注标记为返工原因时，系统自动将状态设为 `rework_detected`
- 老周可以保留返工原因并写明理由
- **不会自动归为正常**，状态流转为 `pending_review` 等待版权运营复核
- 版权运营复核后决定是 `reviewed_normal` 还是 `reviewed_rework`

### 3. 全程留痕
每一条票务记录都保留：
- 原始行号（`originalRowNumber`）
- 人工改动记录（`manualChanges`），含改动前后值、改动人、理由
- 当前处理状态（`processingStatus`）
- 原始CSV数据（`rawData`）

### 4. 数据一致性
- 页面展示、API接口、CSV导出 **读同一份数据**
- 返工原因不会在一个地方显示异常、另一个地方消失
- 自检模块随时验证一致性

### 5. 排练变更详情
- 排练变更不只是总览
- 可点开单条变更，查看：
  - 变更类型、原值、新值
  - 变更人、变更时间、变更理由
  - 关联的返工备注ID

---

## 状态流转图

```
imported (已导入)
    ↓ 补充音频备注
audio_remark_added (音频备注已补) ── 含返工关键词 ──→ rework_detected (检测到返工)
    ↓ 更新排练                                      ↓
rehearsal_updated (排练已更新)                       ↓ 老周保留理由
    ↓ 重算                                          ↓
finalized (已完成)                            pending_review (待复核)
    ↑                                             ↓ 版权运营复核
    └──────── reviewed_normal (复核通过) ←──────────┼────────→ reviewed_rework (确认返工)
```

---

## 目录结构

```
src/
├── types/              # 类型定义
├── store/              # 数据存储
├── import/             # 票务导入模块
├── track/              # 轨道备注/音频/排练变更管理
├── classification/     # 分班算法和重算
├── unified-output/     # 统一数据输出层（页面/接口/导出共用）
├── self-check/         # 自检模块
├── sample-data/        # 样例数据
├── demo/               # 演示脚本
└── index.ts            # API服务器入口
```

---

## API 说明

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| POST | /api/import | 导入票务CSV |
| GET | /api/tickets | 获取所有记录（列表页） |
| GET | /api/tickets/:id | 获取单条记录详情 |
| POST | /api/tickets/:id/audio-remark | 添加音频备注 |
| POST | /api/tickets/:id/track-remark | 添加轨道备注（可标记返工） |
| POST | /api/tickets/:id/rehearsal-change | 添加排练变更 |
| GET | /api/tickets/:rowId/rehearsal-changes/:changeId | 查看排练变更详情 |
| POST | /api/tickets/:id/review-rework | 版权运营复核返工 |
| POST | /api/recalculate | 补录后重算分班 |
| GET | /api/self-check | 执行自检 |
| GET | /api/export | 导出CSV（与页面同一份数据） |

---

## 样例数据

样例CSV在 `src/sample-data/tickets.csv`，包含10条学生记录。

运行 `npm run demo` 会自动使用这份样例数据跑完整流程。

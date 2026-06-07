# 工艺参数推荐回看系统

## 项目概述

用于工艺参数推荐结果的回看、复核和追溯管理系统，确保低置信度样本不被平均指标掩盖，支持完整的审计追踪。

## 角色定义

- **算法运营（老唐）**：导入提示词版本、补充知识库链接、执行初步复核
- **知识库编辑**：复核低置信度样本、执行状态变更、回滚操作
- **模型研发**：对比模型版本、更新参数

---

## 核心边界规则

### 1. 低置信度样本判定

| 置信等级 | 分数阈值 | 处理方式 |
|---------|---------|---------|
| 高 | >= 0.8 | 自动进入待复核 |
| 中 | 0.5 ~ 0.8 | 待复核，建议人工确认 |
| 低 | < 0.5 | 自动标记为「需知识库复核」 |

### 2. 平均指标覆盖判定

**被平均指标盖住的条件**（同时满足）：
- 置信分 < 0.5（低置信度）
- 原始值与平均值偏差率 < 10%

**判定逻辑代码**：[boundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/utils/boundaryRules.ts#L24-L34)

### 3. 状态流转规则

| 当前状态 | 可流转到 | 允许角色 |
|---------|---------|---------|
| 待复核(pending_review) | 需知识库复核、已确认 | 算法运营、知识库编辑 |
| 需知识库复核(needs_knowledge_review) | 待复核、已确认、已回滚 | 知识库编辑 |
| 已确认(confirmed) | 待复核、需知识库复核、已回滚 | 知识库编辑 |
| 已回滚(rolled_back) | 待复核、需知识库复核 | 知识库编辑 |

**重要约束**：被平均指标盖住的低置信度样本，算法运营不能直接确认，必须由知识库编辑复核。

### 4. 回滚机制

- 仅知识库编辑可执行回滚
- 回滚后保留完整历史记录
- 回滚样本可重新进入复核流程

---

## 三段式追溯流程

系统完整支持以下三步流程的追溯：

### 第一步：提示词版本导入
- 算法运营导入提示词版本及其样本
- 系统自动判定置信度和是否被平均指标覆盖
- 低置信度且被覆盖的样本自动标记为「需知识库复核」
- 记录操作人和时间戳

**代码**：[services/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/services/index.ts#L29-L109)

### 第二步：知识库引用链接补录
- 算法运营回看时补充知识库引用链接
- 所有关联样本自动记录该操作
- 可在历史中看到链接补录的时间和操作人

**代码**：[services/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/services/index.ts#L132-L162)

### 第三步：模型版本对比更新
- 模型研发对比并记录模型版本
- 所有关联样本自动记录对比操作
- 支持查看版本变更摘要

**代码**：[services/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/services/index.ts#L314-L342)

---

## 关键功能特性

### ✅ 幂等导入（防止数量翻倍）
- 同一提示词版本重复导入时，不会重复创建样本
- 样本数据有变化时更新，无变化时跳过
- 导入结果返回 created/updated/skipped 计数

**实现**：[services/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/services/index.ts#L39-L107)

### ✅ 备注修改历史追踪
- 修改备注时记录 oldRemark 和 newRemark
- 历史中可清晰看到改前改后的差别
- 按时间顺序排列，支持审计

**实现**：[services/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/services/index.ts#L164-L184)

### ✅ 3D/图表展示的追溯链接
- 图表数据中的每个点都附带 drilldownLinks
- 点击可跳转回提示词版本详情、知识库链接、样本详情
- 不会只剩漂亮画面，数据可溯源

**实现**：[services/index.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/services/index.ts#L249-L282)

### ✅ 用户友好的错误提示
- 所有错误返回人话描述，不暴露内部字段名
- 错误码与用户消息分离，便于前端展示

**实现**：[utils/errors.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/utils/errors.ts#L21-L40)

---

## API 接口

| 方法 | 路径 | 说明 |
|-----|------|-----|
| POST | `/api/prompt-versions/import` | 导入提示词版本（幂等） |
| GET | `/api/prompt-versions` | 获取所有提示词版本 |
| GET | `/api/prompt-versions/:id/trace` | 获取三段式追溯信息 |
| GET | `/api/prompt-versions/:id/chart-data` | 获取带追溯链接的图表数据 |
| POST | `/api/knowledge-links` | 补充知识库引用链接 |
| GET | `/api/samples/:id` | 获取样本详情及完整历史 |
| PATCH | `/api/samples/:id/remark` | 修改样本备注 |
| PATCH | `/api/samples/:id/status` | 更新样本状态 |
| GET | `/api/samples?status=xxx` | 按状态查询样本 |
| POST | `/api/model-versions/compare` | 记录模型版本对比 |
| GET | `/api/model-versions?promptVersionId=xxx` | 获取模型版本列表 |

---

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建
npm run build

# 生产运行
npm start
```

服务默认运行在 `http://localhost:3000`

---

## 低置信度样本处理流程（重点）

```
导入样本
   ↓
置信分 < 0.5 且 偏差率 < 10% ?
   ├─ 是 → 状态设为「需知识库复核」→ 通知知识库编辑
   └─ 否 → 状态设为「待复核」 → 算法运营可处理
                                ↓
              算法运营尝试直接确认低置信度样本？
                  ├─ 是 → 被系统拦截，提示需知识库编辑复核
                  └─ 否 → 正常流转
```

---

## 项目结构

```
src/
├── types/          # 类型定义
├── database/       # 数据库初始化
├── dao/            # 数据访问层
├── services/       # 业务逻辑层
├── utils/          # 工具函数（边界规则、错误处理）
├── routes/         # API路由
└── index.ts        # 入口文件
```

---

## 注意事项

1. **不要口头约定规则**：所有边界规则已编码在 [boundaryRules.ts](file:///Users/lzy/pro/solo/workspaces/zy72545/src/utils/boundaryRules.ts) 中，修改需同步更新代码和本文档
2. **平均指标掩盖的样本需谨慎**：这类样本容易被忽略，系统已自动标记，知识库编辑务必复核
3. **历史记录不可删除**：所有操作均留痕，支持完整审计
4. **角色权限严格执行**：状态流转有角色校验，不要绕过权限检查

# 水槽波浪衰减实验 · 数据管理系统

面向实验工程师、维修师傅和训练教练的实验数据管理系统。解决传感器数据导入后温度单位混用（摄氏度/开尔文）导致记录不一致、无法追溯的问题。

## 核心设计原则

1. **数据一致性**：导出明细、页面展示、接口返回读取同一份数据库记录
2. **证据链完整**：每条记录保留原始行号、人工改动、处理状态，完整审计日志
3. **三步工作流**：传感器导入 → 维修师傅补看工况照片 → 交接报告更新
4. **混用不自动归正常**：摄氏度和开尔文混用记录留给训练教练复核
5. **十分钟临会友好**：交接报告一屏可见关键信息

## 技术栈

- **前端**：React 18 + TypeScript + Vite + TailwindCSS + Zustand + React Router
- **后端**：Express 4 + TypeScript
- **数据库**：SQLite (better-sqlite3)，单文件数据库
- **文件存储**：工况照片存于 `uploads/` 目录

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前端 + 后端）
pnpm run dev

# 仅启动前端
pnpm run client:dev

# 仅启动后端
pnpm run server:dev

# 类型检查
pnpm run check

# 构建
pnpm run build
```

- 前端地址：http://localhost:5173
- 后端地址：http://localhost:3001
- API 代理：前端 `/api` 自动代理到后端

## 三步标准工作流

### 第一步：传感器编号第一次导入

1. 访问【数据导入】页面
2. 上传 CSV/Excel 文件，列名支持：
   - `sensor_id` / `传感器编号` / `SensorID`
   - `temperature` / `温度`
   - `unit` / `单位`（可选，未标注时根据数值自动推断）
3. 系统自动检测温度单位混用，标记为"待教练复核"

### 第二步：维修师傅老岑补看工况照片

1. 访问【复核工作台】
2. 切换为"维修师傅"角色
3. 选择待复核记录，可：
   - 上传工况照片
   - 标注"传感器可信"：数据来自传感器，无需修改
   - 标注"照片可信"：根据照片修正温度值
   - 标注"待确认"：暂时无法判断，留待教练处理

### 第三步：交接报告更新

1. 训练教练访问【复核工作台】或【交接报告】
2. 对混用记录进行：
   - **确认**：标记为"教练确认"，正式生效
   - **回滚**：恢复原始传感器读数，记录回滚原因
3. 交接报告自动更新，所有数据来源可追溯

## 边界规则（重要）

详细规则见 [BOUNDARY_RULES.md](file:///Users/lzy/pro/solo/workspaces/zy72356/BOUNDARY_RULES.md)

### 摄氏度与开尔文混用判定

- 同一传感器编号下存在两种单位 → 判定为混用
- 标记 `status = mixed_unit`，不自动转换
- 必须由训练教练最终确认

### 数据一致性保证

- 显示逻辑：`corrected_value`（若存在）→ 否则 `temperature_value`
- 前端、后端、CSV 导出使用同一逻辑
- 不在前端或 API 层做二次计算

### 审计日志

所有操作均记录审计日志，包括：
- 操作人角色
- 原值 → 新值
- 操作时间
- 备注/原因

### 回滚机制

- 仅训练教练可回滚
- 必须填写回滚原因
- 回滚后恢复原始值，但保留所有历史记录

## 项目结构

```
├── api/                    # 后端代码
│   ├── routes/
│   │   └── records.ts      # API 路由
│   ├── services/
│   │   ├── recordService.ts    # 核心业务逻辑 + 规则引擎
│   │   ├── auditService.ts     # 审计日志服务
│   │   └── photoService.ts     # 照片服务
│   ├── db.ts               # 数据库连接 + 迁移
│   ├── types.ts            # 类型定义
│   ├── app.ts              # Express 应用
│   └── server.ts           # 服务器入口
├── src/                    # 前端代码
│   ├── components/
│   │   ├── Layout.tsx      # 布局组件
│   │   └── Badges.tsx      # 状态徽章
│   ├── pages/
│   │   ├── ImportPage.tsx  # 数据导入页
│   │   ├── ReviewPage.tsx  # 复核工作台
│   │   └── ReportPage.tsx  # 交接报告页
│   ├── store.ts            # Zustand 状态管理
│   ├── api.ts              # API 调用封装
│   └── App.tsx             # 路由配置
├── data/                   # SQLite 数据库文件
├── uploads/                # 工况照片存储
├── BOUNDARY_RULES.md       # 边界规则引擎文档
└── README.md               # 本文档
```

## CSV 导入格式示例

```csv
sensor_id,temperature,unit
S001,25.5,C
S001,298.15,K
S002,26.0,C
S002,26.2,C
```

导入后 S001 会被标记为"混用待复核"，S002 标记为"正常"。

## 验证命令

```bash
# 启动服务器后，验证 API 健康检查
curl http://localhost:3001/api/health

# 导入测试数据
curl -X POST -F "file=@test.csv" http://localhost:3001/api/records/import

# 获取交接报告
curl http://localhost:3001/api/report

# 导出 CSV
curl -O http://localhost:3001/api/report/export
```

## 规则修改须知

**任何规则修改必须同时更新以下三处：**

1. [BOUNDARY_RULES.md](file:///Users/lzy/pro/solo/workspaces/zy72356/BOUNDARY_RULES.md)
2. [api/services/recordService.ts](file:///Users/lzy/pro/solo/workspaces/zy72356/api/services/recordService.ts)
3. 本 README 的规则摘要

禁止只改代码不改文档，禁止口头约定规则。

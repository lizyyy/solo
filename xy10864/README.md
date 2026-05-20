# 事故复盘资料系统

一个面向技术团队的全栈事故复盘管理系统，用于记录和追踪事故处理全过程，方便后续复盘和知识沉淀。

## 功能特性

### 后端核心功能
- **事故单管理**: 创建、查询、编辑事故单
- **状态机流转**: 严格的状态流转规则（发现中 → 验证中 → 修复中 → 监控中 → 复盘 → 已归档）
- **时间线记录**: 自动记录所有操作事件，支持手动添加
- **证据链管理**: 支持关联日志、截图、文档、链接等多种证据类型
- **影响范围追踪**: 记录受影响的接口、错误率、客户影响范围
- **行动项管理**: 分配待办任务，追踪执行状态
- **失败原因追溯**: 专门记录失败原因的历史追踪
- **手动补偿记录**: 记录所有手动补偿操作
- **复盘结论录入**: 根因分析、经验教训、改进措施
- **Excel导出**: 完整导出事故所有信息

### 前端控制台功能
- **总览看板**: 统计事故总数、进行中、致命事故、待复盘等指标
- **列表页**: 支持按状态、严重程度筛选，分页展示
- **详情页**: 分标签展示事故完整信息
  - 时间线（支持阶段耗时汇总）
  - 影响范围
  - 证据链
  - 行动项（可更新状态）
  - 失败原因追溯
  - 手动补偿记录
  - 复盘结论
- **快捷操作**: 一键推进状态、导出Excel等

## 技术栈

### 后端
- Node.js + Express
- MongoDB + Mongoose
- xlsx (Excel导出)
- Joi (参数校验)

### 前端
- React 18 + TypeScript
- Ant Design 5
- React Router
- Axios
- Moment.js

## 项目结构

```
.
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── models/         # 数据模型
│   │   ├── controllers/    # 业务逻辑
│   │   ├── routes/         # 路由定义
│   │   └── server.js       # 入口文件
│   └── package.json
└── frontend/               # 前端项目
    ├── src/
    │   ├── pages/          # 页面组件
    │   ├── services/       # API服务
    │   └── types.ts        # 类型定义
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

## 快速开始

### 前置要求
- Node.js >= 16
- MongoDB >= 4.4

### 启动后端服务

```bash
cd backend
npm install
npm start
# 服务运行在 http://localhost:3001
```

### 启动前端服务

```bash
cd frontend
npm install
npm run dev
# 服务运行在 http://localhost:3000
```

## API 接口说明

### 事故单相关
```
POST   /api/incidents              # 创建事故单
GET    /api/incidents              # 获取事故列表（支持分页筛选）
GET    /api/incidents/:id          # 获取事故详情
PATCH  /api/incidents/:id/status   # 更新事故状态
```

### 时间线相关
```
POST   /api/incidents/:id/timeline  # 添加时间线事件
GET    /api/incidents/:id/timeline-summary  # 获取阶段耗时汇总
```

### 证据与影响范围
```
POST   /api/incidents/:id/evidence       # 添加证据
POST   /api/incidents/:id/affected-interface  # 添加影响接口
```

### 行动项与复盘
```
POST   /api/incidents/:id/action-item                    # 添加行动项
PATCH  /api/incidents/:id/action-item/:actionItemId/status  # 更新行动项状态
POST   /api/incidents/:id/review-conclusion              # 录入复盘结论
```

### 补偿与失败原因
```
POST   /api/incidents/:id/compensation    # 记录手动补偿
POST   /api/incidents/:id/failure-reason  # 添加失败原因
```

### 导出
```
GET    /api/incidents/:id/export    # 导出Excel
```

## 状态流转规则

系统严格控制状态流转，**绝对不允许跳步**：

```
发现中 (detecting) → 验证中 (verifying) → 修复中 (fixing) → 监控中 (monitoring) → 复盘 (reviewing) → 已归档 (archived)
```

- 每个状态转换都需要记录操作人和原因
- 状态变更会自动记录到时间线中
- 进入"监控中"状态时自动记录事故结束时间
- 已归档状态不可再修改
- 非法状态转换会返回 400 错误并提示允许的流转方向

## 幂等性保护

系统实现了完善的重复操作防护机制：

1. **时间线事件**：1秒内相同操作人+相同事件视为重复，返回 409 跳过
2. **证据链**：相同 URL 的证据不允许重复添加
3. **影响接口**：相同名称或路径的接口不允许重复添加
4. **行动项**：相同标题的未完成行动项不允许重复创建
5. **行动项状态更新**：相同状态的重复更新会跳过，不重复写入时间线
6. **失败原因**：相同操作人+相同原因的记录不允许重复添加

## 失败原因追溯

失败原因不再是简单字符串，而是完整的可追溯记录：

| 字段 | 说明 |
|------|------|
| reason | 失败原因描述 |
| operator | 记录人 |
| category | 分类（代码缺陷/配置错误/网络问题等） |
| timestamp | 记录时间 |
| _id | 唯一标识 |

## 验收指南

### 页面操作测试
1. 创建新事故单，填写基本信息
2. 在详情页依次推进状态，验证状态机规则
3. 添加时间线事件、证据、影响接口
4. 创建行动项，尝试更新行动项状态
5. 录入失败原因和手动补偿记录
6. 录入复盘结论
7. 导出Excel文件，验证内容完整性

### API 测试建议
```bash
# 创建事故单
curl -X POST http://localhost:3001/api/incidents \
  -H "Content-Type: application/json" \
  -d '{"title":"测试事故","description":"测试描述","severity":"high","startTime":"2024-01-01T00:00:00.000Z","detectedBy":"张三","owner":"李四"}'

# 推进状态
curl -X PATCH http://localhost:3001/api/incidents/{id}/status \
  -H "Content-Type: application/json" \
  -d '{"newStatus":"verifying","operator":"张三","reason":"已确认问题存在"}'

# 重复提交相同状态，验证后端防重处理
```

### 重复操作稳定性验证
- 重复提交相同的状态变更，系统应返回明确错误
- 并发添加时间线事件，验证数据一致性
- 重复添加相同的行动项，确保不会重复创建

## 核心设计原则

1. **后端规则优先**: 所有业务逻辑和校验在后端实现，前端仅做展示和引导
2. **可追溯性**: 所有操作都记录时间线，包含操作人、时间、描述
3. **幂等性设计**: 重复操作不会产生副作用
4. **完整导出**: 支持导出完整的事故报告，便于存档
5. **阶段分析**: 自动计算每个阶段的耗时，便于后续优化

## 后续扩展建议

- 用户认证与权限控制
- 邮件/消息通知
- 事故统计分析报表
- 知识库关联
- SLA 指标计算

# 冷链药品配送签收系统

一个完整的冷链药品配送全栈系统，包含温度箱管理、骑手交接校验、GPS温度追踪、风险评估、签收拦截等核心功能。

## 功能特性

### 服务端核心功能
- **温度箱创建与管理**：支持创建冷链药品温度箱，记录温度范围和药品信息
- **骑手交接校验**：骑手交接时自动校验温度、位置等信息
- **GPS温度节点**：实时记录GPS位置和温度数据
- **签收人拦截**：校验签收人权限和有效性
- **风险等级评估**：基于温度连续性、交接记录等多维度风险评估
- **延误换箱**：记录延误换箱原因、修改人、影响记录
- **四种签收场景**：
  - 正常完成 (success)
  - 被规则拦截 (blocked)
  - 人工复核 (needs_review)
  - 重复提交 (duplicate)
- **完整操作日志**：记录所有修改前后的值，支持审计追踪

### 前端功能
- **报告导出**：导出完整Excel报告，支持按责任人和时间筛选
- **操作日志**：查看完整操作记录，支持筛选和搜索
- **时间线详情**：按温度箱查看完整事件时间线

## 技术栈

### 后端
- Node.js + Express
- TypeScript
- SQLite3 数据库
- ExcelJS (Excel导出)

### 前端
- React 18 + TypeScript
- Ant Design 组件库
- Axios HTTP客户端

## 项目结构

```
cold-chain-system/
├── backend/
│   ├── src/
│   │   ├── index.ts              # 服务入口
│   │   ├── types.ts             # 类型定义
│   │   ├── database.ts           # 数据库配置
│   │   └── services/
│   │       ├── TemperatureBoxService.ts
│   │       ├── RiderHandoverService.ts
│   │       ├── GPSService.ts
│   │       ├── SignOffPersonService.ts
│   │       ├── RiskAssessmentService.ts
│   │       ├── DelayExchangeService.ts
│   │       ├── SignOffService.ts
│   │       ├── OperationLogService.ts
│   │       └── ExportService.ts
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── services/api.ts
    │   └── components/
    │       ├── ExportPanel.tsx
    │       ├── OperationLogs.tsx
    │       └── TimelineDetail.tsx
    └── package.json
```

## 快速开始

### 启动后端服务

```bash
cd backend
npm install
npm run dev
```

后端服务将在 http://localhost:3001 启动

### 启动前端服务

```bash
cd frontend
npm install
npm start
```

前端服务将在 http://localhost:3000 启动

## API接口

### 温度箱
- `POST /api/boxes` - 创建温度箱
- `GET /api/boxes` - 获取所有温度箱
- `GET /api/boxes/:id` - 获取单个温度箱

### 骑手交接
- `POST /api/handovers` - 创建交接记录
- `POST /api/handovers/:id/confirm` - 确认交接
- `GET /api/boxes/:boxId/handovers` - 获取温度箱交接记录

### GPS节点
- `POST /api/gps` - 添加GPS温度节点
- `GET /api/boxes/:boxId/gps` - 获取温度箱GPS记录

### 签收
- `POST /api/signoff` - 执行签收
- `POST /api/signoff/review` - 人工复核
- `GET /api/signoff-records` - 获取签收记录

### 延误换箱
- `POST /api/exchanges` - 创建换箱申请
- `POST /api/exchanges/:id/approve` - 批准换箱
- `GET /api/exchanges` - 获取所有换箱记录

### 日志
- `GET /api/logs` - 获取所有操作日志
- `GET /api/boxes/:boxId/logs` - 获取温度箱操作日志

### 导出
- `POST /api/export/report` - 导出完整报告
- `POST /api/export/timeline/:boxId` - 导出时间线报告

## 签收规则

签收时会进行以下校验：

1. **签收人校验**：检查签收人是否存在、是否授权
2. **骑手交接校验**：检查最后一次交接是否确认、交接温度是否正常
3. **温度连续性校验**：检查GPS温度数据是否连续、是否在正常范围内
4. **风险评估**：综合评估风险等级，高风险需要人工复核

## 报告内容

导出的Excel报告包含以下工作表：

1. **温度箱列表**：所有温度箱基本信息
2. **延误换箱记录**：换箱原因、修改人、影响记录、审核信息
3. **骑手交接记录**：所有交接记录详情
4. **GPS温度节点**：所有GPS温度数据
5. **操作日志**：完整操作记录，包含修改前后值

## 数据库表结构

- temperature_boxes - 温度箱表
- rider_handovers - 骑手交接表
- gps_nodes - GPS节点表
- sign_off_persons - 签收人表
- delay_exchanges - 延误换箱表
- risk_assessments - 风险评估表
- operation_logs - 操作日志表
- sign_off_records - 签收记录表

## License

MIT

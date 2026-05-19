# 检验科危急值对账服务

这是一个面向检验科夜班组的危急值对账后端服务，用于自动比对危急值记录、电话回告记录和科室值班表，帮助工作人员快速发现差异并进行人工复核。

## 功能特性

### 1. 数据导入
- **危急值CSV导入**：支持从CSV文件导入危急值检验记录
- **电话回告JSON导入**：支持JSON格式的电话回告记录导入
- **值班表CSV导入**：支持科室值班表的CSV导入

### 2. 自动对账
系统自动检测以下差异类型：

| 差异类型 | 说明 | 严重程度 |
|---------|------|---------|
| **未回告** | 危急值报告后找不到电话回告记录 | 高 |
| **回告超时** | 电话回告时间超过阈值（紧急10分钟，普通30分钟） | 高/中 |
| **多次危急值** | 同一患者短时间内出现多条危急值记录 | 中 |
| **夜班交接缺口** | 夜班回告医生不在值班表中，或值班表缺失 | 高/中 |
| **医生确认缺失** | 电话已拨通但没有医生确认记录 | 中 |
| **数据不一致** | 患者姓名等基础信息不一致 | 低 |

### 3. 人工复核
- **确认复核**：对差异记录进行确认
- **修改回告**：修正电话回告记录，修改后自动重新对账
- **忽略差异**：对确认无误的差异进行忽略处理
- **操作历史**：完整记录所有复核操作

### 4. 报告导出
- **对账报告CSV**：导出完整的对账结果
- **差异报告CSV**：导出所有差异明细
- **汇总报告**：展示统计数据、按科室统计、TOP问题列表

## 技术栈

- **运行时**: Node.js 16+
- **框架**: Express.js
- **语言**: TypeScript
- **测试**: Jest

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动服务

```bash
npm start
```

开发模式（自动重启）：

```bash
npm run dev
```

服务启动后访问：`http://localhost:3000`

## API 接口

### 健康检查
```
GET /api/health
```

### 数据导入
```
POST /api/import/critical-values  - 导入危急值CSV
POST /api/import/callbacks        - 导入电话回告JSON
POST /api/import/duty-schedules   - 导入值班表CSV
```

### 对账操作
```
POST /api/reconciliation/run      - 执行对账
GET  /api/reconciliation          - 获取对账结果列表
GET  /api/reconciliation/:id      - 获取对账详情
```

### 复核操作
```
POST /api/reconciliation/:id/confirm  - 确认复核
POST /api/reconciliation/:id/modify   - 修改回告记录
POST /api/reconciliation/:id/dismiss  - 忽略差异
GET  /api/reconciliation/:id/history  - 获取复核历史
```

### 报告导出
```
GET  /api/report/summary               - 获取汇总报告
GET  /api/report/export/reconciliation - 导出对账报告CSV
GET  /api/report/export/discrepancy    - 导出差异报告CSV
```

### 数据管理
```
DELETE /api/data/clear  - 清空所有数据
```

## 使用示例

### 1. 导入示例数据

```bash
# 导入危急值
curl -X POST -F "file=@examples/critical_values.csv" http://localhost:3000/api/import/critical-values

# 导入电话回告
curl -X POST -H "Content-Type: application/json" -d "@examples/callbacks.json" http://localhost:3000/api/import/callbacks

# 导入值班表
curl -X POST -F "file=@examples/duty_schedules.csv" http://localhost:3000/api/import/duty-schedules
```

### 2. 执行对账

```bash
curl -X POST http://localhost:3000/api/reconciliation/run
```

### 3. 查看对账结果

```bash
curl http://localhost:3000/api/reconciliation
```

### 4. 查看汇总报告

```bash
curl http://localhost:3000/api/report/summary
```

### 5. 导出报告

```bash
curl -O http://localhost:3000/api/report/export/reconciliation
curl -O http://localhost:3000/api/report/export/discrepancy
```

## 数据格式说明

### 危急值CSV字段

| 字段名 | 必填 | 说明 |
|-------|-----|------|
| 患者ID | 是 | 患者唯一标识 |
| 患者姓名 | 是 | 患者姓名 |
| 科室 | 是 | 所在科室 |
| 病区 | 否 | 所在病区 |
| 床号 | 否 | 床位号 |
| 检验项目 | 是 | 检验项目名称 |
| 检验结果 | 是 | 检验结果值 |
| 参考范围 | 否 | 参考值范围 |
| 优先级 | 否 | normal/urgent/emergency |
| 报告时间 | 是 | 危急值报告时间 |
| 报告人 | 否 | 报告检验师 |
| 备注 | 否 | 备注信息 |

### 电话回告JSON字段

| 字段名 | 必填 | 说明 |
|-------|-----|------|
| patientId | 是 | 患者ID |
| patientName | 是 | 患者姓名 |
| calledAt | 是 | 拨打电话时间 |
| calledBy | 否 | 拨打人 |
| calledTo | 否 | 拨打号码 |
| doctorName | 否 | 接听医生 |
| confirmedAt | 否 | 医生确认时间 |
| confirmationNotes | 否 | 确认备注 |
| callResult | 否 | 通话结果 |

## 运行测试

```bash
npm test
```

## 项目结构

```
.
├── src/
│   ├── types/                 # 类型定义
│   ├── store/                 # 数据存储层
│   ├── services/              # 业务逻辑层
│   ├── controllers/           # API控制器
│   ├── routes.ts              # 路由配置
│   └── index.ts               # 应用入口
├── tests/                     # 测试文件
├── examples/                  # 示例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 配置说明

- **回告超时阈值**: 紧急级别10分钟，普通级别30分钟
- **多次危急值窗口**: 60分钟内同一患者多条记录
- **夜班定义**: 20:00 - 次日08:00

## License

MIT

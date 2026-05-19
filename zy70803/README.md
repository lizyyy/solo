# 急诊检验危急值回告 API 服务

## 项目概述

本系统为检验科夜班组提供急诊检验危急值回告的自动化处理能力，支持数据分类、状态追踪、审计记录和数据导出。

## 核心功能

### 1. 数据分类
系统自动将传入数据分为三类：

| 分类 | 说明 | 后续动作 |
|------|------|----------|
| **正常** | 数据完整且符合规范 | 自动进入短信通知和电话回告流程 |
| **待补充** | 信息不全或存在疑问 | 通知检验科夜班组补充缺失信息，补充后重新提交 |
| **已拦截** | 存在严重风险或异常 | 转入人工审核流程，由值班组长确认处理方式 |

### 2. 任务状态
任务状态持久化保存，支持以下状态：
- **处理中**：数据已接收，正在处理
- **处理失败**：处理过程中出现错误
- **人工确认**：经过人工审核确认
- **已导出**：数据已导出归档

### 3. 导出字段
导出Excel包含以下完整信息：
- 患者基本信息（ID、姓名、科室、病区、床号）
- 检验信息（项目、值、参考范围、时间）
- 危急值短信记录（内容、时间）
- 电话回告记录（时间、操作人）
- 医生确认记录（确认人、时间）
- 最后处理人
- 数据分类及原因
- 任务状态

### 4. 审计追踪
完整记录所有改动：
- 谁修改的（操作人）
- 修改了什么（字段）
- 为什么修改（原因）
- 修改前后的值
- 修改时间

## 项目结构

```
├── src/
│   ├── models/
│   │   ├── CriticalValueRecord.ts    # 危急值记录实体
│   │   └── AuditLog.ts               # 审计日志实体
│   ├── database/
│   │   └── data-source.ts            # 数据库连接配置
│   ├── services/
│   │   ├── ClassificationService.ts  # 数据分类服务
│   │   ├── CriticalValueService.ts   # 核心业务服务
│   │   └── AuditService.ts           # 审计服务
│   ├── controllers/
│   │   └── criticalValueController.ts # API控制器
│   └── server.ts                     # 服务器入口
├── test/
│   └── test-api.ts                   # 功能测试
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 运行测试
```bash
npx ts-node test/test-api.ts
```

### 3. 启动开发服务器
```bash
npm run dev
```

### 4. 构建生产版本
```bash
npm run build
npm start
```

## API 接口文档

### 基础路径
`http://localhost:3000/api/critical-value`

### 接口列表

#### 1. 创建危急值记录
```
POST /records
```
**请求体：**
```json
{
  "patientId": "P001",
  "patientName": "张三",
  "department": "急诊科",
  "ward": "急诊一区",
  "bedNo": "A01",
  "testItem": "血常规-白细胞计数",
  "testValue": "15.6",
  "referenceRange": "4.0-10.0",
  "testTime": "2024-01-15T09:30:00",
  "reporter": "李检验师",
  "smsContent": "【危急值】张三 白细胞计数:15.6，请及时处理",
  "smsTime": "2024-01-15T09:35:00",
  "phoneCallTime": "2024-01-15T09:40:00",
  "phoneCallOperator": "王护士",
  "doctorConfirmer": "赵医生",
  "doctorConfirmTime": "2024-01-15T09:50:00",
  "finalProcessor": "钱组长",
  "operator": "系统管理员"
}
```

#### 2. 获取记录列表
```
GET /records?page=1&pageSize=20&category=normal&status=processing
```
**查询参数：**
- `page`: 页码（默认1）
- `pageSize`: 每页数量（默认20）
- `category`: 按分类筛选（normal/pending_supplement/blocked）
- `status`: 按状态筛选（processing/failed/manual_confirmed/exported）

#### 3. 获取单条记录详情
```
GET /records/:id
```

#### 4. 更新记录
```
PUT /records/:id
```
**请求体：**
```json
{
  "status": "manual_confirmed",
  "finalProcessor": "新处理人",
  "operator": "质控组长",
  "changeReason": "人工审核通过，数据准确无误"
}
```

#### 5. 更新任务状态
```
PATCH /records/:id/status
```
**请求体：**
```json
{
  "status": "manual_confirmed",
  "operator": "质控组长",
  "reason": "人工审核通过，数据准确无误"
}
```

#### 6. 重新分类记录
```
POST /records/:id/reclassify
```
**请求体：**
```json
{
  "operator": "质控组长",
  "reason": "补充信息后重新分类"
}
```

#### 7. 获取记录变更历史
```
GET /records/:id/history
```

#### 8. 获取统计数据
```
GET /statistics?startDate=2024-01-01&endDate=2024-12-31
```

#### 9. 导出Excel
```
GET /export?startDate=2024-01-01&endDate=2024-12-31
```

#### 10. 健康检查
```
GET /health
```

## 数据分类规则

### 判定为"待补充"的情况
- 缺失关键字段（患者ID、姓名、科室、检验项目、检验值、检验时间）
- 检验值格式异常
- 非工作时间报告需特殊处理
- 高风险项目缺少医生确认人

### 判定为"已拦截"的情况
- 血钾 < 2.5 mmol/L 或 > 6.5 mmol/L
- 血糖 < 2.2 mmol/L 或 > 22.2 mmol/L
- 其他严重异常值

### 高风险检验项目
- 血钾、血钙、血糖、血气分析
- 心肌酶谱、肌钙蛋白、凝血功能
- 血小板计数、白细胞计数

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript
- **Web框架**: Express.js
- **ORM**: TypeORM
- **数据库**: SQLite
- **数据验证**: Joi
- **Excel导出**: SheetJS (xlsx)
- **日期处理**: Moment.js

## 注意事项

1. 数据库文件（`critical_value.db`）会在首次启动时自动创建
2. 所有操作都需要提供`operator`字段用于审计追踪
3. 状态变更必须提供变更原因
4. 导出文件包含完整的审计信息，满足医疗质量管理要求

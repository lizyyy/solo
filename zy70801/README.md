# 检验科危急值整合系统 API

检验科夜班组危急值短信、电话回告、医生确认记录整合系统。

## 功能特性

- 📁 **多源数据导入**：支持危急值CSV、电话回告JSON、科室值班表CSV
- 🔍 **智能分类处理**：自动将记录分为正常项、待确认项、失败项
- ❌ **失败记录追溯**：保留原始字段和建议处理方式
- 🚫 **去重机制**：同一批材料再次提交不会重复生效
- 📋 **业务规则校验**：
  - 未回告超时检测（30分钟阈值）
  - 同患者多次危急值检测（24小时内）
  - 夜班交接缺口检测（22:00-06:00时段）
- 🔎 **值班主任复核**：支持从历史记录追溯来源

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动开发服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API 接口

### 基础路径

所有接口前缀: `http://localhost:3000/api`

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/upload/critical-value` | 上传危急值CSV |
| POST | `/upload/callback` | 上传电话回告JSON |
| POST | `/upload/duty` | 上传科室值班表CSV |
| GET | `/batches` | 获取批次列表 |
| GET | `/batches/:batchId` | 获取批次详情 |
| GET | `/critical-values/:id/review` | 值班主任复核追溯 |
| GET | `/statistics` | 获取统计数据 |

## 文件格式说明

### 1. 危急值 CSV

支持的列名（中英文均可）:
- `patientId` / 患者ID: 患者唯一标识
- `patientName` / 患者姓名: 患者姓名
- `testItem` / 检验项目: 危急值项目名称
- `testValue` / 检验值: 检验结果数值
- `unit` / 单位: 检验单位
- `referenceRange` / 参考范围: 正常参考范围
- `testTime` / 检验时间: 检验时间 (YYYY-MM-DD HH:mm:ss)
- `reportTime` / 报告时间: 报告时间（可选）
- `department` / 科室: 患者所在科室
- `ward` / 病区: 患者所在病区
- `bedNo` / 床号: 病床号

示例文件: `examples/critical-values.csv`

### 2. 电话回告 JSON

```json
[
  {
    "patientId": "P001",
    "patientName": "张三",
    "callbackTime": "2024-01-15 08:35:00",
    "callbackPerson": "李检验师",
    "callbackPhone": "13800138001",
    "receiver": "王医生",
    "receiverPhone": "13900139001",
    "callbackContent": "患者血钾2.8mmol/L，低于危急值",
    "callbackResult": "success"
  }
]
```

示例文件: `examples/callbacks.json`

### 3. 科室值班表 CSV

支持的列名（中英文均可）:
- `date` / 日期: 值班日期 (YYYY-MM-DD)
- `shift` / 班次: `day`(白班) / `night`(夜班)
- `department` / 科室: 科室名称
- `doctorName` / 医生姓名: 值班医生姓名
- `doctorPhone` / 医生电话: 医生联系方式
- `startTime` / 开始时间: 值班开始时间 (HH:mm)
- `endTime` / 结束时间: 值班结束时间 (HH:mm)
- `isOnDuty` / 是否值班: `true`/`false`

示例文件: `examples/duty-schedule.csv`

## 业务规则说明

### 1. 未回告超时检测

- **触发条件**: 检验时间超过30分钟仍无对应回告记录
- **处理结果**: 标记为失败项
- **建议处理**: 立即电话回告临床科室，在系统中补登回告记录

### 2. 同患者多次危急值检测

- **触发条件**: 24小时内同一患者同一检验项目多次出现危急值
- **处理结果**: 标记为待确认项
- **建议处理**: 重点关注该患者病情变化，通知主管医生紧急干预

### 3. 夜班交接缺口检测

- **触发条件**: 22:00-06:00时段出现危急值，但对应科室无夜班值班安排或处于交接班空窗期
- **处理结果**: 标记为待确认项
- **建议处理**: 联系科室值班主任，同时通知交班和接班医生，双签确认

### 4. 必填字段缺失

- **触发条件**: 患者ID、患者姓名、检验项目、检验时间等关键字段缺失
- **处理结果**: 标记为失败项
- **建议处理**: 补全缺失字段后重新导入，或联系信息科核对原始数据

### 5. 批次内重复记录

- **触发条件**: 同一批次内同一患者同一项目同时段重复上报
- **处理结果**: 标记为失败项
- **建议处理**: 去重保留一条，核实是否为同一检验结果的多次上报

## 运行测试

确保服务已启动后，运行测试脚本:

```bash
./test-api.sh
```

## 值班主任复核追溯

调用复核接口:

```bash
curl http://localhost:3000/api/critical-values/{记录ID}/review
```

返回内容包含:
- 危急值基本信息
- 该患者所有电话回告记录
- 同患者历史危急值记录（最近10条）
- 医生确认记录

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── routes.ts             # API 路由
│   ├── db/
│   │   └── index.ts          # 数据库连接
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── services/
│   │   ├── parser.service.ts       # 文件解析服务
│   │   ├── batch.service.ts        # 批次管理服务
│   │   └── rules-engine.service.ts # 业务规则引擎
│   └── scripts/
│       └── init-db.ts        # 数据库初始化脚本
├── examples/                  # 示例数据文件
├── uploads/                   # 上传文件临时目录（自动创建）
├── data/                      # SQLite 数据库文件目录（自动创建）
├── package.json
├── tsconfig.json
├── test-api.sh               # API 测试脚本
└── README.md
```

## 生产部署

```bash
# 1. 构建
npm run build

# 2. 初始化数据库
npm run init-db

# 3. 启动生产服务
npm start
```

## 技术栈

- Node.js + TypeScript
- Express (Web框架)
- SQLite (数据库)
- Multer (文件上传)
- csv-parser (CSV解析)
- dayjs (日期处理)

## 注意事项

1. **文件去重**: 系统通过文件SHA256哈希判断是否重复，相同文件重复提交会被拒绝
2. **数据保留**: 所有上传记录都会永久保存，便于审计和追溯
3. **时区问题**: 系统使用本地时区，建议服务器时区设置为北京时间
4. **文件清理**: 上传的文件处理完成后会自动删除，不会占用磁盘空间

# 🚠 景区缆车检修记录管理 API

景区设备部缆车检修、试运行和放行审批记录统一管理接口。

## ✨ 功能特性

- 📁 **多格式支持**: 支持检修 CSV、传感器 JSON、审批表上传
- 🎯 **智能分类**: 自动将记录分为「正常项」「待确认项」「失败项」
- 📋 **规则校验**: 内置5项核心业务规则校验
- 🔒 **去重机制**: 同一批材料再次提交不会重复生效
- 💡 **可读说明**: 失败项提供人性化说明和处理建议

## 📋 校验规则

| 规则代码 | 规则名称 | 说明 | 严重程度 |
|---------|---------|------|---------|
| `INSUFFICIENT_TRIAL_RUN` | 试运行不足 | 试运行时长<30分钟 或 次数<3次 | 高 |
| `KEY_ITEM_UNSIGNED` | 关键项未签 | 主驱动/制动/钢丝绳/控制柜缺签字 | 严重 |
| `OVERDUE_RELEASE` | 超期放行 | 设备审批有效期已过 | 严重 |
| `ABNORMAL_SENSOR` | 传感器异常 | 温度/振动/速度超出阈值 | 高 |
| `MISSING_APPROVAL` | 缺少审批 | 审批人信息缺失 | 中 |

## 🚀 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务启动后访问: `http://localhost:3000`

### 3. 本地规则测试（无需启动服务）

```bash
npm test
```

## 📡 API 接口

### POST `/api/upload` - 上传并处理记录

**支持的表单字段:**
- `inspectionCsv` - 检修记录 CSV 文件
- `sensorJson` - 传感器数据 JSON 文件
- `approvalForm` - 审批表 JSON 文件

**请求示例 (curl):**

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "inspectionCsv=@sample-data/inspection.csv" \
  -F "sensorJson=@sample-data/sensor.json" \
  -F "approvalForm=@sample-data/approval.json"
```

**返回格式:**

```json
{
  "success": true,
  "batchId": "abc123...",
  "summary": {
    "total": 10,
    "normal": 4,
    "pendingConfirmation": 3,
    "failed": 3
  },
  "data": {
    "normal": [...],
    "pendingConfirmation": [...],
    "failed": [
      {
        "type": "inspection",
        "originalData": { ...原始字段... },
        "failureReason": {
          "code": "INSUFFICIENT_TRIAL_RUN",
          "name": "试运行不足",
          "readableExplanation": "⚠️ LC-002 - 试运行不足：试运行时长20分钟，低于标准30分钟..."
        },
        "suggestion": "建议：1) 补充完成剩余试运行..."
      }
    ]
  }
}
```

### GET `/api/batch/:batchId` - 查询批次处理结果

```bash
curl http://localhost:3000/api/batch/{batchId}
```

## 📁 项目结构

```
.
├── src/
│   ├── index.js                    # 服务入口
│   └── services/
│       ├── batchService.js         # 批次去重服务
│       ├── fileReaderService.js    # 文件读取服务
│       ├── inspectionService.js    # 检修处理服务
│       └── validationService.js    # 规则校验服务
├── sample-data/                    # 示例数据
│   ├── inspection.csv
│   ├── sensor.json
│   └── approval.json
├── test/
│   └── sample-test.js              # 本地测试脚本
├── data/
│   └── batches.json                # 批次处理记录（自动生成）
├── uploads/                        # 上传文件目录（自动生成）
└── package.json
```

## 🎯 快速复跑

```bash
# 1. 安装依赖
npm install

# 2. 运行本地测试（验证所有规则）
npm test

# 3. 启动 API 服务
npm start

# 4. 新开终端，上传示例数据测试
curl -X POST http://localhost:3000/api/upload \
  -F "inspectionCsv=@sample-data/inspection.csv" \
  -F "sensorJson=@sample-data/sensor.json" \
  -F "approvalForm=@sample-data/approval.json"

# 5. 同一批材料再次提交（会提示重复）
curl -X POST http://localhost:3000/api/upload \
  -F "inspectionCsv=@sample-data/inspection.csv"
```

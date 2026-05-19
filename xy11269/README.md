# 客服质检系统

一个专为客服质检组长设计的后端系统，用于自动检测外包转写文本中的问题，包括：
- 是否缺少道歉用语
- 是否缺少退款承诺
- 是否包含敏感词

## 功能特性

✅ **完整质检流程**
- 批量导入转写记录
- 自动扫描检测问题
- 人工复核流程
- 汇总报告生成
- CSV数据导出

✅ **数据安全**
- 敏感字段（姓名、电话、身份证）自动脱敏
- API返回、导出文件、日志均脱敏处理
- 数据持久化存储，重启后不丢失

✅ **状态管理**
- imported: 已导入
- scanned: 已扫描无问题
- pending_review: 待复核
- review_passed: 复核通过
- review_rejected: 复核驳回
- exported: 已导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 运行测试流程（推荐）

直接运行完整流程测试，查看系统实际运行效果：

```bash
npm run test
```

### 3. 启动服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

## API接口说明

### 健康检查
```bash
GET /api/health
```

### 导入转写记录
```bash
POST /api/import
Content-Type: application/json

[
  {
    "externalId": "CALL_001",
    "customerName": "张三",
    "customerPhone": "13800138000",
    "customerIdCard": "110101199001011234",
    "agentName": "李静",
    "agentId": "AG001",
    "callTime": "2024-01-15T09:30:00.000Z",
    "duration": 185,
    "transcription": "客户来电反映问题...",
    "sensitiveFields": ["customerName", "customerPhone", "customerIdCard"]
  }
]
```

### 扫描所有记录
```bash
POST /api/scan
```

### 扫描单条记录
```bash
POST /api/scan/{recordId}
```

### 获取记录列表
```bash
GET /api/records?status=pending_review&mask=true

# status可选值: imported, scanned, pending_review, review_passed, review_rejected, exported
# mask=false 可查看原始敏感数据（谨慎使用）
```

### 人工复核
```bash
POST /api/records/{recordId}/review
Content-Type: application/json

{
  "reviewer": "质检组长",
  "action": "pass",           // pass 通过 | reject 驳回
  "notes": "确认问题属实"
}
```

### 获取汇总报告
```bash
GET /api/summary
```

### 导出CSV报告
```bash
POST /api/export
Content-Type: application/json

{
  "status": "review_passed"   // 可选，指定导出状态
}
```

### 敏感词管理
```bash
GET /api/sensitive-words          # 获取所有敏感词

POST /api/sensitive-words         # 添加敏感词
{
  "word": "投诉",
  "category": "负面情绪",
  "severity": "medium",
  "enabled": true
}
```

### 系统统计
```bash
GET /api/stats
```

## 使用示例

### 使用 curl 命令操作

```bash
# 1. 导入示例数据
curl -X POST http://localhost:3000/api/import \
  -H "Content-Type: application/json" \
  -d '[{
    "externalId": "TEST_001",
    "customerName": "测试用户",
    "customerPhone": "13800138000",
    "agentName": "测试坐席",
    "agentId": "AG_TEST",
    "callTime": "2024-01-15T09:30:00.000Z",
    "duration": 120,
    "transcription": "客户很不满意，说要投诉。坐席只是说会处理，没有道歉也没说退款。",
    "sensitiveFields": ["customerName", "customerPhone"]
  }]'

# 2. 扫描所有
curl -X POST http://localhost:3000/api/scan

# 3. 查看待复核
curl http://localhost:3000/api/records?status=pending_review

# 4. 查看汇总
curl http://localhost:3000/api/summary
```

## 项目结构

```
.
├── src/
│   ├── models/
│   │   └── types.ts          # 数据类型定义
│   ├── services/
│   │   ├── inspection-service.ts  # 核心业务逻辑
│   │   └── text-inspector.ts       # 文本检测逻辑
│   ├── storage/
│   │   └── json-storage.ts   # JSON文件持久化
│   ├── api/
│   │   └── routes.ts         # API路由
│   ├── utils/
│   │   └── data-masker.ts    # 敏感数据脱敏
│   └── index.ts              # 服务入口
├── scripts/
│   ├── sample-data.ts        # 示例数据
│   └── test-flow.ts          # 完整流程测试
├── data/                     # 数据存储目录
│   ├── inspection-records.json
│   └── sensitive-words.json
├── logs/                     # 操作日志
├── exports/                  # 导出文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 检测规则说明

### 道歉检测关键词
- 抱歉、对不起、不好意思、致歉、道歉
- 给您带来不便、请您谅解、请谅解
- sorry、apologize

### 退款承诺检测关键词
- 退款、退费、退钱、返还、退回、赔偿、补款
- 给您退款、帮您退款、可以退款、同意退款
- refund、reimburse

### 默认敏感词库
| 类别 | 词语 | 严重程度 |
|------|------|----------|
| 负面情绪 | 投诉、举报、不满意 | 中/低 |
| 辱骂 | 垃圾、傻逼、滚 | 高 |
| 欺诈 | 欺骗、虚假 | 高 |

## 数据安全说明

1. **脱敏层级**
   - API返回：默认脱敏，可通过 `mask=false` 关闭（谨慎）
   - CSV导出：始终脱敏
   - 日志文件：始终脱敏

2. **脱敏规则**
   - 手机号：138****8000
   - 身份证：1101**********1234
   - 姓名：张*、李*明

## 注意事项

- 数据保存在 `data/` 目录下，JSON格式，可直接备份
- 系统会自动创建备份文件（.bak）防止数据损坏
- 所有操作都会记录到 `logs/storage.log` 日志文件
- 首次启动会自动初始化默认敏感词库

## License

MIT

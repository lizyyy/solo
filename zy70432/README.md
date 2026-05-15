# Mock录制回放器后端服务

## 功能概述

### 1. 核心功能
- **录制回放**: 支持记录的提交和批量处理
- **失效链接检测**: 自动识别下载链接是否失效
- **内容复用**: 相同内容再次提交时复用旧结论
- **冲突检测**: 相同内容但关键信息不同时提示冲突

### 2. 错误处理
- **字段级错误定位**: 精确定位到具体字段的错误
- **失败类型分组**: 按失败类型进行分组过滤查询
- **清晰的错误体结构**: API返回码和错误信息明确

### 3. 审计与导出
- **人工确认流程**: 冲突记录需要人工确认
- **失败记录导出**: 支持CSV/JSON格式导出供复核

## 项目结构

```
.
├── src/
│   ├── index.ts              # 服务入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── store/
│   │   └── index.ts          # 数据存储
│   ├── utils/
│   │   └── validation.ts     # 验证工具
│   ├── services/
│   │   ├── recorder.ts       # 录制服务
│   │   └── export.ts         # 导出服务
│   ├── controllers/
│   │   └── index.ts          # API控制器
│   ├── middleware/
│   │   └── errorHandler.ts   # 错误处理
│   ├── routes/
│   │   └── index.ts          # 路由定义
│   └── sample/
│       ├── data.ts           # 样例数据
│       ├── test-cli.ts       # CLI测试脚本
│       └── test-api.ts       # API测试脚本
├── data/                     # 数据文件目录
├── exports/                  # 导出文件目录
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式启动
```bash
npm run dev
```

服务将在 http://localhost:3000 启动

### 类型检查
```bash
npm run typecheck
```

### 运行CLI测试
```bash
npm run test:cli
```

### 运行API测试
```bash
# 先启动服务
npm run dev

# 另开终端运行测试
npm run test:api
```

## API接口

### 健康检查
```
GET /health
```

### 提交单条记录
```
POST /api/v1/recorder/submit
Content-Type: application/json

{
  "record": {
    "keyword": "搜索词",
    "searchVolume": 1000,
    "clickRate": 12.5,
    "conversionRate": 3.2,
    "avgPosition": 3,
    "competition": "high",
    "category": "分类",
    "region": "地区",
    "downloadUrl": "https://example.com/report.csv",
    "reportDate": "2024-01-15",
    "department": "部门",
    "submittedBy": "提交人"
  },
  "operator": "操作员"
}
```

### 批量提交记录
```
POST /api/v1/recorder/batch
Content-Type: application/json

{
  "records": [...],
  "operator": "操作员"
}
```

### 查询所有失败记录
```
GET /api/v1/recorder/failed
```

### 按失败类型查询
```
GET /api/v1/recorder/failed/{failureType}
```

### 导出失败记录
```
POST /api/v1/export/failed
Content-Type: application/json
x-operator: 操作员

{
  "format": "csv",
  "filterByFailureType": "download_url_invalid"
}
```

### 审计相关
```
GET  /api/v1/audit              # 获取所有审计记录
GET  /api/v1/audit/pending      # 获取待确认记录
POST /api/v1/audit/:id/confirm  # 确认审计记录
```

## 失败类型 (FailureType)

| 类型 | 说明 |
|------|------|
| `download_url_invalid` | 下载链接无效或已过期 |
| `keyword_empty` | 搜索词为空 |
| `search_volume_negative` | 搜索量为负数 |
| `click_rate_out_of_range` | 点击率超出范围(0-100) |
| `conversion_rate_out_of_range` | 转化率超出范围(0-100) |
| `avg_position_invalid` | 平均排名无效 |
| `competition_invalid` | 竞争程度无效 |
| `date_format_invalid` | 日期格式错误 |
| `duplicate_submission` | 重复提交 |
| `conflict_detected` | 冲突检测 |

## HTTP状态码说明

| 状态码 | 说明 |
|--------|------|
| `200` | 成功 |
| `400` | 验证失败(字段错误) |
| `404` | 资源不存在 |
| `409` | 冲突检测 |
| `500` | 服务器错误 |

## 错误体结构

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "记录验证失败",
    "details": {
      "fieldErrors": [
        {
          "field": "downloadUrl",
          "value": "https://example.com/expired.csv",
          "message": "下载链接无效或已过期",
          "failureType": "download_url_invalid"
        }
      ]
    }
  }
}
```

## 样例数据说明

项目包含贴近真实业务的样例数据：
- **有效记录**: 5条，包含不同部门、分类、地区的搜索词报告
- **无效记录**: 9条，覆盖各种错误场景
- **冲突测试记录**: 用于测试冲突检测功能
- **复用测试记录**: 用于测试内容复用功能

## 命令返回码说明

| 返回码 | 说明 |
|--------|------|
| `0` | 成功 |
| `1` | 验证失败(字段错误) |
| `2` | 冲突检测 |
| `3` | 复用旧结论 |

# 公交客服中心 - 失物匹配系统 API

## 项目概述

解决公交失物导入混乱问题：将乘客描述、司机上交和仓库入库记录进行智能匹配，自动分类为正常项、待确认项和失败项，并提供详细的处理建议。

## 核心功能

- **三方智能匹配**: 乘客报失 ↔ 司机上交 ↔ 仓库入库，自动计算匹配度
- **同名物品识别**: 智能识别"苹果手机"与"iPhone"等同义词
- **逾期自动检测**: 乘客报失超过90天、仓库入库超过180天自动标记
- **敏感信息脱敏**: 手机号、身份证、姓名自动隐藏
- **重复批次防重**: 相同文件再次提交自动拦截
- **结果分类返回**: 正常项/待确认项/失败项，附带详细说明

## 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务

```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 构建生产版本

```bash
npm run build
npm start
```

## API 接口

### 1. 健康检查

```
GET /health
```

### 2. 上传文件并匹配

```
POST /api/match/upload
Content-Type: multipart/form-data

参数:
  files: 要上传的CSV文件（支持多个文件同时上传）
```

**支持的CSV文件类型**:
- 乘客报失表（文件名包含 passenger 或 乘客）
- 司机上交表（文件名包含 driver 或 司机）
- 仓库入库表（文件名包含 warehouse 或 仓库）

**返回数据结构**:
```json
{
  "success": true,
  "data": {
    "batchId": "批次ID",
    "processDate": "处理时间",
    "statistics": {
      "total": 14,
      "normal": 2,
      "pending": 9,
      "failed": 3
    },
    "normalItems": {
      "count": 2,
      "description": "匹配度高，可直接确认认领",
      "items": [...]
    },
    "pendingItems": {
      "count": 9,
      "description": "需要人工确认或缺少关联记录",
      "items": [...]
    },
    "failedItems": {
      "count": 3,
      "description": "匹配失败或不符合规则，保留原始数据和处理建议",
      "items": [...]
    }
  }
}
```

### 3. 获取批次历史

```
GET /api/batch/history
```

## 使用示例

### 测试文件上传

项目提供了测试数据，位于 `test-data/` 目录下：

```bash
# 使用 curl 上传测试数据
curl -X POST http://localhost:3000/api/match/upload \
  -F "files=@test-data/passenger.csv" \
  -F "files=@test-data/driver.csv" \
  -F "files=@test-data/warehouse.csv"
```

### 预期结果说明

1. **正常匹配项**:
   - iPhone 14 ↔ 苹果手机 ↔ 黑色苹果手机 （同名物品 + 高匹配度）
   - 钱包 ↔ 棕色钱包 ↔ 皮夹 （同义词识别）

2. **待确认项**:
   - 信息部分匹配需要人工核对
   - 只有单端记录（如仅有仓库入库，无乘客报失）
   - 同名物品但其他信息不完全匹配

3. **失败项**:
   - 逾期超过90/180天的记录
   - 缺少必要信息（如无物品名称）
   - 重复提交的批次

## 业务规则说明

### 1. 同名物品识别

系统内置同义词映射：
- 手机类: "iPhone", "苹果", "华为", "小米", "OPPO", "VIVO"
- 钱包类: "钱包", "皮夹", "手包"
- 钥匙类: "钥匙", "锁匙"
- 雨伞类: "雨伞", "遮阳伞", "伞"

### 2. 逾期规则

- **乘客报失**: 超过 90 天无人认领 → 失败项
- **仓库入库**: 超过 180 天无人认领 → 失败项

### 3. 匹配权重配置

- 物品名称: 40%
- 物品描述: 25%
- 日期匹配: 20%
- 线路匹配: 15%

### 4. 匹配阈值

- ≥ 80 分: 正常项，可直接确认
- 50-79 分: 待确认，需要人工核对
- < 50 分: 低匹配度，建议重新核查

## 目录结构

```
├── src/
│   ├── types/              # 类型定义
│   ├── services/           # 业务服务
│   │   ├── matchService.ts  # 匹配核心逻辑
│   │   └── batchService.ts  # 批次管理防重
│   ├── controllers/        # API 控制器
│   ├── middleware/         # 中间件
│   ├── utils/              # 工具函数
│   └── app.ts              # 应用入口
├── test-data/              # 测试数据
├── data/                   # 运行数据存储
└── package.json
```

## 注意事项

1. CSV 文件编码请使用 UTF-8
2. 文件大小限制为 10MB
3. 单次最多上传 10 个文件
4. 所有返回的失败项均保留原始数据（已脱敏）和处理建议

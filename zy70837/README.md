# 4S店试驾车管理API

## 项目概述

解决4S店试驾车钥匙、油卡和违章记录手工登记混乱问题，实现批量导入、自动校验和结果分类。

## 功能特性

- 📁 支持借还记录CSV、车辆信息JSON、违章回执上传
- ✅ 自动校验超时未还、油卡余额异常、违章归属
- 📊 返回正常项、待确认项、失败项分类结果
- 🔒 批次去重，防止重复提交
- 💡 失败记录保留原始数据和处理建议

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 3. 运行测试

新开一个终端，运行：

```bash
npm test
```

## API接口

### 健康检查

```bash
GET http://localhost:3000/health
```

### 上传接口

```bash
POST http://localhost:3000/api/upload
Content-Type: multipart/form-data

参数:
- batchId: 批次ID（可选，自动生成）
- borrowReturnCsv: 借还记录CSV文件
- vehiclesJson: 车辆信息JSON文件
- violationReceipts: 违章回执文件（可多个）
```

## 业务规则

### 超时未还检测
- 阈值：借出超过24小时未归还
- 说明：记录详细的借出时长、车牌号和借车人信息

### 油卡余额异常检测
- 最低余额阈值：100元
- 说明：检测余额格式和余额低于阈值情况

### 违章归属检测
- 自动匹配违章车牌号与试驾车清单
- 校验违章时间是否落在某条借车记录时间段内
- 自动归属到具体借车人
- 未知车牌/无车牌标记为待确认

### 去重机制
- **batchId去重**：传入相同batchId的请求会被拒绝
- **文件内容哈希去重**：即使不传入batchId，相同内容的文件组也会被识别并拒绝
- 确保同一批材料无论是否传batchId都不会重复生效

## 返回结果示例

```json
{
  "success": true,
  "data": {
    "batchId": "test_batch_001",
    "summary": {
      "total": 8,
      "normal": 3,
      "pending": 3,
      "failed": 2
    },
    "normalItems": [...],
    "pendingItems": [...],
    "failedItems": [...]
  }
}
```

## 目录结构

```
.
├── src/
│   ├── app.js                    # 主入口
│   ├── routes/
│   │   └── upload.js            # 上传路由
│   ├── services/
│   │   ├── uploadService.js     # 文件解析服务
│   │   ├── validationService.js # 校验服务
│   │   └── deduplicationService.js # 去重服务
│   └── middleware/
│       └── errorHandler.js      # 错误处理
├── test-data/                    # 测试数据
├── test/                         # 测试脚本
└── data/                         # 运行时数据
```

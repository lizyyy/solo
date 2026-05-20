# 快闪摊位证照审核系统 API

## 项目概述

这是一个专门为商场招商运营团队设计的快闪摊位证照审核API系统。主要解决营业执照、消防材料、进场时间等信息临时变动导致的导入混乱问题。

## 核心功能

### 1. 批量处理
- 上传摊位申请CSV文件进行批量审核
- 自动分类处理结果：正常、待确认、失败
- 保留原始字段，便于核对

### 2. 业务规则校验

#### 证照过期校验
- 检查营业执照和消防材料有效期
- 提前7天预警即将过期的证照
- 过期证照直接标记为失败

#### 时间冲突检测
- 基于场地日历自动检测摊位时间冲突
- 提供替代时间段建议

#### 押金扣减校验
- 检查押金缴纳比例
- 不足时给出补缴建议

### 3. 去重机制
- 同一批材料再次提交不会重复生效
- 通过batchId标识批次
- 重复提交时返回明确提示

### 4. 追踪溯源
- 支持从单条证照明细追踪到最终报告
- 每个验证结果都有唯一traceId
- 支持按申请ID查询完整处理链路

## 快速开始

### 环境要求
- Node.js >= 14.0.0
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 启动开发服务器
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

### 1. 上传摊位申请CSV

**接口:** `POST /api/booth/upload`

**请求:**
- `file`: CSV文件 (multipart/form-data)
- `batchId`: (可选) 批次ID，不传则自动生成

**示例:**
```bash
curl -X POST http://localhost:3000/api/booth/upload \
  -F "file=@sample/applications.csv" \
  -F "batchId=BATCH-20260520-001"
```

**响应:**
```json
{
  "success": true,
  "reportId": "uuid",
  "batchId": "BATCH-20260520-001",
  "summary": {
    "total": 5,
    "normal": 2,
    "pending": 1,
    "failed": 2
  },
  "normalItems": [...],
  "pendingItems": [...],
  "failedItems": [...]
}
```

### 2. 获取报告列表

**接口:** `GET /api/booth/reports`

### 3. 获取单个报告详情

**接口:** `GET /api/booth/reports/:reportId`

### 4. 追踪验证结果

**接口:** `GET /api/booth/trace/:traceId`

### 5. 申请完整追踪

**接口:** `GET /api/booth/applications/:applicationId/trace`

### 6. 获取场地日历

**接口:** `GET /api/booth/calendar`

### 7. 获取提交记录

**接口:** `GET /api/booth/submissions`

### 8. 健康检查

**接口:** `GET /health`

## CSV 文件格式

### 摊位申请表

| 列名 | 说明 | 示例 |
|------|------|------|
| 摊位编号 | 摊位标识 | A01 |
| 公司名称 | 申请公司名称 | 星光科技有限公司 |
| 联系人 | 联系人姓名 | 张明 |
| 联系电话 | 联系电话 | 13800138001 |
| 进场时间 | 开始日期 | 2026-06-01 |
| 退场时间 | 结束日期 | 2026-06-07 |
| 应缴押金 | 应缴金额 | 5000 |
| 已缴押金 | 已缴金额 | 5000 |
| 营业执照编号 | 证照编号 | LIC-2024-001 |
| 营业执照签发日期 | 签发日期 | 2024-01-15 |
| 营业执照到期日期 | 到期日期 | 2027-01-14 |
| 营业执照文件名 | 文件名 | license_a01.pdf |
| 消防证编号 | 消防证照编号 | FIRE-2024-001 |
| 消防证签发日期 | 签发日期 | 2024-03-20 |
| 消防证到期日期 | 到期日期 | 2027-03-19 |
| 消防证文件名 | 文件名 | fire_a01.pdf |
| 押金收据编号 | 收据编号 | DEP-2026-001 |
| 押金支付日期 | 支付日期 | 2026-05-01 |

## 测试示例

### 测试步骤

1. **启动服务**
```bash
npm install && npm run dev
```

2. **第一次上传示例CSV**
```bash
curl -X POST http://localhost:3000/api/booth/upload \
  -F "file=@sample/applications.csv" \
  -F "batchId=TEST-BATCH-001"
```

3. **查看预期结果**
   - A01: 正常（证照有效、时间无冲突、押金足额
   - A02: 失败（营业执照即将过期）、待确认（押金只交了50%）
   - A03: 失败（缺少消防材料）
   - B01: 正常
   - B02: 待确认（押金为0）

4. **再次上传同一批次**
```bash
curl -X POST http://localhost:3000/api/booth/upload \
  -F "file=@sample/applications.csv" \
  -F "batchId=TEST-BATCH-001"
```
   预期：全部失败，提示重复提交

5. **查看报告列表**
```bash
curl http://localhost:3000/api/booth/reports
```

6. **查看场地日历**
```bash
curl http://localhost:3000/api/booth/calendar
```
   只有正常通过的申请会自动加入场地日历

## 项目结构

```
.
├── src/
│   ├── index.ts              # 应用入口
│   ├── types/
│   │   └── index.ts         # 类型定义
│   ├── store/
│   │   └── memoryStore.ts    # 内存存储
│   ├── services/
│   │   ├── csvParser.ts      # CSV解析服务
│   │   ├── validationService.ts  # 验证服务
│   │   └── batchProcessService.ts  # 批量处理服务
│   └── routes/
│       └── boothRoutes.ts      # API路由
├── sample/
│   └── applications.csv     # 示例数据
├── package.json
├── tsconfig.json
└── README.md
```

## 注意事项

1. 当前版本使用内存存储，重启服务后数据会清空
2. 日期格式请使用 `YYYY-MM-DD` 格式
3. 证照有效期检查会提前7天预警
4. 同一批次再次提交不会生效，需使用新的batchId

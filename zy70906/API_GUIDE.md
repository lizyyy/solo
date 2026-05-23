# 连锁门店积分对账服务 API 使用指南

## 1. 项目概述

本项目是一个**连锁门店积分对账后端服务**，专为解决线下门店积分管理中的常见问题而设计：
- 线下补录积分容易出错
- 退货扣回积分流程不规范
- 活动倍率积分计算复杂
- 人工对账效率低下

通过自动化比对和差异检测，帮助运营人员快速发现并处理积分异常，提升对账效率和准确性。

## 2. 核心功能列表

| 功能模块 | 说明 |
|---------|------|
| **数据导入** | 支持小票CSV文件和会员JSON文件批量导入 |
| **自动比对** | 根据会员等级和活动规则自动计算预期积分 |
| **差异检测** | 智能识别积分不匹配、重复小票、退货无原单、手工记录等异常 |
| **人工复核** | 支持批准/拒绝操作，记录复核人和备注信息 |
| **报告生成** | 生成汇总统计报告和详细对账记录 |
| **数据同步** | 复核完成后，详情、汇总、报告数据自动同步更新 |

## 3. 快速开始

### 3.1 启动服务

```bash
# 进入项目目录
cd /Users/lzy/pro/solo/workspaces/zy70906

# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后，访问 `http://localhost:3000` 即可使用。

### 3.2 完整对账流程示例

```bash
# 1. 导入小票数据
curl -X POST -F "file=@data/sample-receipts.csv" http://localhost:3000/api/recon/import/receipts

# 2. 导入会员数据
curl -X POST -F "file=@data/sample-members.json" http://localhost:3000/api/recon/import/members

# 3. 运行对账（计算预期积分并检测差异）
curl -X POST http://localhost:3000/api/recon/run

# 4. 查看对账列表
curl http://localhost:3000/api/recon/list

# 5. 查看汇总统计
curl http://localhost:3000/api/recon/summary

# 6. 批准某条差异记录（替换 {id} 为实际记录ID）
curl -X PUT -H "Content-Type: application/json" -d '{"reviewer":"运营主管","remark":"符合政策"}' http://localhost:3000/api/recon/{id}/approve

# 7. 拒绝对某条差异记录（替换 {id} 为实际记录ID）
curl -X PUT -H "Content-Type: application/json" -d '{"reviewer":"运营主管","remark":"缺少凭证"}' http://localhost:3000/api/recon/{id}/reject

# 8. 生成对账报告
curl http://localhost:3000/api/recon/report
```

## 4. API 接口文档

### 4.1 导入小票 CSV

| 项 | 说明 |
|----|------|
| **接口路径** | `POST /api/recon/import/receipts` |
| **请求方式** | POST |
| **Content-Type** | multipart/form-data |

**请求参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | CSV格式的小票文件 |

**CSV 文件格式：**
```csv
id,memberNo,type,amount,points,date,storeId,description
R001,M001,purchase,500,750,2025-01-01,S001,新年购买
```

**成功响应：**
```json
{
  "success": true,
  "count": 7,
  "message": "Imported 7 receipts"
}
```

---

### 4.2 导入会员 JSON

| 项 | 说明 |
|----|------|
| **接口路径** | `POST /api/recon/import/members` |
| **请求方式** | POST |
| **Content-Type** | multipart/form-data |

**请求参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| file | File | 是 | JSON格式的会员文件 |

**JSON 文件格式：**
```json
[
  {
    "memberNo": "M001",
    "name": "张三",
    "level": "GOLD",
    "totalPoints": 6000
  }
]
```

**成功响应：**
```json
{
  "success": true,
  "count": 4,
  "message": "Imported 4 members"
}
```

---

### 4.3 运行对账

| 项 | 说明 |
|----|------|
| **接口路径** | `POST /api/recon/run` |
| **请求方式** | POST |
| **Content-Type** | application/json |

**功能说明：**
对所有已导入的小票重新计算预期积分，并进行差异检测。

**成功响应：**
```json
{
  "success": true,
  "message": "Reconciliation completed"
}
```

---

### 4.4 获取对账列表

| 项 | 说明 |
|----|------|
| **接口路径** | `GET /api/recon/list` |
| **请求方式** | GET |

**查询参数（可选）：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| status | string | 按状态过滤：pending/matched/discrepancy/approved/rejected |
| memberNo | string | 按会员号过滤 |

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "receiptId": "R001",
      "memberNo": "M001",
      "expectedPoints": 1000,
      "actualPoints": 750,
      "diffPoints": 250,
      "status": "discrepancy",
      "discrepancyTypes": ["积分不匹配"],
      "discrepancyReasons": ["新年促销(2倍)未应用"]
    }
  ]
}
```

---

### 4.5 获取单条对账详情

| 项 | 说明 |
|----|------|
| **接口路径** | `GET /api/recon/:id` |
| **请求方式** | GET |

**路径参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 对账记录ID |

**成功响应：** 返回单条对账记录的完整详情，格式同上。

---

### 4.6 批准对账记录

| 项 | 说明 |
|----|------|
| **接口路径** | `PUT /api/recon/:id/approve` |
| **请求方式** | PUT |
| **Content-Type** | application/json |

**路径参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 对账记录ID |

**请求体：**
```json
{
  "reviewer": "运营主管",
  "remark": "生日积分奖励，符合会员权益政策"
}
```

**成功响应：**
```json
{
  "success": true,
  "message": "Reconciliation approved"
}
```

---

### 4.7 拒绝对账记录

| 项 | 说明 |
|----|------|
| **接口路径** | `PUT /api/recon/:id/reject` |
| **请求方式** | PUT |
| **Content-Type** | application/json |

**路径参数：**
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | string | 是 | 对账记录ID |

**请求体：**
```json
{
  "reviewer": "运营主管",
  "remark": "缺少原始销售小票凭证，请补充材料"
}
```

**成功响应：**
```json
{
  "success": true,
  "message": "Reconciliation rejected"
}
```

---

### 4.8 获取汇总统计

| 项 | 说明 |
|----|------|
| **接口路径** | `GET /api/recon/summary` |
| **请求方式** | GET |

**成功响应：**
```json
{
  "success": true,
  "summary": {
    "totalRecords": 7,
    "matched": 1,
    "discrepancy": 4,
    "approved": 1,
    "rejected": 1,
    "pending": 0,
    "totalExpectedPoints": 3760,
    "totalActualPoints": 3630,
    "totalDiffPoints": 130
  }
}
```

---

### 4.9 获取对账报告

| 项 | 说明 |
|----|------|
| **接口路径** | `GET /api/recon/report` |
| **请求方式** | GET |

**成功响应：**
返回包含汇总统计和所有对账记录的完整报告，格式如下：
```json
{
  "success": true,
  "report": {
    "generatedAt": "2025-01-15T10:30:00.000Z",
    "summary": { ... },
    "records": [ ... ]
  }
}
```

## 5. 会员等级体系说明

| 等级名称 | 英文标识 | 积分倍率 | 升级条件 |
|---------|---------|---------|---------|
| 普通会员 | NORMAL | 1.0x | 初始等级 |
| 银卡会员 | SILVER | 1.2x | 累计积分 ≥ 1,000 |
| 金卡会员 | GOLD | 1.5x | 累计积分 ≥ 5,000 |
| 白金会员 | PLATINUM | 2.0x | 累计积分 ≥ 20,000 |

**积分计算公式：**
```
预期积分 = 消费金额 × 会员等级倍率 × 活动倍率
```

## 6. 差异类型说明

| 差异类型 | 说明 | 处理建议 |
|---------|------|---------|
| **积分不匹配** | 预期积分 ≠ 实际积分 | 检查活动规则配置和会员等级是否正确 |
| **退货无原单** | 退货记录缺少对应原始销售小票 | 需要人工核实退货真实性，补充凭证 |
| **手工记录** | 手工补录或扣减积分 | 审核补录理由是否充分，是否符合政策 |
| **重复小票** | 相同小票号重复导入 | 删除重复记录，检查导入流程 |

## 7. 样例数据说明

项目自带样例数据位于 `data/` 目录，可用于测试：

### 7.1 小票数据 - sample-receipts.csv
包含 7 条小票记录，覆盖各种场景：
| 小票号 | 类型 | 说明 |
|-------|------|------|
| R001 | purchase | 正常购买（白金会员） |
| R002 | purchase | 正常购买（金卡会员） |
| R003 | purchase | 正常购买（银卡会员） |
| R004 | purchase | 正常购买（普通会员） |
| R005 | refund | 退货（无原单，需要人工核实） |
| R006 | manual | 手工积分调整（生日Bonus，需要人工批准） |
| R007 | purchase | 购买（积分计算异常） |

### 7.2 会员数据 - sample-members.json
包含 4 个会员，覆盖全部 4 个等级：
| 会员号 | 姓名 | 等级 | 累计积分 |
|-------|------|------|---------|
| M001 | 张三 | PLATINUM | 25,000 |
| M002 | 李四 | GOLD | 8,000 |
| M003 | 王五 | SILVER | 3,000 |
| M004 | 赵六 | NORMAL | 500 |

## 8. 项目结构

```
.
├── src/
│   ├── index.js                 # 应用入口文件
│   ├── store.js                 # 内存数据存储
│   ├── models/                  # 数据模型层
│   │   ├── Member.js            # 会员模型
│   │   ├── Receipt.js           # 小票模型
│   │   ├── Promotion.js         # 活动规则模型
│   │   └── Reconciliation.js    # 对账记录模型
│   ├── services/                # 业务服务层
│   │   ├── importService.js     # 数据导入服务
│   │   ├── pointsCalculator.js  # 积分计算引擎
│   │   ├── discrepancyDetector.js # 差异检测服务
│   │   └── reportService.js     # 报告生成服务
│   ├── controllers/             # API 控制层
│   │   └── reconciliationController.js
│   └── routes/                  # 路由配置层
│       └── reconciliationRoutes.js
├── data/                        # 样例数据目录
│   ├── sample-receipts.csv
│   └── sample-members.json
├── uploads/                     # 文件上传临时目录
├── package.json                 # 项目配置
└── API_GUIDE.md                 # 本文档
```

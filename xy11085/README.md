# 印刷报价组印刷报价锁价 API

专门为印刷行业设计的报价锁价管理系统，支持复杂业务规则和批量处理。

## 快速开始

```bash
npm install
npm test
npm start
```

服务启动后访问: http://localhost:3000

---

## 1. 创建锁价记录

### 接口说明
创建新的印刷报价锁价记录，系统自动计算原始报价和折扣率。

### 请求
```http
POST /api/quote-locks
Content-Type: application/json
X-Operator: 张三

{
  "customer_id": "C001",
  "customer_name": "东方印务有限公司",
  "store_id": "S001",
  "store_name": "中心门店",
  "product_type": "宣传单",
  "paper_type": "铜版纸",
  "paper_size": "A4",
  "width": 210,
  "height": 297,
  "quantity": 5000,
  "color_mode": "四色",
  "double_sided": true,
  "locked_price": 1200.00,
  "status": "pending",
  "responsible_person": "张三",
  "lock_date": "2024-01-15",
  "valid_from": "2024-01-15",
  "valid_to": "2024-06-30",
  "review_conclusion": "价格合理"
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "id": 1,
    "quote_no": "QL20240115123456123",
    "original_price": 1245.50,
    "discount_rate": "3.65"
  }
}
```

---

## 2. 修改锁价记录

### 接口说明
更新锁价记录，支持检测尺寸变更和价格沿用情况，自动记录变更历史。

### 关键特性
- 尺寸变更时自动重新计算原始报价
- 检测"尺寸变更但沿用旧锁价"的特殊情况
- 完整记录变更历史，支持版本追溯

### 请求
```http
PUT /api/quote-locks/1
Content-Type: application/json
X-Operator: 李四

{
  "width": 210,
  "height": 285,
  "locked_price": 1200.00,
  "status": "approved",
  "review_conclusion": "客户改尺寸，沿用原价格",
  "review_by": "主管"
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "success": true,
    "size_changed": true,
    "price_unchanged": true
  }
}
```

---

## 3. 查询锁价记录

### 接口说明
支持多条件组合筛选查询，与导出报表使用同一套计算口径。

### 支持的筛选条件
| 参数 | 说明 | 示例 |
|------|------|------|
| start_date | 锁价日期开始 | 2024-01-01 |
| end_date | 锁价日期结束 | 2024-12-31 |
| status | 状态 | pending/approved/reviewing |
| responsible_person | 负责人 | 张三 |
| store_id | 门店编号 | S001 |
| customer_id | 客户编号 | C001 |

### 查询所有记录
```http
GET /api/quote-locks
```

### 按日期和状态筛选
```http
GET /api/quote-locks?start_date=2024-01-01&end_date=2024-06-30&status=approved
```

### 按负责人筛选
```http
GET /api/quote-locks?responsible_person=张三&store_id=S001
```

### 查询单条详情
```http
GET /api/quote-locks/1
```

### 查询变更历史
```http
GET /api/quote-locks/1/history
```

---

## 4. 导出报表

### 接口说明
导出CSV格式报表，额外包含处理批次和复核结论字段，方便与日常流水区分。

### 导出全部
```http
GET /api/quote-locks/export
```

### 按条件导出
```http
GET /api/quote-locks/export?start_date=2024-01-01&status=approved&responsible_person=张三
```

### 导出字段说明
| 字段 | 说明 |
|------|------|
| 锁价单号 | 系统唯一编号 |
| 客户编号/名称 | 客户信息 |
| 门店编号/名称 | 门店信息 |
| 产品类型/纸张类型 | 印刷品规格 |
| 宽度/高度/数量 | 尺寸和数量 |
| 颜色模式/是否双面 | 印刷参数 |
| 原始报价 | 系统计算价格 |
| 锁定价格 | 实际约定价格 |
| 折扣率(%) | 折扣比例 |
| 状态 | pending/approved/reviewing |
| 负责人 | 对接人员 |
| 锁价日期/有效期 | 时间范围 |
| **处理批次** | 批量导入时的批次号 |
| **复核结论** | 审核人员的复核意见 |
| 版本 | 记录版本号 |

---

## 5. 批量导入

### 接口说明
支持CSV文件批量导入，行级处理结果返回，单条失败不中断整批。

### 请求
```http
POST /api/quote-locks/batch-import
Content-Type: multipart/form-data
X-Operator: 张三

file: @data/sample-import.csv
```

### CSV模板
参考 `data/sample-import.csv`

### 响应示例
```json
{
  "success": true,
  "data": {
    "batch_no": "BATCH20240115123456",
    "total": 4,
    "success": 3,
    "fail": 1,
    "details": [
      { "row": 1, "success": true, "quote_no": "QL20240115123456123", "warning": null },
      { "row": 2, "success": true, "quote_no": "QL20240115123456124", "warning": "尺寸变更但沿用旧锁价" },
      { "row": 3, "success": true, "quote_no": "QL20240115123456125", "warning": null },
      { "row": 4, "success": false, "error": "缺少必填字段: customer_id" }
    ]
  }
}
```

---

## 真实业务字段说明

系统包含印刷行业特有的业务字段：

| 类别 | 字段 | 说明 |
|------|------|------|
| 印刷规格 | product_type | 宣传单/画册/名片/海报等 |
| | paper_type | 铜版纸/双胶纸/哑粉纸/白卡纸 |
| | paper_size | A4/A3/A2 等标准规格 |
| | width/height | 精确到毫米的尺寸 |
| | quantity | 印刷数量 |
| 印刷参数 | color_mode | 单色/四色/专色 |
| | double_sided | 是否双面印刷 |
| 价格管理 | original_price | 系统自动计算价格 |
| | locked_price | 实际锁定价格 |
| | discount_rate | 折扣率 |
| 审核流程 | status | pending/reviewing/approved |
| | review_conclusion | 复核意见 |
| | review_by | 复核人 |
| 追溯 | version | 版本号 |
| | batch_no | 导入批次 |
| | 完整变更历史 | 每次修改都有记录 |

---

## 项目结构

```
.
├── src/
│   ├── app.js                 # 主应用入口
│   ├── database.js            # 数据库初始化
│   ├── services/
│   │   └── quoteLockService.js # 核心业务逻辑
│   └── routes/
│       └── quoteLocks.js      # API路由
├── data/
│   ├── sample-import.csv      # 导入样例数据
│   └── quotes.db              # SQLite数据库
├── test/
│   └── sample-data.js         # 测试脚本
├── exports/                    # 导出文件目录
├── uploads/                    # 临时上传目录
├── package.json
└── README.md
```

---

## 核心设计特点

1. **同一计算口径**: 查询、导出、详情页面使用同一套价格计算逻辑
2. **行级批量处理**: 单条记录失败不影响整批导入
3. **特殊情况检测**: 自动检测"尺寸变更但沿用旧锁价"的业务场景
4. **完整追溯**: 所有变更都有历史记录，支持版本管理
5. **报表区分**: 导出时携带批次和复核结论，方便与日常流水区分

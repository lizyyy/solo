# 母婴门店会员积分补录 API 服务

## 项目简介

为连锁母婴门店提供会员积分补录的批量处理系统，支持材料上传、自动校验、分类处理、回写触发和全链路追踪。

## 数据分类说明

| 分类 | 状态 | 颜色 | 说明 | 后续动作 |
|------|------|------|------|----------|
| 正常 | normal | 绿色 | 数据验证通过 | 自动回写会员积分系统 |
| 待补充 | pending | 黄色 | 存在缺失或异常信息 | 补充缺失字段 / 主管审批 / 分类审核 |
| 已拦截 | blocked | 红色 | 数据严重异常 | 提交人工审核 / 解决重复编号 |

## 验证规则

- **缺字段拦截**: 必填字段（手机号、交易编号、交易时间、积分）缺失时标记为待补充
- **时间矛盾**: 交易时间无效 / 晚于当前时间 / 超过1年时标记为已拦截
- **重复编号**: 交易编号重复时标记为已拦截
- **积分异常**: 积分超过5000或比例超过10倍时标记为待补充
- **特殊分类**: 奶粉、纸尿裤等特殊商品分类需人工审核

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

---

## 完整流程演示（curl 命令）

### 步骤1: 创建批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "store_code": "SH001",
    "store_name": "上海浦东店",
    "operator": "张三",
    "remark": "2024年5月积分补录批次"
  }'
```

**保存返回的批次ID**: `export BATCH_ID="你的批次ID"`

---

### 步骤2: 上传CSV文件（方式一）

创建测试CSV文件 `test_data.csv`:

```csv
member_phone,member_name,member_card_no,transaction_no,transaction_time,transaction_amount,points,product_name,product_category,sales_staff
13800138001,王芳,VIP001,TXN001,2024-05-01 10:30:00,298.00,298,婴儿湿纸巾,洗护用品,李姐
13800138002,李明,VIP002,TXN002,2024-05-02 14:20:00,158.00,158,儿童玩具,玩具,王姐
13800138003,张华,,TXN003,2024-05-03 09:15:00,89.50,89,奶瓶,喂养用品,李姐
,刘芳,VIP004,TXN004,2024-05-04 16:45:00,456.00,456,婴儿奶粉,奶粉,张姐
13800138005,陈刚,VIP005,TXN005,2025-06-01 10:00:00,128.00,128,婴儿车,婴儿车,李姐
13800138006,赵丽,VIP006,TXN001,2024-05-06 11:30:00,399.00,6000,纸尿裤,纸尿裤,王姐
13800138007,孙伟,VIP007,TXN007,2024-05-07 13:00:00,199.00,199,儿童服装,服装,张姐
```

上传文件:

```bash
curl -X POST http://localhost:3000/api/points/${BATCH_ID}/upload \
  -F "file=@test_data.csv"
```

---

### 步骤2（备选）: 直接登记数据（方式二）

```bash
curl -X POST http://localhost:3000/api/points/${BATCH_ID}/register \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {
        "member_phone": "13800138001",
        "member_name": "王芳",
        "member_card_no": "VIP001",
        "transaction_no": "TXN001",
        "transaction_time": "2024-05-01 10:30:00",
        "transaction_amount": 298.00,
        "points": 298,
        "product_name": "婴儿湿纸巾",
        "product_category": "洗护用品",
        "sales_staff": "李姐"
      },
      {
        "member_phone": "13800138002",
        "member_name": "李明",
        "transaction_no": "TXN002",
        "transaction_time": "2024-05-02 14:20:00",
        "points": 158,
        "product_category": "玩具"
      }
    ]
  }'
```

---

### 步骤3: 查看批次处理结果

```bash
curl http://localhost:3000/api/batches/${BATCH_ID}
```

---

### 步骤4: 查看批次明细列表

```bash
curl http://localhost:3000/api/points/${BATCH_ID}/details
```

按状态筛选（pending/blocked/normal）:

```bash
curl "http://localhost:3000/api/points/${BATCH_ID}/details?status=pending"
```

---

### 步骤5: 查看单条明细详情（含原始材料）

**保存明细ID**: `export DETAIL_ID="你的明细ID"`

```bash
curl http://localhost:3000/api/points/detail/${DETAIL_ID}
```

---

### 步骤6: 查询处理轨迹

```bash
curl http://localhost:3000/api/points/detail/${DETAIL_ID}/traces
```

---

### 步骤7: 补充缺失信息（针对pending状态）

```bash
curl -X POST http://localhost:3000/api/points/detail/${DETAIL_ID}/supplement \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "客服小王",
    "supplement_data": {
      "member_phone": "13900139009",
      "member_card_no": "VIP008"
    }
  }'
```

---

### 步骤8: 触发回写流程

```bash
curl -X POST http://localhost:3000/api/points/${BATCH_ID}/writeback \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "系统管理员"
  }'
```

---

### 步骤9: 查看错误明细报告

```bash
curl http://localhost:3000/api/points/${BATCH_ID}/errors
```

---

### 步骤10: 下载完整报告（CSV）

```bash
curl -o report.csv http://localhost:3000/api/points/${BATCH_ID}/report/download
```

---

## 关键字段追踪说明

从原始输入到最终报告，以下关键字段全程可追溯：

| 字段 | 原始材料(raw_data) | 积分明细 | 处理轨迹 | 报告 |
|------|-------------------|----------|----------|------|
| member_phone | ✅ | ✅ | - | ✅ |
| member_name | ✅ | ✅ | - | ✅ |
| member_card_no | ✅ | ✅ | - | ✅ |
| transaction_no | ✅ | ✅ | - | ✅ |
| transaction_time | ✅ | ✅ | - | ✅ |
| points | ✅ | ✅ | - | ✅ |
| product_category | ✅ | ✅ | - | ✅ |
| status | - | ✅ | ✅ | ✅ |
| status_reason | - | ✅ | ✅ | ✅ |

## 数据库表结构

- **batches**: 批次主表
- **raw_materials**: 原始材料表（可回溯原始输入位置）
- **point_details**: 积分明细表（分类处理结果）
- **processing_traces**: 处理轨迹表（全链路追踪）
- **write_back_records**: 回写记录表

## 目录结构

```
├── src/
│   ├── app.js              # 主应用入口
│   ├── database/           # 数据库层
│   ├── services/           # 业务逻辑层
│   └── routes/             # API路由层
├── data/                   # SQLite数据库文件
├── uploads/                # 上传文件目录
├── reports/                # 报告生成目录
└── package.json
```
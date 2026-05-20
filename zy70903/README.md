# 景区缆车检修放行API服务

景区设备部缆车检修放行管理系统API，支持批次提交、重复检测、处理流程、统计查询和报告导出。

## 功能特性

- ✅ 批次材料提交与重复检测（相同材料重复提交返回原有记录）
- ✅ 检修记录管理
- ✅ 试运行记录管理
- ✅ 多级审批流程
- ✅ 统计查询接口
- ✅ CSV报告导出（含所有记录和最后处理人）

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches | 提交检修批次 |
| GET | /api/batches | 获取批次列表 |
| GET | /api/batches/statistics | 获取统计数据 |
| GET | /api/batches/:id | 获取批次详情 |
| POST | /api/batches/:id/trial-run | 提交试运行记录 |
| POST | /api/batches/:id/approval | 提交审批记录 |
| GET | /api/batches/:id/export | 导出CSV报告 |
| GET | /health | 健康检查 |

## 使用示例

### 1. 提交检修批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "cableCarId": "LC001",
    "cableCarName": "1号缆车线",
    "inspectionDate": "2026-05-20",
    "inspectionItems": [
      {
        "itemName": "钢丝绳磨损检查",
        "itemResult": "pass",
        "remark": "磨损程度在正常范围内",
        "inspector": "李工"
      },
      {
        "itemName": "制动系统测试",
        "itemResult": "pass",
        "remark": "制动响应正常",
        "inspector": "李工"
      },
      {
        "itemName": "安全门联锁",
        "itemResult": "pass",
        "remark": "联锁功能正常",
        "inspector": "王工"
      }
    ]
  }'
```

### 2. 重复提交同一批次（系统会识别并返回原有记录）

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "cableCarId": "LC001",
    "cableCarName": "1号缆车线",
    "inspectionDate": "2026-05-20",
    "inspectionItems": [
      {
        "itemName": "钢丝绳磨损检查",
        "itemResult": "pass",
        "remark": "磨损程度在正常范围内",
        "inspector": "李工"
      },
      {
        "itemName": "制动系统测试",
        "itemResult": "pass",
        "remark": "制动响应正常",
        "inspector": "李工"
      },
      {
        "itemName": "安全门联锁",
        "itemResult": "pass",
        "remark": "联锁功能正常",
        "inspector": "王工"
      }
    ]
  }'
```

### 3. 查看统计数据

```bash
curl http://localhost:3000/api/batches/statistics
```

### 4. 获取批次列表

```bash
curl http://localhost:3000/api/batches
```

### 5. 提交试运行记录（替换 :id 为实际批次ID）

```bash
curl -X POST http://localhost:3000/api/batches/1/trial-run \
  -H "Content-Type: application/json" \
  -d '{
    "runDuration": 30,
    "passengerCount": 50,
    "abnormalConditions": "无异常",
    "result": "pass",
    "operator": "赵操作员"
  }'
```

### 6. 提交放行审批

```bash
curl -X POST http://localhost:3000/api/batches/1/approval \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "final",
    "approver": "陈主任",
    "approvalResult": "pass",
    "comment": "各项检查合格，同意放行"
  }'
```

### 7. 导出CSV报告

```bash
curl -o inspection_report.csv http://localhost:3000/api/batches/1/export
```

## 完整流程测试脚本

创建 `test-flow.sh` 并运行：

```bash
chmod +x test-flow.sh
./test-flow.sh
```

脚本内容：

```bash
#!/bin/bash

echo "=== 景区缆车检修放行API - 完整流程测试 ==="

echo ""
echo "1. 提交检修批次..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "cableCarId": "LC001",
    "cableCarName": "1号缆车线",
    "inspectionDate": "2026-05-20",
    "inspectionItems": [
      {"itemName": "钢丝绳磨损检查", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "制动系统测试", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "安全门联锁", "itemResult": "pass", "remark": "正常", "inspector": "王工"}
    ]
  }')

echo "$RESPONSE"
BATCH_ID=$(echo "$RESPONSE" | grep -o '"id":[0-9]*' | cut -d: -f2)
echo "批次ID: $BATCH_ID"

echo ""
echo "2. 验证重复提交检测..."
curl -s -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张三",
    "cableCarId": "LC001",
    "cableCarName": "1号缆车线",
    "inspectionDate": "2026-05-20",
    "inspectionItems": [
      {"itemName": "钢丝绳磨损检查", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "制动系统测试", "itemResult": "pass", "remark": "正常", "inspector": "李工"},
      {"itemName": "安全门联锁", "itemResult": "pass", "remark": "正常", "inspector": "王工"}
    ]
  }' | grep -o '"isDuplicate":true' && echo "✓ 重复检测生效"

echo ""
echo "3. 查看统计数据..."
curl -s http://localhost:3000/api/batches/statistics

echo ""
echo "4. 提交试运行记录..."
curl -s -X POST http://localhost:3000/api/batches/$BATCH_ID/trial-run \
  -H "Content-Type: application/json" \
  -d '{
    "runDuration": 30,
    "passengerCount": 50,
    "abnormalConditions": "无异常",
    "result": "pass",
    "operator": "赵操作员"
  }'

echo ""
echo "5. 提交放行审批..."
curl -s -X POST http://localhost:3000/api/batches/$BATCH_ID/approval \
  -H "Content-Type: application/json" \
  -d '{
    "stage": "final",
    "approver": "陈主任",
    "approvalResult": "pass",
    "comment": "各项检查合格，同意放行"
  }'

echo ""
echo "6. 导出CSV报告..."
curl -s -o inspection_report.csv http://localhost:3000/api/batches/$BATCH_ID/export
echo "✓ 报告已保存到 inspection_report.csv"

echo ""
echo "=== 测试完成 ==="
```

## 状态说明

- `pending`: 待处理
- `inspecting`: 检修中
- `trialing`: 试运行中
- `approving`: 审批中
- `passed`: 已通过
- `rejected`: 已驳回

## 导出报告字段说明

CSV报告包含以下字段：
- 批次号、缆车编号、缆车名称、检修日期
- 提交人、提交时间、当前状态
- 记录类型（检修记录/试运行记录/放行审批）
- 检修项目、检修结果、备注
- 处理人、处理时间、最后处理人

所有记录集中展示，便于查阅和存档。

## 项目结构

```
.
├── src/
│   ├── app.js                 # 应用入口
│   ├── controllers/           # 控制器
│   ├── services/              # 业务逻辑
│   ├── routes/                # 路由定义
│   ├── db/                    # 数据库
│   ├── utils/                 # 工具函数
│   └── scripts/               # 脚本
├── data/                      # 数据目录
├── package.json
└── README.md
```

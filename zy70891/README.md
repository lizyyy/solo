# 社区矫正签到预警 API 服务

## 项目简介

本服务为司法社工提供社区矫正签到材料的自动处理功能，能够：
- 将数据自动分类为**正常**、**待补充**、**已拦截**三类
- 每类都有对应的后续处理动作和原因说明
- 自动检测重复提交，返回原有处理结果
- 导出包含完整信息的CSV报告
- 提供多维度的查询和统计接口

## 核心特点

- ✅ **请假覆盖处理**：正常请假期间豁免签到要求
- ✅ **定位缺口分析**：根据定位缺失时长分级处理
- ✅ **风险等级关联**：高/中/低风险对象采用不同预警标准
- ✅ **多来源数据汇总**：签到、请假、定位数据统一汇总
- ✅ **重复提交防护**：通过SHA256哈希识别相同批次
- ✅ **完整审计追踪**：记录每一步的处理人和处理时间

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

服务将在 `http://localhost:3001` 启动

## API 接口

### 提交批次材料

```bash
curl -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "张社工",
    "records": [
      {
        "object_id": "OBJ001",
        "object_name": "张三",
        "checkin_date": "2024-01-15",
        "risk_level": "高风险",
        "has_checkin": true,
        "checkin_source": "APP签到,电话核实",
        "has_leave": false,
        "location_gap_hours": 2,
        "location_sources": "手机定位,手环定位",
        "location_abnormal": false
      },
      {
        "object_id": "OBJ002",
        "object_name": "李四",
        "checkin_date": "2024-01-15",
        "risk_level": "中风险",
        "has_checkin": false,
        "has_leave": true,
        "leave_start_date": "2024-01-14",
        "leave_end_date": "2024-01-16",
        "leave_approved": true,
        "location_gap_hours": 0,
        "location_abnormal": false
      },
      {
        "object_id": "OBJ003",
        "object_name": "王五",
        "checkin_date": "2024-01-15",
        "risk_level": "高风险",
        "has_checkin": false,
        "has_leave": false,
        "location_gap_hours": 12,
        "location_abnormal": true
      }
    ]
  }'
```

### 获取批次列表

```bash
curl http://localhost:3001/api/batches
```

### 获取批次详情

```bash
# 将 BATCH_ID 替换为实际返回的批次ID
curl http://localhost:3001/api/batches/BATCH_ID
```

### 获取批次处理结果

```bash
curl http://localhost:3001/api/batches/BATCH_ID/results
```

### 获取批次统计信息

```bash
curl http://localhost:3001/api/batches/BATCH_ID/stats
```

### 获取每日汇总详情

```bash
curl http://localhost:3001/api/batches/BATCH_ID/summaries
```

### 导出CSV报告

```bash
curl -o report.csv http://localhost:3001/api/batches/BATCH_ID/export
```

## 分类规则说明

### 正常 (Normal)
- 已签到且无异常
- 或在批准的请假期间
- **后续动作**：无需跟进，正常记录

### 待补充 (Pending)
- 低风险对象的轻微异常
- 中风险对象的单一异常
- **后续动作**：社工3个工作日内提交情况说明

### 已拦截 (Blocked)
- 高风险对象存在签到异常、请假未批准或定位严重异常
- 中风险对象存在多项异常
- 定位缺口超过8小时
- **后续动作**：立即拦截，通知司法所工作人员现场核实，或社工24小时内核实补充

## 数据字段说明

### 提交记录字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| object_id | string | 是 | 对象唯一标识 |
| object_name | string | 是 | 对象姓名 |
| checkin_date | string | 是 | 签到日期 (YYYY-MM-DD) |
| risk_level | string | 是 | 风险等级：高风险/中风险/低风险 |
| has_checkin | boolean | 否 | 是否有签到记录 |
| checkin_source | string | 否 | 签到来源（多个用逗号分隔） |
| has_leave | boolean | 否 | 是否有请假记录 |
| leave_start_date | string | 否 | 请假开始日期 |
| leave_end_date | string | 否 | 请假结束日期 |
| leave_approved | boolean | 否 | 请假是否已批准 |
| location_gap_hours | number | 否 | 定位缺口小时数 |
| location_sources | string | 否 | 定位来源（多个用逗号分隔） |
| location_abnormal | boolean | 否 | 定位是否异常 |

## 项目结构

```
.
├── src/
│   ├── server.js              # 服务入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── routes/
│   │   └── batches.js         # 批次处理路由
│   ├── services/
│   │   ├── batchService.js    # 批次处理服务
│   │   ├── classificationService.js  # 分类算法
│   │   └── exportService.js   # 导出服务
│   ├── utils/
│   │   └── hash.js            # 哈希工具
│   └── scripts/
│       └── init-db.js         # 数据库初始化脚本
├── data/                      # 数据库文件目录
└── package.json
```

## 使用示例脚本

创建 `test-flow.sh` 文件：

```bash
#!/bin/bash

echo "=== 社区矫正签到预警系统完整流程测试 ==="
echo ""

echo "1. 提交第一批材料..."
RESULT=$(curl -s -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "李社工",
    "records": [
      {
        "object_id": "PER001",
        "object_name": "赵六",
        "checkin_date": "2024-01-16",
        "risk_level": "低风险",
        "has_checkin": true,
        "checkin_source": "APP签到",
        "has_leave": false,
        "location_gap_hours": 1,
        "location_abnormal": false
      },
      {
        "object_id": "PER002",
        "object_name": "钱七",
        "checkin_date": "2024-01-16",
        "risk_level": "高风险",
        "has_checkin": false,
        "has_leave": false,
        "location_gap_hours": 6,
        "location_abnormal": true
      }
    ]
  }')

BATCH_ID=$(echo $RESULT | grep -o '"batchId":"[^"]*"' | cut -d'"' -f4)
echo "批次ID: $BATCH_ID"
echo ""

echo "2. 获取批次统计信息..."
curl "http://localhost:3001/api/batches/$BATCH_ID/stats"
echo ""
echo ""

echo "3. 获取每日汇总详情..."
curl "http://localhost:3001/api/batches/$BATCH_ID/summaries"
echo ""
echo ""

echo "4. 导出CSV报告..."
curl -s -o "report_${BATCH_ID}.csv" "http://localhost:3001/api/batches/$BATCH_ID/export"
echo "报告已导出: report_${BATCH_ID}.csv"
echo ""

echo "5. 测试重复提交检测..."
curl -s -X POST http://localhost:3001/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "submitter": "李社工",
    "records": [
      {
        "object_id": "PER001",
        "object_name": "赵六",
        "checkin_date": "2024-01-16",
        "risk_level": "低风险",
        "has_checkin": true
      },
      {
        "object_id": "PER002",
        "object_name": "钱七",
        "checkin_date": "2024-01-16",
        "risk_level": "高风险",
        "has_checkin": false
      }
    ]
  }' | grep -E '"warning"|"message"'
echo ""

echo "=== 测试流程完成 ==="
```

运行脚本：

```bash
chmod +x test-flow.sh
./test-flow.sh
```

## 注意事项

1. 首次运行前请确保已执行 `npm run init-db` 初始化数据库
2. 提交的记录需要包含必填字段，否则会返回400错误
3. 重复提交检测基于记录内容的哈希，字段顺序不影响检测结果
4. CSV导出文件包含BOM头，确保Excel能正确识别中文
5. 日期格式请使用 `YYYY-MM-DD` 格式

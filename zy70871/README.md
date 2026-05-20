# 药企稳定性试验排期API服务

药企QA部门的稳定性试验排期管理系统，支持批量创建试验记录、追踪处理流程、标记超温影响的取样点。

## 功能特性

- **批次管理**：创建、查询试验批次
- **材料上传**：支持文件上传或直接录入原始材料，SHA256去重检测
- **智能拆分**：自动解析原始材料，拆分为单条试验记录
- **处理轨迹**：完整记录每条明细的操作历史
- **错误追踪**：校验错误可定位到原始材料位置
- **超温标记**：环境箱超温后自动标记受影响的取样点
- **报告导出**：支持JSON和CSV格式的报告下载

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## API接口

### 1. 创建批次

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "ST-2024-001",
    "product_name": "阿司匹林肠溶片",
    "specification": "100mg",
    "manufacturer": "XX制药厂",
    "production_date": "2024-01-15",
    "remark": "长期稳定性试验"
  }'
```

### 2. 上传原始材料

#### 方式一：直接提交JSON内容

```bash
# 保存测试数据
cat > test_data.json << 'EOF'
[
  {
    "sample_no": "S001",
    "chamber_id": "CH-001",
    "condition_code": "25℃/60%RH",
    "temperature": 25,
    "humidity": 60,
    "sampling_month": 0,
    "sampling_date": "2024-01-15",
    "planned_test_date": "2024-01-20"
  },
  {
    "sample_no": "S001",
    "chamber_id": "CH-001",
    "condition_code": "25℃/60%RH",
    "temperature": 25,
    "humidity": 60,
    "sampling_month": 3,
    "sampling_date": "2024-04-15",
    "planned_test_date": "2024-04-20"
  },
  {
    "sample_no": "S001",
    "chamber_id": "CH-002",
    "condition_code": "40℃/75%RH",
    "temperature": 40,
    "humidity": 75,
    "sampling_month": 0,
    "sampling_date": "2024-01-15",
    "planned_test_date": "2024-01-20"
  },
  {
    "sample_no": "S002",
    "chamber_id": "CH-001",
    "condition_code": "25℃/60%RH",
    "temperature": 25,
    "humidity": 60,
    "sampling_month": 6,
    "sampling_date": "2024-07-15",
    "planned_test_date": "2024-07-20"
  }
]
EOF

# 上传材料（请替换{BATCH_ID}为实际返回的批次ID）
curl -X POST http://localhost:3000/api/batches/{BATCH_ID}/materials \
  -H "Content-Type: application/json" \
  -d "{\"content\": $(cat test_data.json | sed 's/"/\\"/g'), \"uploadedBy\": \"QA-张三\"}"
```

#### 方式二：上传文件

```bash
curl -X POST http://localhost:3000/api/batches/{BATCH_ID}/materials \
  -F "file=@test_data.json" \
  -F "uploadedBy=QA-张三"
```

### 3. 触发拆分流程

```bash
curl -X POST http://localhost:3000/api/batches/{BATCH_ID}/process \
  -H "Content-Type: application/json" \
  -d '{"operator": "QA-李四"}'
```

### 4. 查询批次下的所有试验记录

```bash
curl http://localhost:3000/api/batches/{BATCH_ID}/records
```

### 5. 查询单条明细的处理轨迹

```bash
# 请替换{RECORD_ID}为实际的记录ID
curl http://localhost:3000/api/records/{RECORD_ID}/traces
```

### 6. 报告环境箱超温事件

```bash
curl -X POST http://localhost:3000/api/chamber-events \
  -H "Content-Type: application/json" \
  -d '{
    "chamber_id": "CH-001",
    "event_type": "overtemp",
    "start_time": "2024-02-01T08:00:00",
    "end_time": "2024-02-01T12:30:00",
    "temperature": 45,
    "humidity": 80,
    "remark": "空调故障导致超温4.5小时"
  }'
```

### 7. 下载试验报告

#### JSON格式

```bash
curl http://localhost:3000/api/batches/{BATCH_ID}/report
```

#### CSV格式（支持Excel直接打开）

```bash
curl -o report.csv "http://localhost:3000/api/batches/{BATCH_ID}/report?format=csv"
```

### 8. 查询所有错误记录

```bash
curl http://localhost:3000/api/errors
```

## 关键字段追踪

系统支持从原始输入到最终报告的全链路追踪：

| 字段 | 说明 | 追踪能力 |
|------|------|----------|
| sample_no | 样品批号 | ✅ 从原材料到报告 |
| chamber_id | 环境箱编号 | ✅ 从原材料到报告 |
| sampling_month | 取样月份 | ✅ 从原材料到报告 |
| temperature | 试验温度 | ✅ 从原材料到报告 |
| humidity | 试验湿度 | ✅ 从原材料到报告 |
| is_affected_by_overtemp | 超温影响标记 | ✅ 实时更新 |

## 错误处理说明

当遇到以下情况时，系统会记录错误并定位到原始材料位置：

- **缺字段**：缺少必填项（样品批号、环境箱、取样月份、温度）
- **时间矛盾**：取样月份超出0-60范围
- **重复编号**：同一样品在同一环境箱的同一取样月份重复

错误响应示例：
```json
{
  "success": false,
  "message": "数据验证失败",
  "errors": [
    {
      "field": "sample_no",
      "message": "样品批号不能为空",
      "position": "items[2].sample_no",
      "row": 3
    }
  ]
}
```

## 去重机制

同一批材料重复提交时，系统会：
1. 通过SHA256哈希检测内容重复
2. 直接返回之前的处理结果
3. 不会生成新的试验记录
4. 响应中包含 `isDuplicate: true` 标记

## 项目结构

```
.
├── src/
│   ├── app.js          # 主应用入口，包含所有API接口
│   └── database.js     # 数据库初始化和操作封装
├── package.json        # 项目配置和依赖
├── README.md          # 使用文档
└── .gitignore        # Git忽略文件
```

## 数据库表结构

- **batches**：批次信息
- **raw_materials**：原始材料（含去重哈希）
- **test_records**：试验记录明细
- **processing_traces**：处理轨迹日志
- **errors**：错误记录
- **chamber_events**：环境箱事件（超温等）

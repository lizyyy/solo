# 校园宿舍维修评分 API 服务

为后勤服务中心提供宿舍维修评分数据处理、审计追踪和报告导出功能。

## 功能特性

- **批次管理**：批量导入评分数据，自动检测重复提交
- **多维度评分**：
  - 学生首次评价
  - 申诉后改分
  - 后勤复核分
- **恶意低分检测**：标记恶意低分并记录复核理由
- **任务状态持久化**：处理中、处理失败、人工确认、已导出
- **审计追踪**：记录所有修改（谁改的、为什么改、改动前后）
- **报告导出**：支持 CSV 格式导出评分报告和审计日志

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 健康检查

```bash
curl http://localhost:3000/health
```

---

## 完整使用流程示例

### 1. 创建批次（提交评分数据）

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "2024年5月第一周维修评分",
    "created_by": "张管理员",
    "records": [
      {
        "dormitory": "1号楼",
        "room_number": "101",
        "student_id": "2021001",
        "student_name": "张三",
        "repair_type": "水电维修",
        "repair_date": "2024-05-01",
        "initial_score": 85,
        "initial_comment": "师傅态度很好，修得快"
      },
      {
        "dormitory": "2号楼",
        "room_number": "203",
        "student_id": "2021002",
        "student_name": "李四",
        "repair_type": "门窗维修",
        "repair_date": "2024-05-02",
        "initial_score": 30,
        "initial_comment": "非常不满意"
      },
      {
        "dormitory": "1号楼",
        "room_number": "305",
        "student_id": "2021003",
        "student_name": "王五",
        "repair_type": "家具维修",
        "repair_date": "2024-05-03",
        "initial_score": 92,
        "initial_comment": "完美"
      }
    ]
  }'
```

**返回结果中会包含批次ID和记录ID，后续操作需要用到这些ID。**

### 2. 重复提交测试（同一批材料再次提交）

```bash
curl -X POST http://localhost:3000/api/batches \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "重复提交测试",
    "created_by": "李管理员",
    "records": [
      {
        "dormitory": "1号楼",
        "room_number": "101",
        "student_id": "2021001",
        "student_name": "张三",
        "repair_type": "水电维修",
        "repair_date": "2024-05-01",
        "initial_score": 85,
        "initial_comment": "师傅态度很好，修得快"
      },
      {
        "dormitory": "2号楼",
        "room_number": "203",
        "student_id": "2021002",
        "student_name": "李四",
        "repair_type": "门窗维修",
        "repair_date": "2024-05-02",
        "initial_score": 30,
        "initial_comment": "非常不满意"
      },
      {
        "dormitory": "1号楼",
        "room_number": "305",
        "student_id": "2021003",
        "student_name": "王五",
        "repair_type": "家具维修",
        "repair_date": "2024-05-03",
        "initial_score": 92,
        "initial_comment": "完美"
      }
    ]
  }'
```

**系统会识别重复并返回原始数据，is_duplicate=true**

### 3. 查看所有批次

```bash
curl http://localhost:3000/api/batches
```

### 4. 学生提交申诉（修改评分）

**注意：请将 {record_id} 和 {batch_id} 替换为实际ID**

```bash
curl -X POST http://localhost:3000/api/scores/{record_id}/appeal \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": {batch_id},
    "modified_by": "李四",
    "appeal_score": 60,
    "appeal_reason": "后续师傅重新上门维修了，虽然慢但修好了"
  }'
```

### 5. 后勤复核评分（标记恶意低分）

**注意：请将 {record_id} 和 {batch_id} 替换为实际ID**

```bash
curl -X POST http://localhost:3000/api/scores/{record_id}/review \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": {batch_id},
    "modified_by": "王主任",
    "review_score": 80,
    "review_reason": "经核查，维修师傅按规范完成工作，学生评价过于极端",
    "is_malicious_low_score": true,
    "malicious_reason": "学生因个人情绪故意打低分，与实际维修情况不符"
  }'
```

### 6. 更新批次状态为人工确认

```bash
curl -X PATCH http://localhost:3000/api/batches/{batch_id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "manual_confirm"
  }'
```

### 7. 查看单条记录的审计日志

```bash
curl http://localhost:3000/api/scores/{record_id}/audit
```

### 8. 查看批次审计报告（谁改过结论、为什么改）

```bash
curl http://localhost:3000/api/reports/batches/{batch_id}/audit
```

### 9. 生成并下载评分报告（CSV）

```bash
curl -o maintenance_report.csv http://localhost:3000/api/reports/batches/{batch_id}/download
```

### 10. 下载审计报告（CSV）

```bash
curl -o audit_report.csv http://localhost:3000/api/reports/batches/{batch_id}/audit/download
```

---

## 关键字段追踪说明

从原始输入到最终报告，关键字段全程可追溯：

| 字段 | 说明 | 审计追踪 |
|------|------|----------|
| `initial_score` | 学生首次评价 | 创建时记录 |
| `appeal_score` | 申诉后改分 | ✓ 记录申诉人和申诉原因 |
| `review_score` | 后勤复核分 | ✓ 记录复核人和复核原因 |
| `is_malicious_low_score` | 恶意低分标记 | ✓ 记录标记人和理由 |
| `final_score` | 最终分数 | ✓ 记录每次修改人和原因 |

## 任务状态说明

| 状态 | 说明 |
|------|------|
| `processing` | 处理中 - 批次刚创建，正在处理 |
| `failed` | 处理失败 - 处理出错，附带错误信息 |
| `manual_confirm` | 人工确认 - 需要人工审核确认 |
| `exported` | 已导出 - 报告已生成并下载 |

## API 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/batches` | 创建评分批次 |
| GET | `/api/batches` | 获取所有批次 |
| GET | `/api/batches/:id` | 获取批次详情 |
| PATCH | `/api/batches/:id/status` | 更新批次状态 |
| POST | `/api/scores/:id/appeal` | 提交申诉 |
| POST | `/api/scores/:id/review` | 后勤复核 |
| PATCH | `/api/scores/:id/final-score` | 修改最终分数 |
| GET | `/api/scores/:id/audit` | 获取单条记录审计日志 |
| GET | `/api/reports/batches/:id` | 获取批次报告 |
| GET | `/api/reports/batches/:id/download` | 下载评分报告CSV |
| GET | `/api/reports/batches/:id/audit` | 获取批次审计日志 |
| GET | `/api/reports/batches/:id/audit/download` | 下载审计报告CSV |

## 项目结构

```
.
├── src/
│   ├── index.js              # 服务入口
│   ├── database.js           # 数据库初始化
│   ├── services/
│   │   ├── batchService.js   # 批次管理服务
│   │   ├── scoreService.js   # 评分与审计服务
│   │   └── reportService.js  # 报告生成服务
│   └── routes/
│       ├── batches.js        # 批次路由
│       ├── scores.js         # 评分路由
│       └── reports.js        # 报告路由
├── data/
│   └── maintenance.db        # SQLite数据库文件（自动创建）
├── package.json
└── README.md
```

# 亲子游泳馆游泳课补水温API - 使用示例

## 项目结构说明

```
├── src/
│   ├── app.js              # 主应用入口
│   ├── routes.js           # 路由配置
│   ├── controllers/      # 控制器
│   │   ├── importController.js    # 导入相关
│   │   ├── recordController.js    # 记录相关
│   │   ├── exportController.js    # 导出相关
│   │   └── migrationController.js # 迁移相关
│   ├── database/
│   │   └── init.js          # 数据库初始化
│   └── utils/
│       ├── constants.js     # 常量定义
│       ├── validator.js    # 数据验证
│       └── calculator.js   # 计算口径
├── examples/
│   ├── sample_data.csv   # 示例CSV数据
│   ├── migration_data.json # 迁移数据示例
│   └── api_examples.md # 本文档
├── tests/
│   └── api.test.js     # 边界测试
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
# 或开发模式
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 3. 运行测试

```bash
npm test
```

## 核心功能说明

### 状态流转规则

```
pending (待审核)
    ↓
confirmed (已确认)
    ↓
compensating (补偿中)
    ↓
completed (已完成)

manual_review (待人工处理) - 水温不达标但补偿表一致时进入此状态，需人工备注后继续推进
cancelled (已取消) - 可从任意状态取消
```

### 统一计算口径字段

所有接口（详情、列表、导出）使用同一套计算逻辑：

- `temp_status`: 水温状态（正常/偏低/偏高）
- `temp_diff`: 水温与标准最低温差值
- `is_temp_in_range`: 是否在标准范围内
- `status_label`: 状态中文标签
- `compensation_summary`: 补偿汇总

## API调用示例

### 1. 健康检查

```bash
curl http://localhost:3000/health
```

### 2. 导入CSV文件

```bash
curl -X POST http://localhost:3000/api/import/csv \
  -F "file=@examples/sample_data.csv" \
  -F "operator=管理员"
```

**响应示例：**
```json
{
  "success": true,
  "batchNo": "BATCH20240115120000",
  "summary": {
    "total": 5,
    "success": 5,
    "failed": 0
  },
  "badRecords": []
}
```

### 3. 获取导入批次列表

```bash
curl http://localhost:3000/api/import/batches
```

### 4. 获取坏记录详情（含原始数据、错误原因、处理建议）

```bash
curl http://localhost:3000/api/import/bad-records/BATCH20240115120000
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "import_batch_no": "BATCH20240115120000",
      "row_number": 3,
      "original_data": {
        "record_no": "BAD001",
        "pool_name": "",
        "pool_type": "亲子池"
      },
      "error_reason": "\"pool_name\" is not allowed to be empty",
      "suggestion": "请补充必填字段后重新导入",
      "import_time": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

### 5. 创建单条记录

```bash
curl -X POST http://localhost:3000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "record_no": "TEMP006",
    "pool_name": "快乐宝贝游泳馆",
    "pool_no": "POOL001",
    "pool_type": "亲子池",
    "record_date": "2024-01-15",
    "time_slot": "上午",
    "time_slot_start": "09:00",
    "time_slot_end": "12:00",
    "standard_temp_min": 31,
    "standard_temp_max": 33,
    "actual_temp": 30,
    "measure_time": "09:30",
    "measure_person": "张测量员",
    "is_temp_compliant": 0,
    "affected_periods": "全时段水温偏低",
    "is_compensation_consistent": 1
  }'
```

### 6. 获取记录列表

```bash
# 获取全部
curl http://localhost:3000/api/records

# 分页查询
curl "http://localhost:3000/api/records?page=1&limit=10"

# 按状态筛选
curl "http://localhost:3000/api/records?status=manual_review"

# 按泳池类型筛选
curl "http://localhost:3000/api/records?pool_type=亲子池"

# 按日期范围筛选
curl "http://localhost:3000/api/records?start_date=2024-01-01&end_date=2024-01-31"
```

### 7. 获取单条记录详情

```bash
curl http://localhost:3000/api/records/1
```

**响应示例（统一计算口径）：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "record_no": "TEMP001",
    "pool_name": "快乐宝贝游泳馆",
    "actual_temp": 30,
    "standard_temp_min": 31,
    "status": "manual_review",
    "status_label": "待人工处理",
    "temp_status": "偏低",
    "temp_diff": "-1.0",
    "is_temp_in_range": 0,
    "compensation_summary": {
      "has_compensation": true,
      "type": "课时补偿",
      "amount": 0,
      "quantity": 2
    }
  }
}
```

### 8. 人工审核备注并继续推进（水温不达标但补偿表一致）

```bash
curl -X POST http://localhost:3000/api/records/1/manual-review \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "张审核员",
    "manual_remark": "经核实，该时段为设备预热期，不影响正常教学，无需补偿",
    "new_status": "confirmed"
  }'
```

**重要说明：
- 只有 `manual_review` 状态的记录才能调用此接口
- `manual_remark` 为必填字段，用于留痕
- `new_status` 可选值：confirmed、compensating、cancelled

### 9. 更新记录状态（常规状态流转）

```bash
curl -X PUT http://localhost:3000/api/records/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "confirmed",
    "operator": "张审核员",
    "remark": "审核通过"
  }'
```

### 10. 获取状态变更日志

```bash
curl http://localhost:3000/api/records/1/logs
```

### 11. 获取统计汇总

```bash
curl http://localhost:3000/api/summary
```

### 12. 导出Excel

```bash
# 导出全部
curl -o output.xlsx http://localhost:3000/api/export/excel

# 按条件筛选导出
curl -o output.xlsx "http://localhost:3000/api/export/excel?status=pending&start_date=2024-01-01"
```

### 13. 导出CSV

```bash
curl -o output.csv http://localhost:3000/api/export/csv
```

### 14. 历史数据迁移

```bash
curl -X POST http://localhost:3000/api/migration/migrate \
  -H "Content-Type: application/json" \
  -d @examples/migration_data.json
```

**迁移前后字段对照：**

| 旧系统字段 | 新系统字段 | 说明 |
|-----------|-----------|------|
| old_system_id | record_no | 旧系统ID作为新记录编号前缀 |
| pool_name | pool_name | 直接映射 |
| record_date | record_date | 直接映射 |
| water_temp | actual_temp | 映射到实际水温 |
| status | status | 映射到新系统状态码 |
| remark | manual_remark | 备注信息 |

### 15. 获取迁移记录列表

```bash
curl http://localhost:3000/api/migration/records
```

### 16. 获取迁移前后字段对照

```bash
curl http://localhost:3000/api/migration/comparison/OLD001
```

## 边界测试覆盖

1. **缺字段验证**
   - 缺少必填字段返回400错误
   - 无效日期格式验证
   - 无效泳池类型验证

2. **重复提交**
   - 相同record_no重复提交返回400

3. **状态越级**
   - pending → completed（不允许，需经confirmed→compensating）
   - 正常流转验证

4. **水温不达标人工处理**
   - 自动进入manual_review状态
   - 无备注提交失败
   - 有备注成功推进
   - 状态日志记录

5. **统一计算口径**
   - 详情、列表、导出使用相同计算逻辑

6. **坏记录处理**
   - 保存原始数据
   - 记录错误原因
   - 提供处理建议

7. **历史数据迁移**
   - 迁移成功验证
   - 前后字段对照

## 真实业务字段说明

| 字段名 | 说明 | 示例值 |
|-------|------|--------|
| record_no | 记录编号 | TEMP001 |
| pool_name | 游泳馆名称 | 快乐宝贝游泳馆 |
| pool_no | 泳池编号 | POOL001 |
| pool_type | 泳池类型 | 婴儿池/幼儿池/亲子池/儿童池/成人池 |
| record_date | 记录日期 | 2024-01-15 |
| time_slot | 时段 | 上午/下午/晚上 |
| standard_temp_min | 标准最低水温 | 31（亲子池） |
| standard_temp_max | 标准最高水温 | 33（亲子池） |
| actual_temp | 实际测量水温 | 32 |
| measure_time | 测量时间 | 09:30 |
| measure_person | 测量人 | 张测量员 |
| is_temp_compliant | 是否达标 | 1=是, 0=否 |
| affected_periods | 影响时段 | 上午10点-12点 |
| course_name | 课程名称 | 亲子游泳启蒙班 |
| coach_name | 教练 | 李教练 |
| registered_count | 报名人数 | 15 |
| attended_count | 到场人数 | 12 |
| need_compensation | 是否需要补偿 | 1=是, 0=否 |
| compensation_type | 补偿类型 | 课时补偿/现金补偿/礼品补偿/积分补偿 |
| compensation_amount | 补偿金额 | 500 |
| compensation_quantity | 补偿数量 | 2（课时） |
| compensation_table_version | 补偿表版本 | v1.1 |
| is_compensation_consistent | 补偿表一致性 | 1=一致, 0=不一致 |

# 民宿保洁管理系统

一个用于民宿保洁管理的后端系统，支持缺图拦截、超时扣分、返工结算等核心功能。

## 功能特性

✅ **缺图拦截** - 照片数量不足时自动拦截记录
✅ **超时扣分** - 保洁超时按分钟自动计算扣分
✅ **返工影响** - 返工次数直接影响结算金额
✅ **审计日志** - 每条记录的操作都有完整日志
✅ **多维度筛选** - 按负责人、时间、状态、异常类型筛选
✅ **CSV导出** - 一键导出与查询结果一致的报告
✅ **规则配置** - 灵活配置拦截规则参数

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入样例数据

```bash
node scripts/seed-data.js
```

### 4. 启动服务

```bash
npm start
```

服务启动后访问: http://localhost:3000

查看API文档: http://localhost:3000/api/docs

## 使用指南

### 一、创建保洁记录

**请求:**
```bash
curl -X POST http://localhost:3000/api/cleaning \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "105",
    "cleaner_name": "张三",
    "checkin_date": "2024-01-18",
    "checkout_date": "2024-01-19",
    "start_time": "2024-01-19 10:00:00",
    "end_time": "2024-01-19 11:30:00",
    "photo_count": 5
  }'
```

**响应示例（正常通过）:**
```json
{
  "success": true,
  "data": {
    "id": 9,
    "room_number": "105",
    "cleaner_name": "张三",
    "status": "passed",
    "score": 100,
    "exception_types": null
  },
  "message": "记录创建成功"
}
```

**响应示例（被拦截）:**
```json
{
  "success": true,
  "data": {
    "id": 10,
    "room_number": "106",
    "cleaner_name": "李四",
    "status": "blocked",
    "exception_types": "missing_photos",
    "audit_logs": [
      {
        "reason": "缺图拦截：照片数量不足，当前3张，要求至少5张"
      }
    ]
  },
  "message": "记录已被拦截，请查看原因"
}
```

### 二、查询保洁记录

#### 查询所有记录
```bash
curl http://localhost:3000/api/cleaning
```

#### 按保洁员筛选
```bash
curl "http://localhost:3000/api/cleaning?cleaner_name=张三"
```

#### 按状态筛选
```bash
curl "http://localhost:3000/api/cleaning?status=blocked"
```

#### 按异常类型筛选
```bash
curl "http://localhost:3000/api/cleaning?exception_type=missing_photos"
```

#### 按时间范围筛选
```bash
curl "http://localhost:3000/api/cleaning?start_date=2024-01-01&end_date=2024-01-31"
```

#### 组合筛选
```bash
curl "http://localhost:3000/api/cleaning?cleaner_name=张三&status=blocked&start_date=2024-01-01"
```

**响应格式:**
```json
{
  "success": true,
  "records": [...],
  "summary": {
    "total_count": 8,
    "passed_count": 3,
    "blocked_count": 4,
    "avg_score": 93.75,
    "total_deduction": 50
  },
  "total": 8
}
```

### 三、查看单条记录详情（含拦截原因）

```bash
curl http://localhost:3000/api/cleaning/2
```

**响应:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "room_number": "102",
    "cleaner_name": "李四",
    "status": "blocked",
    "exception_types": "missing_photos",
    "score": 100,
    "audit_logs": [
      {
        "id": 1,
        "action": "create",
        "operator": "李四",
        "reason": "缺图拦截：照片数量不足，当前3张，要求至少5张",
        "created_at": "2024-01-16 10:00:00"
      }
    ]
  }
}
```

### 四、复核/审核记录

```bash
curl -X POST http://localhost:3000/api/cleaning/2/audit \
  -H "Content-Type: application/json" \
  -d '{
    "auditor_name": "运营主管",
    "audit_remark": "已补充照片，复核通过",
    "status": "audited"
  }'
```

### 五、创建返工记录

```bash
curl -X POST http://localhost:3000/api/cleaning/4/rework \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "201",
    "cleaner_name": "王五",
    "checkin_date": "2024-01-14",
    "checkout_date": "2024-01-15",
    "start_time": "2024-01-15 14:00:00",
    "end_time": "2024-01-15 15:00:00",
    "photo_count": 5
  }'
```

### 六、导出CSV报告

#### 导出全部数据
```bash
curl "http://localhost:3000/api/cleaning/export/csv" -o 保洁报告.csv
```

#### 导出筛选后的数据
```bash
curl "http://localhost:3000/api/cleaning/export/csv?cleaner_name=张三&status=blocked" -o 张三异常记录.csv
```

### 七、查看规则配置

```bash
curl http://localhost:3000/api/rules
```

**响应:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "rule_type": "photo",
      "rule_name": "缺图拦截",
      "min_photos": 5,
      "is_enabled": 1
    },
    {
      "id": 2,
      "rule_type": "timeout",
      "rule_name": "超时扣分",
      "timeout_minutes": 120,
      "deduction_per_timeout": 10,
      "is_enabled": 1
    },
    {
      "id": 3,
      "rule_type": "rework",
      "rule_name": "返工结算",
      "deduction_per_rework": 50,
      "is_enabled": 1
    }
  ]
}
```

### 八、更新规则配置

```bash
curl -X PUT http://localhost:3000/api/rules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "min_photos": 6,
    "timeout_minutes": 120,
    "deduction_per_timeout": 10,
    "deduction_per_rework": 50,
    "is_enabled": 1
  }'
```

## 样例数据说明

导入样例数据后，系统包含以下测试场景：

| 房间 | 保洁员 | 状态 | 异常类型 | 说明 |
|------|--------|------|----------|------|
| 101 | 张三 | passed | - | ✅ 正常通过 |
| 102 | 李四 | blocked | missing_photos | ❌ 缺图拦截（3张<5张） |
| 103 | 张三 | blocked | timeout | ❌ 超时扣分（100分钟>120？不，100分钟正常，实际超时40分钟） |
| 201 | 王五 | blocked | rework | ❌ 返工扣款（1次×50元） |
| 201(返工) | 王五 | passed | - | ✅ 返工记录 |
| 202 | 李四 | blocked | missing_photos,timeout | ❌ 复合异常（缺图+超时） |
| 301 | 赵六 | audited | - | ✅ 已审核 |
| 302 | 张三 | passed | - | ✅ 正常通过 |

## 状态说明

- **pending**: 待处理
- **passed**: 正常通过
- **blocked**: 被拦截（有异常）
- **audited**: 已审核

## 异常类型

- **missing_photos**: 缺图（照片数量不足）
- **timeout**: 超时（保洁用时过长）
- **rework**: 返工（需要二次保洁）

## 项目结构

```
├── src/
│   ├── app.js              # 应用入口
│   ├── routes/
│   │   ├── cleaning.js     # 保洁记录路由
│   │   └── rules.js        # 规则管理路由
│   ├── services/
│   │   ├── cleaningService.js  # 保洁业务逻辑
│   │   ├── ruleService.js      # 规则验证逻辑
│   │   └── exportService.js    # 数据导出服务
│   └── models/
│       └── database.js     # 数据库连接
├── scripts/
│   ├── init-db.js          # 数据库初始化
│   └── seed-data.js        # 样例数据
├── data/                   # SQLite数据库文件
├── uploads/                # 文件上传目录
├── package.json
└── README.md
```

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web框架
- **SQLite3** - 本地数据库
- **CORS** - 跨域支持
- **json2csv** - CSV导出

## 常见问题

**Q: 如何修改最小照片数量？**
A: 调用 `PUT /api/rules/1` 接口修改 `min_photos` 参数。

**Q: 超时时长和扣分标准可以调整吗？**
A: 可以，通过 `PUT /api/rules/2` 修改 `timeout_minutes` 和 `deduction_per_timeout`。

**Q: 返工扣款金额可以配置吗？**
A: 可以，通过 `PUT /api/rules/3` 修改 `deduction_per_rework`。

**Q: 导出的CSV乱码怎么办？**
A: CSV已添加BOM头，用Excel打开时选择UTF-8编码即可。

**Q: 如何查看某条记录为什么被拦截？**
A: 访问 `GET /api/cleaning/:id`，在 `audit_logs` 中查看具体原因。

## License

MIT

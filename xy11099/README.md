# 旅拍客服组旅拍路线改期 API

专为旅拍行业设计的路线改期管理服务，支持多条件筛选、批量导入、景区封闭容错处理、历史冲正等功能。

## 快速开始

### 安装依赖

```bash
npm install
```

### 初始化数据库

```bash
npm run init-db
```

### 导入样例数据

```bash
npm run seed-data
```

### 启动服务

```bash
npm start
```

开发模式：
```bash
npm run dev
```

### 运行测试

```bash
npm test
```

---

## API 接口

### 一、创建改期记录

**接口:** `POST /api/reschedules`

**请求示例:**
```bash
curl -X POST http://localhost:3000/api/reschedules \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "张三",
    "customer_phone": "13800138001",
    "original_shot_date": "2024-06-15",
    "new_shot_date": "2024-06-20",
    "original_route": "三亚湾经典路线",
    "new_route": "亚龙湾豪华路线",
    "scenic_spot": "三亚亚龙湾",
    "store": "三亚旗舰店",
    "person_in_charge": "李经理",
    "reschedule_reason": "客户档期调整",
    "status": "pending",
    "reschedule_fee": 500,
    "remarks": "客户要求升级套餐",
    "operator": "客服小王"
  }'
```

**字段说明:**
| 字段 | 必填 | 说明 |
|------|------|------|
| customer_name | 是 | 客户姓名 |
| customer_phone | 是 | 联系电话 |
| original_shot_date | 是 | 原拍摄日期 |
| new_shot_date | 是 | 新拍摄日期 |
| original_route | 是 | 原路线名称 |
| new_route | 是 | 新路线名称 |
| scenic_spot | 是 | 景区名称 |
| store | 是 | 门店 |
| person_in_charge | 是 | 负责人 |
| reschedule_reason | 是 | 改期原因 |
| status | 否 | 状态：pending/confirmed/completed/cancelled |
| reschedule_fee | 否 | 改期费用 |
| remarks | 否 | 备注 |
| operator | 否 | 操作人 |

---

### 二、修改改期记录

**接口:** `PUT /api/reschedules/:id`

**请求示例:**
```bash
curl -X PUT http://localhost:3000/api/reschedules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "reschedule_fee": 600,
    "remarks": "已确认改期，费用已调整",
    "operator": "客服小李"
  }'
```

**状态流转规则:**
- pending → confirmed / cancelled
- confirmed → completed / cancelled
- completed → reversed (通过冲正接口)
- cancelled → 不可变更

---

### 三、查询改期记录

#### 3.1 查询列表（支持多条件筛选）

**接口:** `GET /api/reschedules`

**请求示例:**
```bash
# 查询所有待确认记录
curl "http://localhost:3000/api/reschedules?status=pending"

# 按门店和负责人筛选
curl "http://localhost:3000/api/reschedules?store=三亚旗舰店&person_in_charge=李经理"

# 按日期范围筛选
curl "http://localhost:3000/api/reschedules?start_date=2024-06-01&end_date=2024-06-30"

# 按景区筛选（处理景区封闭场景）
curl "http://localhost:3000/api/reschedules?scenic_spot=丽江玉龙雪山"

# 按客户姓名模糊搜索
curl "http://localhost:3000/api/reschedules?customer_name=张"
```

**支持的筛选参数:**
- status: 状态
- store: 门店
- person_in_charge: 负责人
- scenic_spot: 景区
- start_date: 新拍摄日期起始
- end_date: 新拍摄日期结束
- customer_name: 客户姓名（模糊匹配）

#### 3.2 查询单条记录

**接口:** `GET /api/reschedules/:id`

**请求示例:**
```bash
curl http://localhost:3000/api/reschedules/1
```

#### 3.3 查询历史记录

**接口:** `GET /api/reschedules/:id/history`

**请求示例:**
```bash
curl http://localhost:3000/api/reschedules/1/history
```

---

### 四、导出数据

**接口:** `GET /api/reschedules/export`

**请求示例:**
```bash
# 导出全部数据
curl -o reschedules.csv "http://localhost:3000/api/reschedules/export"

# 按条件筛选后导出
curl -o pending_reschedules.csv "http://localhost:3000/api/reschedules/export?status=pending"
```

---

### 五、批量导入

**接口:** `POST /api/reschedules/batch-import`

**特性:**
- 遇到单条错误不中断整批导入
- 返回详细的行级结果（成功/失败列表）
- 失败记录包含具体错误信息

**请求示例:**
```bash
curl -X POST http://localhost:3000/api/reschedules/batch-import \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "批量操作员",
    "records": [
      {
        "customer_name": "周八",
        "customer_phone": "13800138006",
        "original_shot_date": "2024-08-01",
        "new_shot_date": "2024-08-05",
        "original_route": "大理古城路线",
        "new_route": "洱海环湖路线",
        "scenic_spot": "云南大理",
        "store": "昆明分店",
        "person_in_charge": "吴经理",
        "reschedule_reason": "景区临时封闭"
      },
      {
        "customer_name": "坏数据测试"
      },
      {
        "customer_name": "吴九",
        "customer_phone": "13800138007",
        "original_shot_date": "2024-08-02",
        "new_shot_date": "2024-08-06",
        "original_route": "张家界天门山",
        "new_route": "张家界国家森林公园",
        "scenic_spot": "湖南张家界",
        "store": "长沙分店",
        "person_in_charge": "郑主管",
        "reschedule_reason": "景区临时封闭"
      }
    ]
  }'
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "success": [
      { "rowIndex": 0, "data": { ... } },
      { "rowIndex": 2, "data": { ... } }
    ],
    "failed": [
      { "rowIndex": 1, "data": { ... }, "error": "缺少必填字段" }
    ],
    "total": 3
  }
}
```

---

### 六、冲正功能

**场景:** 已完成的记录发现有误，需要冲正并创建反向记录。

**接口:** `POST /api/reschedules/:id/reverse`

**请求示例:**
```bash
curl -X POST http://localhost:3000/api/reschedules/3/reverse \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "财务小张",
    "reverse_reason": "发现费用计算错误"
  }'
```

**特性:**
- 只有 completed 状态的记录可以冲正
- 原记录标记为 is_reversed = 1
- 自动创建一条反向的冲正记录（日期、路线互换，费用取反）
- 保留完整的操作历史

**冲正测试样例:**
样例数据中的 `RS202405123456003` (王五) 是已完成状态，可直接用于验证冲正功能。

---

## 样例数据说明

### 内置样例记录

| 单号 | 客户 | 状态 | 场景 |
|------|------|------|------|
| RS202405123456001 | 张三 | pending | 普通待处理 |
| RS202405123456002 | 李四 | confirmed | 景区封闭（玉龙雪山） |
| RS202405123456003 | 王五 | completed | **冲正测试用** |
| RS202405123456004 | 赵六 | pending | 景区封闭（九寨沟） |
| RS202405123456005 | 孙七 | cancelled | 已取消 |

### 批量导入样例文件

位置: `data/sample_import.csv`

包含4条测试数据，其中1条故意缺少 `new_shot_date` 字段，用于测试批量导入容错功能。

---

## 测试覆盖说明

### 核心测试用例

1. ✅ 创建改期记录 - 成功场景
2. ✅ 重复调用 - 生成唯一单号，不重复
3. ✅ 坏数据处理 - 缺少必填字段时正确报错
4. ✅ 多条件筛选查询 - 按状态、门店、负责人等筛选
5. ✅ 状态流转验证 - 有效流转（pending→confirmed）
6. ✅ 状态越级拦截 - 无效流转（pending→completed）被拒绝
7. ✅ 冲正功能 - 已完成记录冲正，生成反向记录
8. ✅ 历史记录追踪 - 每次变更都有完整审计日志
9. ✅ 批量导入容错 - 单条失败不影响整体，返回行级结果
10. ✅ CSV导出功能 - 支持筛选后导出
11. ✅ 单条记录查询
12. ✅ 健康检查

---

## 项目结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── models/
│   │   ├── database.js     # 数据库连接
│   │   └── reschedule.js   # 业务模型
│   └── routes/
│       └── reschedules.js  # API路由
├── scripts/
│   ├── initDB.js           # 数据库初始化
│   └── seedData.js         # 样例数据导入
├── data/
│   ├── sample_import.csv   # 批量导入样例
│   └── database.db         # SQLite数据库（运行时生成）
├── test/
│   └── reschedule.test.js  # 测试用例
├── package.json
└── README.md
```

---

## 健康检查

```bash
curl http://localhost:3000/health
```

---

## 技术栈

- Node.js + Express
- SQLite3 数据库
- CSV 导入/导出
- Jest + Supertest 测试框架
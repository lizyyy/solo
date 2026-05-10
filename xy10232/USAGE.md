# 养老院夜巡漏巡检测 API - 使用说明

## 一、项目概述

本项目是一个完整的养老院夜巡漏巡检测业务工具，旨在解决养老院夜巡打卡点分散、补打卡和漏巡影响护理责任判定的问题。

### 核心功能模块
1. **巡更路线管理**：定义巡更点、巡更路线、护理员信息
2. **打卡事件处理**：正常打卡、补录打卡、批量打卡
3. **补录审核**：补录申请提交、审核批准/拒绝
4. **漏巡检测**：自动检测漏巡、记录责任班次
5. **夜巡报表**：生成报表、统计分析、数据导出

### 差异点说明
- **夜巡路线**：支持多班次（夜班/晚班）、多巡更点、巡更点顺序和容差时间配置
- **补录审核**：严格的审核流程，只有批准的补录才计入有效打卡
- **护理责任**：清晰的责任班次记录，漏巡直接关联到具体护理员

---

## 二、快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python run.py
```

服务将在 http://localhost:5000 启动

### 3. 初始化基础数据

打开新终端，运行造数脚本：

```bash
python scripts/seed_data.py
```

此脚本将创建：
- 4 名护理员（张护理、李护理、王护理、赵主管）
- 8 个巡更点
- 2 条巡更路线（夜班A、晚班B）

---

## 三、完整操作流程

### 流程一：顺利样例（张护理完整完成夜班巡更）

**业务场景**：
1. 张护理正常完成夜班巡更路线A的所有打卡点
2. 其中一个打卡点需要补录，申请后由赵主管批准
3. 进行漏巡检测，确认无漏巡
4. 生成夜巡报表，完成率100%

**操作步骤**：

```bash
# 确保后端服务正在运行
python run.py

# 打开新终端，运行顺利样例脚本
python scripts/success_case.py
```

**预期结果**：
- 张护理完成所有7个必要打卡点
- 202房间的补录申请被赵主管批准
- 漏巡检测结果：0条漏巡
- 夜巡报表完成率：100%
- 责任班次清晰：张护理为本班次责任护理员

### 流程二：异常样例（李护理漏巡 + 补录被拒）

**业务场景**：
1. 李护理夜班巡更时故意漏打多个必要打卡点
2. 事后试图补录，但申请被赵主管拒绝
3. 漏巡检测发现多处漏巡，记录责任班次
4. 生成夜巡报表，完成率低于预期

**操作步骤**：

```bash
# 确保后端服务正在运行
python run.py

# 打开新终端，运行异常样例脚本
python scripts/exception_case.py
```

**预期结果**：
- 李护理漏打多个必要打卡点
- 补录申请因证据不足被拒绝
- 漏巡检测发现多处漏巡
- 夜巡报表完成率较低
- 护理责任明确：李护理漏巡记录可追溯

---

## 四、API 接口文档

### 基础地址
```
http://localhost:5000/api/v1
```

### 1. 巡更路线管理

#### 1.1 护理员管理

**创建护理员**
```bash
POST /routes/caregivers

请求体：
{
    "name": "张护理",
    "employee_id": "CG001",
    "phone": "13800138001",
    "status": "active"
}
```

**查询所有护理员**
```bash
GET /routes/caregivers
```

#### 1.2 巡更点管理

**创建巡更点**
```bash
POST /routes/points

请求体：
{
    "name": "一楼大厅",
    "code": "P001",
    "location": "养老院1楼入口处",
    "description": "夜间入口安全检查点"
}
```

**查询所有巡更点**
```bash
GET /routes/points
```

#### 1.3 巡更路线管理

**创建巡更路线**
```bash
POST /routes

请求体：
{
    "name": "夜班巡更路线A",
    "description": "夜班常规巡更路线",
    "shift_type": "night",
    "start_time": "22:00",
    "end_time": "06:00",
    "status": "active",
    "points": [
        {"point_id": 1, "required": true, "tolerance_minutes": 10},
        {"point_id": 2, "required": true, "tolerance_minutes": 10}
    ]
}
```

**查询所有巡更路线**
```bash
GET /routes
```

**查询单个巡更路线**
```bash
GET /routes/{route_id}
```

### 2. 打卡事件

**正常打卡**
```bash
POST /checkins

请求体：
{
    "route_id": 1,
    "point_id": 1,
    "caregiver_id": 1,
    "checkin_time": "2026-05-10 22:05:00",
    "checkin_type": "normal",
    "notes": "正常打卡"
}
```

**查询打卡记录**
```bash
GET /checkins?route_id=1&caregiver_id=1&start_date=2026-05-10&end_date=2026-05-11
```

**批量打卡**
```bash
POST /checkins/batch

请求体：
{
    "checkins": [
        {
            "route_id": 1,
            "point_id": 1,
            "caregiver_id": 1,
            "checkin_time": "2026-05-10 22:05:00",
            "checkin_type": "normal"
        }
    ]
}
```

### 3. 补录审核

**提交补录申请**
```bash
POST /supplements

请求体：
{
    "checkin_id": 1,
    "requester_id": 1,
    "reason": "当时正在处理老人紧急情况，未能及时打卡",
    "evidence": "监控录像编号: CAM-20260510-2315"
}
```

**批准补录申请**
```bash
POST /supplements/{supplement_id}/approve

请求体：
{
    "reviewer_id": 4,
    "review_comment": "经核实监控录像，情况属实"
}
```

**拒绝补录申请**
```bash
POST /supplements/{supplement_id}/reject

请求体：
{
    "reviewer_id": 4,
    "review_comment": "无有效证据，予以拒绝"
}
```

**查询待审核补录**
```bash
GET /supplements/pending
```

### 4. 漏巡检测

**执行漏巡检测**
```bash
POST /detections/detect

请求体：
{
    "route_id": 1,
    "caregiver_id": 1,
    "shift_date": "2026-05-10"
}
```

**查询漏巡记录**
```bash
GET /detections?status=confirmed&caregiver_id=1&start_date=2026-05-01&end_date=2026-05-10
```

**申诉漏巡记录**
```bash
POST /detections/{missed_id}/appeal

请求体：
{
    "notes": "我当时在处理其他紧急事务，请求复核"
}
```

**解决漏巡记录**
```bash
POST /detections/{missed_id}/resolve

请求体：
{
    "notes": "已核实，责任明确"
}
```

**漏巡统计**
```bash
GET /detections/stats?start_date=2026-05-01&end_date=2026-05-10
```

### 5. 夜巡报表

**生成报表**
```bash
POST /reports/generate

请求体：
{
    "report_date": "2026-05-10",
    "route_id": 1,
    "caregiver_id": 1
}
```

**查询报表**
```bash
GET /reports?start_date=2026-05-01&end_date=2026-05-10&route_id=1
```

**报表汇总**
```bash
GET /reports/summary?start_date=2026-05-01&end_date=2026-05-10
```

**导出报表**
```bash
GET /reports/export?format=json&start_date=2026-05-01&end_date=2026-05-10
GET /reports/export?format=text&report_id=1
```

---

## 五、状态流转说明

### 1. 补录申请状态流转

```
pending (待审核)
    ├── approve → approved (已批准)
    └── reject → rejected (已拒绝)
```

**说明**：
- `pending`：补录申请已提交，等待审核
- `approved`：审核通过，补录打卡计入有效打卡
- `rejected`：审核拒绝，补录打卡不计入有效打卡

**业务规则**：
- 一个打卡记录只能有一个待审核的补录申请
- 只能为自己的打卡记录申请补录
- 拒绝申请必须提供审核意见
- 已批准或已拒绝的申请不能再次审核

### 2. 漏巡记录状态流转

```
confirmed (已确认)
    ├── appeal → appealed (申诉中/待复核)
    └── resolve → resolved (已处理)

appealed (申诉中/待复核)
    ├── appeal → confirmed (申诉被驳回)
    └── resolve → resolved (申诉通过，已处理)
```

**说明**：
- `confirmed`：漏巡已确认，责任明确
- `appealed`：护理员已申诉，等待复核
- `resolved`：漏巡记录已处理完毕

---

## 六、运行测试

### 运行综合测试套件

```bash
# 确保后端服务正在运行
python run.py

# 打开新终端，运行测试
python scripts/test_api.py
```

### 测试内容
1. 基础数据检查
2. 打卡流程测试
3. 补录审核流程测试
4. 漏巡检测和报表生成测试
5. 错误处理测试
6. 状态流转测试

---

## 七、业务规则与限制

### 1. 打卡规则
- 必须在有效巡更路线上打卡
- 必须是该路线包含的巡更点
- 正常打卡：12小时内同一巡更点不能重复打卡
- 补录打卡：需要申请并审核通过

### 2. 补录审核规则
- 只能为自己的打卡记录申请补录
- 一个打卡记录只能有一个待审核的补录申请
- 拒绝申请必须提供审核意见
- 已批准的补录申请：打卡类型变更为 'supplement'
- 已拒绝的补录申请：打卡不计入有效打卡

### 3. 漏巡检测规则
- 只检测必要打卡点（required=true）
- 检测范围：路线开始时间到结束时间
- 夜班跨天场景：结束时间自动+1天
- 补录打卡计入有效打卡（需要审核通过）

### 4. 责任判定规则
- 漏巡记录关联具体护理员
- 记录责任班次信息（日期 + 班次类型）
- 可追溯到具体巡更路线和巡更点

---

## 八、常见问题

### Q1: 如何重置数据库？
A: 删除项目根目录下的 `patrol.db` 文件，重新启动服务即可。

### Q2: 如何查看所有API端点？
A: 查看 `app/routes/` 目录下的各个路由文件。

### Q3: 补录申请被拒绝后怎么办？
A: 可以提交新的补录申请，提供更充分的证据。

### Q4: 如何导出报表？
A: 使用 `/reports/export` 接口，支持 JSON 和 TEXT 两种格式。

### Q5: 如何查看某个护理员的所有漏巡记录？
A: 使用 `GET /detections?caregiver_id={id}` 接口。

---

## 九、项目结构

```
night-patrol-api/
├── app/
│   ├── __init__.py          # Flask应用初始化
│   ├── models.py            # 数据模型
│   ├── errors.py            # 错误处理
│   └── routes/              # 路由模块
│       ├── __init__.py
│       ├── routes_routes.py # 巡更路线管理
│       ├── checkin_routes.py # 打卡管理
│       ├── supplement_routes.py # 补录审核
│       ├── detection_routes.py # 漏巡检测
│       └── report_routes.py    # 报表管理
├── scripts/
│   ├── __init__.py
│   ├── seed_data.py         # 造数脚本
│   ├── success_case.py      # 顺利样例
│   ├── exception_case.py    # 异常样例
│   └── test_api.py          # 综合测试
├── config.py                # 配置文件
├── requirements.txt         # 依赖列表
├── run.py                   # 启动文件
└── USAGE.md                 # 使用说明
```

---

## 十、技术栈

- **后端框架**：Flask 3.0.0
- **数据库**：SQLite（嵌入式，无需额外配置）
- **ORM**：Flask-SQLAlchemy 3.1.1
- **序列化**：Flask-Marshmallow 0.15.0
- **HTTP客户端**：Requests 2.31.0
- **测试框架**：unittest（Python内置）

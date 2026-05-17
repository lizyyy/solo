# 双功能综合管理系统

本项目包含两个独立的功能模块，均可独立运行：

## 📦 功能模块概览

| 模块 | 技术 | 入口 | 用途 |
|------|------|------|------|
| **团体锁座换座超时释放排查 CLI** | Python标准库 | `seatlock_cli.py` | 剧场演出座位锁冲突、超时未释放、换座合法性检查 |
| **证书续期岗位资格补考管理 API** | FastAPI + SQLAlchemy | `uvicorn app.main:app` | 员工证书、课程成绩、补考记录、岗位资格、续期清单管理 |

---

## 🎟️ 模块一：团体锁座换座超时释放排查 CLI

### 功能特性

- **数据解析**: 支持批量导入演出、座位、订单、锁座、保留窗口、换座申请
- **规则引擎**: 5种核心检查规则
  - 🔴 **超时未释放检查**: 检测锁座超时未释放的座位
  - 🟠 **座位冲突检查**: 同一座位被多订单同时锁定
  - 🟡 **窗口重叠检查**: 保留窗口时间重叠检测
  - 🟢 **无效换座检查**: 目标座位不存在/已售出/已锁定、数量不匹配
  - 🔵 **团体票数量匹配**: 订单应有票数 vs 实际锁定座位数
- **来源追踪**: 每条记录关联原始文件和行号
- **坏行保留**: 解析失败记录完整保留，不中断流程
- **幂等复跑**: 相同输入文件重复运行自动识别跳过
- **多格式报告**: 文本、JSON、CSV

### 快速开始

```bash
# 1. 查看帮助
python3 seatlock_cli.py --help

# 2. 解析示例数据并检查（控制台输出文本报告）
python3 seatlock_cli.py check --dir ./sample_data

# 3. 强制重新运行（跳过幂等检查）
python3 seatlock_cli.py check --dir ./sample_data --force

# 4. 输出JSON报告
python3 seatlock_cli.py check --dir ./sample_data --format json --output ./reports/report.json

# 5. 输出CSV报告
python3 seatlock_cli.py check --dir ./sample_data --format csv

# 6. 查看历史运行记录
python3 seatlock_cli.py history --limit 10

# 7. 仅解析数据（不执行检查）
python3 seatlock_cli.py parse --files ./sample_data/locks.csv ./sample_data/orders.csv
```

### CLI命令详解

#### check - 执行锁座检查

```bash
python3 seatlock_cli.py check \
  --dir ./data \                    # 数据目录，自动搜索相关CSV
  --files shows.csv seats.csv ... \ # 指定文件列表
  --format text|json|csv \         # 输出格式
  --output ./reports/report.txt \   # 输出文件路径
  --force \                         # 强制重新运行，跳过幂等检查
  --show-bad                        # 显示解析失败记录详情
```

#### history - 查看历史运行

```bash
python3 seatlock_cli.py history --limit 20
```

#### parse - 仅解析数据

```bash
python3 seatlock_cli.py parse --files ./data/*.csv
```

### 数据文件格式

| 文件 | 关键字段 | 匹配规则 |
|------|----------|----------|
| 演出 | `*show*.csv` | show_id, title, venue, show_time, total_seats |
| 座位 | `*seat*.csv` | seat_id, show_id, section, row, number, status |
| 订单 | `*order*.csv` | order_id, group_name, show_id, contact_name, total_tickets |
| 保留窗口 | `*window*.csv` | window_id, show_id, order_id, seat_ids, hold_start, hold_end |
| 锁座 | `*lock*.csv` | lock_id, show_id, seat_id, order_id, locked_at, lock_timeout |
| 换座 | `*change*.csv` | change_id, show_id, order_id, from_seat_ids, to_seat_ids |

示例数据位于 `./sample_data/` 目录。

---

## 📜 模块二：证书续期岗位资格补考管理系统 API

### 功能特性

- **员工管理**: 员工增删改查
- **证书类型**: 证书类型配置，有效期设置
- **员工证书**: 证书发放、状态跟踪
- **课程成绩**: 成绩录入、及格判断
- **补考记录**: 不及格自动创建补考、补考成绩录入
- **岗位资格**: 基于证书和成绩的资格判断
- **续期清单**: 续期申请、状态流转、人工修正、撤回关闭
- **异常日志**: 所有人工操作完整记录审计
- **数据导出**: CSV格式导出

### 快速开始

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. 访问API文档
# Swagger UI: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc

# 4. 创建测试数据
python create_test_data.py
```

### API主流程示例

```bash
# 1. 创建员工
curl -X POST "http://localhost:8000/employees/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": "EMP001", "name": "张三", "department": "生产部"}'

# 2. 录入课程成绩（不及格自动创建补考记录）
curl -X POST "http://localhost:8000/course-scores/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1, "certificate_type_id": 1, "course_name": "安全培训", "score": 55, "exam_date": "2024-01-15"}'

# 3. 更新补考成绩（自动判断是否通过）
curl -X PUT "http://localhost:8000/course-scores/1" \
  -H "Content-Type: application/json" \
  -d '{"retake_score": 75}'

# 4. 创建续期申请
curl -X POST "http://localhost:8000/renewal-items/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id": 1, "certificate_type_id": 1, "priority": 2}'

# 5. 推进续期状态（待处理 -> 处理中 -> 已完成）
curl -X PUT "http://localhost:8000/renewal-items/1/advance"

# 6. 人工修正（带审计记录）
curl -X POST "http://localhost:8000/renewal-items/1/correct" \
  -H "Content-Type: application/json" \
  -d '{"handler": "管理员", "conclusion": "特殊情况处理", "new_status": "已关闭"}'

# 7. 获取过期证书提醒
curl "http://localhost:8000/certificate-expiry-alerts/?days_threshold=90"

# 8. 获取岗位资格检查结果
curl "http://localhost:8000/qualification-check/1/高级工程师"
```

### 冲突与异常处理

- **员工编号重复**: HTTP 400，员工编号已存在
- **续期状态推进失败**: 已完成状态无法继续推进
- **人工修正**: 所有操作记录到异常日志，包含处理人、处理结论、原始状态
- **幂等性**: 同一员工+同一证书类型的待处理续期项不会重复创建

### 数据模型

- `Employee` - 员工
- `CertificateType` - 证书类型
- `EmployeeCertificate` - 员工证书
- `CourseScore` - 课程成绩
- `RetakeRecord` - 补考记录
- `PositionRequirement` - 岗位要求
- `RenewalItem` - 续期清单
- `ExceptionLog` - 异常操作日志

---

## 🗂️ 项目结构

```
.
├── seatlock_cli.py           # CLI工具入口 (锁座排查)
├── seatlock/
│   ├── __init__.py
│   ├── models.py             # 数据模型
│   ├── rules.py              # 规则引擎
│   ├── parser.py             # 数据解析器
│   ├── reporter.py           # 报告生成器
│   └── run_state.py          # 运行状态管理
├── sample_data/              # 示例CSV数据
│   ├── shows.csv
│   ├── seats.csv
│   ├── orders.csv
│   ├── windows.csv
│   ├── locks.csv
│   └── changes.csv
├── run_state/               # CLI运行状态存储
├── reports/                 # CLI报告输出
├── app/                     # FastAPI应用 (证书系统)
│   ├── __init__.py
│   ├── main.py             # API入口
│   ├── models.py           # ORM模型
│   ├── schemas.py          # Pydantic模型
│   ├── crud.py             # 业务逻辑
│   └── database.py         # 数据库连接
├── create_test_data.py     # API测试数据生成
├── requirements.txt        # Python依赖
└── README.md              # 本文档
```

---

## 🧪 测试

### CLI工具测试

```bash
# 使用示例数据测试
python3 seatlock_cli.py check --dir ./sample_data

# 查看报告输出
ls -la reports/
```

### FastAPI测试

```bash
# 运行pytest
pytest test_main.py -v

# 启动服务测试
uvicorn app.main:app --reload --port 8000
```

---

## 📋 依赖说明

| 依赖 | 版本 | 用途 | 模块 |
|------|------|------|------|
| FastAPI | 0.104.1 | Web框架 | API模块 |
| Uvicorn | 0.24.0 | ASGI服务器 | API模块 |
| SQLAlchemy | 2.0.23 | ORM | API模块 |
| Pydantic | 2.5.0 | 数据验证 | API模块 |
| pytest | 7.4.3 | 测试框架 | 全部 |

CLI工具无需额外依赖，使用Python标准库即可运行。

---

## 🚀 推荐运行方式

### 仅使用锁座排查CLI

```bash
# 无需安装依赖，直接运行
python3 seatlock_cli.py check --dir ./your_data/ --format json --output ./report/
```

### 仅使用证书管理API

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
python create_test_data.py
```

### 同时使用两个模块

两个模块完全独立，互不影响，可同时运行。

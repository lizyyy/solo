# 乡镇药房近效期验收回放链路 API

## 项目概述

本系统是专为乡镇药房设计的近效期药品验收回放链路管理系统，支持进销存导出、手写调拨单、退货照片、外部回执等多种数据来源的验收记录管理，重点实现坏数据留存、人工改判、审计追踪等功能。

## 核心特性

### 1. 数据来源支持
- ✅ 进销存系统导出数据
- ✅ 手写调拨单录入
- ✅ 退货照片上传
- ✅ 外部回执数据导入

### 2. 回放链路完整流程
- ✅ 造数：批量生成样例验收记录
- ✅ 启动服务：一键启动API服务
- ✅ 发请求：RESTful API接口
- ✅ 对账：自动对账匹配
- ✅ 导出：Excel/CSV格式导出
- ✅ 异常回放：失败记录重新验证

### 3. 状态变更审计
- ✅ 每次状态变更记录：时间、操作者、原因
- ✅ 完整的状态流转日志
- ✅ 支持追溯到单条记录详情

### 4. 四级权限体系
| 角色 | 用户名 | 密码 | 权限说明 |
|------|--------|------|---------|
| 录入员 | luruyuan | luru123 | 录入、编辑、提交验收记录 |
| 复核员 | fuyipei | fuyi123 | 复核、状态变更、对账 |
| 主管 | guanpeixun | guan123 | 人工改判、生成报告、审计日志 |
| 只读 | chaijiehao | chai123 | 仅查看数据 |

### 5. 坏数据处理机制
- ✅ 坏数据不进入汇总统计
- ✅ 在失败记录列表中展示详细原因
- ✅ 支持人工改判和异常回放
- ✅ 保留原始数据便于追溯

### 6. 督导审计功能
- ✅ HTTP请求完整日志（请求/响应内容）
- ✅ 命令脚本执行审计
- ✅ 本地持久化数据可查
- ✅ 避免来源不明的汇总数

## 快速开始

### 方式一：自动启动（推荐）

```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

```bash
# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 初始化数据库
python scripts/init_db.py

# 4. 启动服务
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问地址
- API文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

## 完整流程演示

### 第一步：启动服务
```bash
./start.sh
```

### 第二步：运行演示脚本
新终端执行：
```bash
source venv/bin/activate
pip install requests -q
python scripts/demo_flow.py
```

### 第三步：手动执行流程示例

#### 1. 登录获取Token
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=guanpeixun&password=guan123"
```

#### 2. 生成样例数据
```bash
# 生成10条正常记录
curl -X POST "http://localhost:8000/api/v1/replay/generate-samples?count=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 生成3条坏数据（缺附件、重复提交、人工改判）
curl -X POST "http://localhost:8000/api/v1/replay/generate-bad-data" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. 查看验收记录
```bash
# 查看所有记录
curl "http://localhost:8000/api/v1/records" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 只看坏数据
curl "http://localhost:8000/api/v1/records?is_bad_data=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. 查看失败记录详情
```bash
curl "http://localhost:8000/api/v1/records/failed?resolved=false" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 5. 人工改判失败记录
```bash
curl -X POST "http://localhost:8000/api/v1/records/failed/1/resolve" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "resolution_notes=经主管核实，数据有效"
```

#### 6. 执行对账
```bash
curl -X POST "http://localhost:8000/api/v1/replay/reconcile" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 7. 导出数据
```bash
# 导出验收记录
curl -X POST "http://localhost:8000/api/v1/exports/records?export_format=excel" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 生成报告
curl -X POST "http://localhost:8000/api/v1/exports/report" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 8. 查看审计日志（督导专用）
```bash
# HTTP请求日志
curl "http://localhost:8000/api/v1/audit-logs/http" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 命令执行日志
curl "http://localhost:8000/api/v1/audit-logs/commands" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API接口清单

### 认证接口
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/v1/auth/login | 登录获取Token | 公开 |
| GET | /api/v1/auth/me | 获取当前用户信息 | 所有用户 |

### 验收记录接口
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/v1/records | 创建验收记录 | 录入员及以上 |
| GET | /api/v1/records | 查询记录列表 | 所有用户 |
| GET | /api/v1/records/{id} | 获取单条记录详情 | 所有用户 |
| PUT | /api/v1/records/{id} | 更新验收记录 | 录入员及以上 |
| POST | /api/v1/records/{id}/status | 变更状态 | 复核员及以上 |
| POST | /api/v1/records/{id}/attachments | 上传附件 | 录入员及以上 |
| GET | /api/v1/records/failed | 查询失败记录列表 | 复核员及以上 |
| POST | /api/v1/records/failed/{id}/resolve | 人工改判失败记录 | 主管 |

### 回放链路接口
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/v1/replay/generate-samples | 批量生成样例数据 | 主管 |
| POST | /api/v1/replay/generate-bad-data | 生成坏数据样例 | 主管 |
| POST | /api/v1/replay/reconcile | 执行对账 | 复核员及以上 |
| POST | /api/v1/replay/failed/{id}/replay | 回放失败记录 | 复核员及以上 |

### 数据导出接口
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | /api/v1/exports/records | 导出验收记录 | 复核员及以上 |
| POST | /api/v1/exports/failed-records | 导出失败记录 | 复核员及以上 |
| POST | /api/v1/exports/report | 生成汇总报告 | 复核员及以上 |

### 审计日志接口
| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/v1/audit-logs/http | 查询HTTP请求日志 | 主管 |
| GET | /api/v1/audit-logs/commands | 查询命令执行日志 | 主管 |
| POST | /api/v1/audit-logs/execute-command | 执行命令并审计 | 主管 |

## 目录结构

```
.
├── main.py                 # 主应用入口
├── requirements.txt        # 依赖清单
├── start.sh               # 一键启动脚本
├── app/
│   ├── core/              # 核心模块
│   │   ├── config.py      # 配置管理
│   │   ├── database.py    # 数据库连接
│   │   └── security.py    # 安全认证与权限
│   ├── models/            # 数据模型
│   │   ├── user.py        # 用户与角色模型
│   │   ├── audit.py       # 验收记录相关模型
│   │   └── audit_log.py   # 审计日志模型
│   ├── schemas/           # Pydantic数据结构
│   ├── services/          # 业务逻辑层
│   │   ├── user_service.py
│   │   ├── audit_service.py
│   │   ├── replay_service.py
│   │   ├── export_service.py
│   │   └── audit_log_service.py
│   └── api/               # API路由层
│       ├── auth.py
│       ├── records.py
│       ├── replay.py
│       ├── exports.py
│       └── audit_logs.py
├── scripts/               # 工具脚本
│   ├── init_db.py         # 数据库初始化
│   ├── generate_samples.py # 样例数据生成
│   └── demo_flow.py       # 完整流程演示
├── samples/               # 样例材料
│   └── inventory_export_sample.json
├── data/                  # 数据目录
│   ├── pharmacy_audit.db  # SQLite数据库
│   └── exports/           # 导出文件目录
├── attachments/           # 附件存储目录
└── logs/                  # 日志目录
```

## 关键技术点说明

### 1. 状态流转机制
每条验收记录都有完整的状态流转：
- DRAFT（草稿）→ SUBMITTED（已提交）→ UNDER_REVIEW（复核中）
- UNDER_REVIEW → APPROVED（通过）/ REJECTED（驳回）/ NEEDS_FIX（待修正）
- SUBMITTED → RECONCILED（已对账）/ FAILED（失败）
- FAILED → MANUALLY_RESOLVED（人工改判）

每次状态变更都会记录：
- 变更前状态
- 变更后状态
- 操作人
- 操作时间
- 变更原因

### 2. 坏数据处理策略
- **不丢弃**：坏数据完整保留，包括原始数据
- **不汇总**：坏数据不计入统计汇总
- **可追溯**：失败记录列表展示完整错误信息
- **可修复**：支持人工改判或异常回放重新验证

### 3. 权限设计原则
采用**最小权限原则**：
- 录入员：只能操作自己创建的记录
- 复核员：可以审核所有记录但不能改判坏数据
- 主管：拥有最高权限，可以人工改判
- 只读：只能查看，不能做任何修改

### 4. 审计追踪能力
- **HTTP请求日志**：记录所有API调用的完整请求和响应内容
- **命令执行日志**：记录系统命令执行情况
- **状态变更日志**：记录每次状态流转详情
- **操作人关联**：所有操作都能追溯到具体用户

## 样例坏数据说明

系统内置3种典型坏数据场景：

### 1. 缺附件（MISSING_ATTACHMENT）
- **场景**：退货照片来源的验收记录没有上传照片
- **错误信息**："退货照片来源必须上传照片附件"
- **处理方式**：补充附件后重新提交

### 2. 重复提交（DUPLICATE_SUBMISSION）
- **场景**：同一批次药品被重复提交验收
- **错误信息**："检测到同一批次药品重复提交验收"
- **处理方式**：核实后删除重复记录或合并

### 3. 外部数据不匹配（EXTERNAL_DATA_MISMATCH）
- **场景**：外部回执数据与系统记录不一致
- **错误信息**："外部回执数据与系统记录不匹配，需人工核实"
- **处理方式**：主管人工核实后改判

## 常见问题

### Q: 如何重置数据库？
A: 删除 `data/pharmacy_audit.db` 文件，重新运行 `python scripts/init_db.py`

### Q: 如何添加新用户？
A: 可以通过数据库直接插入，或扩展用户管理API

### Q: 导出的文件在哪里？
A: 导出文件保存在 `data/exports/` 目录下

### Q: 附件存在哪里？
A: 附件保存在 `attachments/` 目录下，数据库存储文件路径

## 技术栈

- **后端框架**: FastAPI 0.104
- **数据库**: SQLite（本地运行，方便部署）
- **ORM**: SQLAlchemy 2.0
- **认证**: JWT (python-jose)
- **密码加密**: bcrypt
- **数据导出**: pandas + openpyxl
- **服务**: Uvicorn

---

**本系统由药房店长需求驱动，确保坏数据留存、权限真实、审计可追溯。**

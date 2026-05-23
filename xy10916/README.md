# 培训证书续期 API

本地后端 API 服务，用于管理员工培训证书续期流程。

## 技术栈

- **Node.js** - 运行环境
- **Express** - Web 框架
- **SQLite** - 本地持久化数据库
- **UUID** - 唯一标识生成
- **csv-writer** - CSV 导出

## 项目结构

```
├── src/
│   ├── config/          # 配置文件
│   │   └── database.js  # 数据库连接
│   ├── models/          # 数据模型
│   │   └── initTables.js
│   ├── daos/            # 数据访问层
│   ├── services/        # 业务逻辑层
│   ├── controllers/     # 控制器层
│   ├── routes.js        # 路由配置
│   └── server.js        # 服务器入口
├── scripts/
│   └── initData.js      # 样例数据初始化
├── data/                # 数据库文件目录
├── exports/             # 导出文件目录
└── package.json
```

## 快速开始

### 前置说明

- ✅ `data/` 和 `exports/` 目录会在首次运行时**自动创建**，无需手动创建
- ✅ 样例数据初始化脚本支持**重复调用**，不会产生重复数据冲突

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
npm run init-data
```

> 💡 **提示**: 此脚本可安全重复运行。检测到数据已存在时会自动跳过，仅显示本次新增记录。

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 开发模式（自动重启）

```bash
npm run dev
```

## 数据模型

### 核心实体

1. **员工 (Employees)** - 员工基本信息
2. **证书类型 (CertificateTypes)** - 证书分类和有效期
3. **课程 (Courses)** - 培训课程信息
4. **课程成绩 (CourseScores)** - 员工考试成绩
5. **补考记录 (RetakeRecords)** - 补考跟踪
6. **岗位要求 (PositionRequirements)** - 岗位与证书的关联
7. **员工证书 (EmployeeCertificates)** - 员工持有的证书
8. **续期清单 (RenewalChecklists)** - 季度检查清单
9. **异常记录 (ProcessingExceptions)** - 异常处理日志
10. **人工修正 (ManualCorrections)** - 人工操作记录

### 核心规则

- ✅ **资格匹配**: 根据岗位要求和课程成绩判断是否具备续期资格
- ✅ **补考状态**: 跟踪未通过课程的补考进度
- ✅ **过期提醒**: 提前预警即将过期的证书
- ✅ **重复续期幂等**: 相同数据重复提交不产生副作用
- ✅ **清单导出**: 支持 CSV 和 JSON 格式导出

## API 接口示例

### 基础信息

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api` | API 根目录 |
| GET | `/api/health` | 健康检查 |

```bash
curl http://localhost:3000/api/health
```

---

### 员工管理

#### 创建员工

```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Content-Type: application/json" \
  -d '{
    "employee_no": "EMP004",
    "name": "赵六",
    "department": "生产部",
    "position": "操作员",
    "status": "active"
  }'
```

#### 查询所有员工

```bash
curl http://localhost:3000/api/employees
```

#### 查询员工详情（含证书、成绩、补考）

```bash
curl http://localhost:3000/api/employees/{员工ID}
```

---

### 证书管理

#### 创建证书类型

```bash
curl -X POST http://localhost:3000/api/certificates/types \
  -H "Content-Type: application/json" \
  -d '{
    "code": "FIRE-001",
    "name": "消防安全证",
    "valid_years": 2,
    "description": "消防安全培训证书"
  }'
```

#### 查询所有证书类型

```bash
curl http://localhost:3000/api/certificates/types
```

#### 颁发员工证书（幂等）

```bash
curl -X POST http://localhost:3000/api/certificates/employee \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "{员工ID}",
    "certificate_type_id": "{证书类型ID}",
    "issue_date": "2024-01-01",
    "expiry_date": "2026-01-01",
    "status": "valid"
  }'
```

#### 查询即将过期的证书

```bash
# 查询未来30天内过期的证书
curl "http://localhost:3000/api/certificates/expiring?days_ahead=30"

# 查询未来7天内过期的证书
curl "http://localhost:3000/api/certificates/expiring?days_ahead=7"
```

---

### 课程与成绩

#### 创建课程

```bash
curl -X POST http://localhost:3000/api/courses \
  -H "Content-Type: application/json" \
  -d '{
    "certificate_type_id": "{证书类型ID}",
    "code": "SAFE-103",
    "name": "消防演练实操",
    "passing_score": 60
  }'
```

#### 查询所有课程

```bash
curl http://localhost:3000/api/courses
```

#### 录入课程成绩

```bash
curl -X POST http://localhost:3000/api/courses/scores \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "{员工ID}",
    "course_id": "{课程ID}",
    "score": 75,
    "exam_date": "2024-06-15",
    "is_passed": true
  }'
```

#### 创建补考记录

```bash
curl -X POST http://localhost:3000/api/courses/retakes \
  -H "Content-Type: application/json" \
  -d '{
    "original_score_id": "{原始成绩ID}",
    "employee_id": "{员工ID}",
    "course_id": "{课程ID}",
    "retake_count": 1,
    "status": "pending"
  }'
```

#### 处理补考结果（状态推进）

```bash
curl -X POST http://localhost:3000/api/courses/retakes/process \
  -H "Content-Type: application/json" \
  -d '{
    "retake_id": "{补考记录ID}",
    "score": 65,
    "is_passed": true,
    "retake_date": "2024-06-20"
  }'
```

---

### 续期管理

#### 设置岗位证书要求

```bash
curl -X POST http://localhost:3000/api/renewal/position-requirements \
  -H "Content-Type: application/json" \
  -d '{
    "position": "操作员",
    "certificate_type_id": "{证书类型ID}",
    "is_required": true
  }'
```

#### 查询岗位要求

```bash
curl "http://localhost:3000/api/renewal/position-requirements?position=操作员"
```

#### 生成季度续期检查清单

```bash
curl -X POST http://localhost:3000/api/renewal/checklist \
  -H "Content-Type: application/json" \
  -d '{
    "checklist_date": "2024-06-01"
  }'
```

#### 查询续期检查清单

```bash
# 查询所有
curl http://localhost:3000/api/renewal/checklist

# 按状态过滤
curl "http://localhost:3000/api/renewal/checklist?status=即将过期"
```

#### 更新检查清单状态

```bash
curl -X PUT http://localhost:3000/api/renewal/checklist/{清单ID}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "已处理"
  }'
```

---

### 导出功能

#### 导出检查清单为 CSV

```bash
curl -X POST http://localhost:3000/api/export/checklist/csv \
  -H "Content-Type: application/json" \
  -d '{
    "checklist_date": "2024-06-01"
  }'
```

#### 导出检查清单为 JSON

```bash
curl -X POST http://localhost:3000/api/export/checklist/json \
  -H "Content-Type: application/json" \
  -d '{
    "checklist_date": "2024-06-01"
  }'
```

#### 查询已导出文件列表

```bash
curl http://localhost:3000/api/export/files
```

---

### 异常处理与人工修正

#### 查询处理异常记录

```bash
# 查询所有异常
curl http://localhost:3000/api/renewal/exceptions

# 按状态过滤
curl "http://localhost:3000/api/renewal/exceptions?status=pending"
```

#### 提交人工修正记录

```bash
curl -X POST http://localhost:3000/api/renewal/manual-correction \
  -H "Content-Type: application/json" \
  -d '{
    "target_type": "employee",
    "target_id": "{目标记录ID}",
    "field_name": "name",
    "old_value": "张三",
    "new_value": "张三三",
    "reason": "姓名登记有误",
    "operator": "管理员A"
  }'
```

#### 查询人工修正历史

```bash
curl http://localhost:3000/api/renewal/manual-correction
```

---

### 坏数据路径测试

触发异常路径，验证原始输入和处理结论的保存机制：

```bash
curl -X POST http://localhost:3000/api/test/bad-data \
  -H "Content-Type: application/json" \
  -d '{"test": "故意的坏数据"}'
```

触发后可通过异常查询接口查看记录：

```bash
curl http://localhost:3000/api/renewal/exceptions
```

## 快速测试脚本

服务启动后，可以依次运行以下命令验证核心功能：

```bash
# 1. 健康检查
curl http://localhost:3000/api/health

# 2. 查看员工列表
curl http://localhost:3000/api/employees

# 3. 生成续期检查清单
curl -X POST http://localhost:3000/api/renewal/checklist \
  -H "Content-Type: application/json" \
  -d '{"checklist_date": "2024-06-01"}'

# 4. 查看即将过期的证书
curl "http://localhost:3000/api/certificates/expiring?days_ahead=30"

# 5. 导出清单到CSV
curl -X POST http://localhost:3000/api/export/checklist/csv \
  -H "Content-Type: application/json" \
  -d '{}'

# 6. 触发异常路径测试
curl -X POST http://localhost:3000/api/test/bad-data

# 7. 查看异常记录
curl http://localhost:3000/api/renewal/exceptions
```

## 状态说明

### 证书状态

| 状态 | 说明 |
|------|------|
| valid | 有效 |
| expired | 已过期 |
| revoked | 已吊销 |

### 续期清单状态

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| 即将过期 | 30天内过期 |
| 已过期 | 证书已过期 |
| 待补考 | 需完成补考 |
| 符合条件 | 符合续期条件 |
| 已处理 | 已完成续期 |

### 补考状态

| 状态 | 说明 |
|------|------|
| pending | 待补考 |
| completed | 已完成 |
| failed | 补考未通过 |

## 问题修复记录

| 问题 | 修复方案 |
|------|----------|
| 样例数据重复初始化冲突 | 实现"查找或创建"模式，所有唯一键数据插入前先检查是否存在 |
| 补考状态推进不可用 | 新增 `findRetakeById` DAO方法，直接按ID查询补考记录 |
| 数据库目录不存在导致启动失败 | 数据库连接配置中自动创建 `data/` 目录 |
| 导出目录不存在导致导出失败 | 导出服务已内置 `exports/` 目录自动创建逻辑 |

## 注意事项

1. 数据库文件保存在 `data/database.db`
2. 导出文件保存在 `exports/` 目录
3. 幂等键基于员工ID、证书类型ID和颁发日期自动生成
4. 所有异常都会自动记录到 `processing_exceptions` 表
5. 人工修正操作会保留完整审计轨迹
6. `data/` 和 `exports/` 目录不存在时会自动创建
7. `npm run init-data` 可重复执行，不会产生重复数据

## License

MIT

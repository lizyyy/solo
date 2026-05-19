# 园区安保访客管理系统

统一管理访客预约、临时车牌、黑名单核验，支持批量操作和审计追踪。

## 功能特点

- ✅ **三系统合一**: 访客预约、临时车牌、黑名单统一管理
- ✅ **批量操作**: 支持CSV/JSON/数据库批量导入，自动记录成功/失败
- ✅ **失败重试**: 单独重试失败记录，不影响已成功数据
- ✅ **审计追踪**: 所有操作记录角色、操作人、时间，可追溯
- ✅ **门岗核验**: 实时核验访客身份和车辆，自动检查黑名单
- ✅ **数据导出**: 支持月度复盘报表和各类数据导出

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
python cli.py init
```

### 3. 导入样例数据

#### 导入访客数据 (CSV)
```bash
python cli.py import-cmd visitors data/sample_visitors.csv --operator 张主管 --role security_supervisor
```

**预期输出**:
```
导入完成! 批次ID: visitor_import_xxxxxx
总计: 6, 成功: 4, 失败: 2
失败记录已保存到 errors/ 目录
```

#### 导入临时车牌 (JSON)
```bash
python cli.py import-cmd plates data/sample_plates.json --operator 张主管 --role security_supervisor
```

**预期输出**:
```
导入完成! 批次ID: plate_import_xxxxxx
总计: 5, 成功: 4, 失败: 1
失败记录已保存到 errors/ 目录
```

### 4. 门岗核验

#### 核验访客
```bash
# 正常访客 (应该通过)
python cli.py verify visitor 110101199001011234 --operator 李门卫 --role gate_guard

# 黑名单访客 (应该拒绝)
python cli.py verify visitor 110101198001019999 --operator 李门卫 --role gate_guard
```

#### 核验车辆
```bash
# 正常车辆 (应该通过)
python cli.py verify vehicle 京A12345 --operator 李门卫 --role gate_guard

# 黑名单车辆 (应该拒绝)
python cli.py verify vehicle 京X99999 --operator 李门卫 --role gate_guard
```

### 5. 查看最近核验记录

```bash
python cli.py verify recent --limit 10 --operator 张主管 --role security_supervisor
```

### 6. 导出数据

#### 导出月度汇总报表 (月底复盘用)
```bash
python cli.py export monthly-summary 2025 5 --operator 张主管 --role security_supervisor
```

#### 导出发客数据
```bash
python cli.py export visitors --start-date 2025-05-01 --end-date 2025-05-31 --operator 张主管 --role security_supervisor
```

#### 导出审计日志
```bash
python cli.py export audit-logs --days 30 --operator 张主管 --role security_supervisor
```

#### 导出批量操作记录
```bash
python cli.py export batch-operations --operator 张主管 --role security_supervisor
```

### 7. 重试失败的批量导入

```bash
# 用实际的批次ID替换
python cli.py import-cmd retry visitor_import_xxxxxx --operator 张主管 --role security_supervisor
```

## 角色说明

| 角色 | 说明 | 主要操作 |
|------|------|----------|
| `security_supervisor` | 安保主管 | 数据导入、导出、重试、查看记录 |
| `gate_guard` | 门岗保安 | 访客核验、车辆核验 |
| `auditor` | 审计员 | 查看审计日志、导出报表 |

## 数据格式说明

### 访客CSV字段

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| name | ✅ | 姓名 | 张三 |
| id_card | ✅ | 身份证号 (18位) | 110101199001011234 |
| phone | ✅ | 手机号 (11位) | 13800138001 |
| visit_date | ✅ | 访问日期 (YYYY-MM-DD) | 2025-05-20 |
| visit_reason | ❌ | 访问事由 | 业务洽谈 |
| visited_person | ❌ | 被访人员 | 李经理 |

### 临时车牌JSON字段

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| plate_number | ✅ | 车牌号 | 京A12345 |
| vehicle_type | ✅ | 车辆类型 | 小型轿车 |
| owner_name | ❌ | 车主姓名 | 张三 |
| owner_phone | ❌ | 车主电话 | 13800138001 |
| valid_from | ✅ | 生效时间 (YYYY-MM-DD HH:MM) | 2025-05-20 08:00 |
| valid_to | ✅ | 失效时间 | 2025-05-20 18:00 |

### 黑名单字段

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| type | ✅ | 类型 | id_card/vehicle/phone |
| identifier | ✅ | 标识 | 110101199001011234 |
| reason | ✅ | 拉黑原因 | 多次闹事 |
| expires_at | ❌ | 过期时间 | 2026-05-20T00:00:00 |

## 目录结构

```
.
├── cli.py              # 命令行入口
├── config.py           # 配置文件
├── database.py         # 数据库操作
├── models.py           # 数据模型和校验
├── importer.py         # 数据导入逻辑
├── verifier.py         # 核验逻辑
├── exporter.py         # 数据导出逻辑
├── requirements.txt    # 依赖包
├── security_management.db  # SQLite数据库
├── data/               # 数据文件目录 (样例数据)
│   ├── sample_visitors.csv
│   ├── sample_plates.json
│   └── sample_blacklist.json
├── exports/            # 导出文件目录
└── errors/             # 失败记录目录
```

## 数据库表结构

- `visitors`: 访客预约记录
- `temporary_plates`: 临时车牌记录
- `blacklist`: 黑名单记录
- `audit_logs`: 审计日志 (所有操作)
- `batch_operations`: 批量操作记录
- `batch_records`: 批量单条记录详情

## 常见问题

### Q: 批量导入失败了怎么办？
A: 失败的记录会保存在 `errors/` 目录下，修正数据后使用 `import_cmd retry` 命令重试，不会影响已成功导入的记录。

### Q: 如何月底复盘核对数据？
A: 使用 `export monthly_summary` 导出生月汇总，结合 `export audit_logs` 和 `export batch_operations` 进行交叉核对。

### Q: 门岗核验会记录什么信息？
A: 每次核验都会记录操作人、角色、时间、核验结果，以及核验对象的详细信息，可通过 `verify recent` 查看。

### Q: 黑名单过期后会自动失效吗？
A: 是的，核验时会自动检查 `expires_at` 字段，过期的黑名单记录不会拦截。

# 老旧小区加装电梯项目API服务

## 项目介绍

这是一个为县城老旧小区加装电梯项目设计的纯后端API服务。社区工作人员可以通过该服务管理楼栋住户信息、签字意愿、施工批次和投诉记录。系统内置了多种校验规则，防止常见问题如：

- **同一户重复签字** - 自动检测重复签字
- **低楼层反对未被记录** - 重点关注低楼层反对意见
- **施工时间冲突** - 自动检测与高考、夜间禁噪期的冲突

## 功能特性

### 1. 数据导入
- 楼栋住户表CSV导入
- 签字意愿JSON导入
- 施工批次导入
- 投诉记录导入

### 2. 数据校验
- 重复签字检测
- 低楼层反对检查
- 施工时间冲突检测（高考/夜间禁噪/午休）
- 签字比例检查

### 3. 方案汇总
- 单楼栋完整汇总
- 所有楼栋汇总
- 仪表板数据

### 4. 报告导出
- 楼栋汇总导出（JSON/CSV）
- 签字记录导出（JSON/CSV）
- 校验报告导出（JSON/CSV）

### 5. 冲突复核
- 对检测到的冲突进行复核记录

## 技术栈

- **Node.js** - 服务端运行环境
- **Express.js** - Web框架
- **SQLite** - 本地数据库
- **multer** - 文件上传处理
- **csv-parser** - CSV文件解析
- **json2csv** - JSON转CSV
- **moment** - 日期时间处理

## 项目结构

```
.
├── app.js                  # 主入口文件
├── package.json            # 项目配置
├── elevator.db             # SQLite数据库（运行后自动生成）
├── models/
│   ├── database.js         # 数据库初始化和连接
│   └── storage.js          # 数据存储操作封装
├── rules/
│   └── validation.js       # 校验规则实现
├── routes/
│   ├── import.js           # 导入接口路由
│   ├── validation.js       # 校验接口路由
│   ├── summary.js          # 汇总接口路由
│   └── export.js           # 导出接口路由
├── utils/
│   └── export.js           # 导出工具函数
├── data/                   # 示例数据目录
│   ├── households.csv      # 楼栋住户表示例
│   ├── signatures.json     # 签字意愿示例
│   ├── construction_batches.json  # 施工批次示例
│   └── complaints.json     # 投诉记录示例
└── uploads/                # 文件上传临时目录
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 验证服务

```bash
curl http://localhost:3000/api/health
```

应返回：
```json
{
  "status": "ok",
  "timestamp": "2026-05-04T...",
  "service": "老旧小区加装电梯项目API服务"
}
```

## API 文档

### 导入接口

#### 1. 导入楼栋住户表CSV

```bash
curl -X POST http://localhost:3000/api/import/households/csv \
  -F "file=@data/households.csv" \
  -F "building_code=XQ-001" \
  -F "building_name=幸福小区1号楼"
```

**参数说明：**
- `file`: CSV文件
- `building_code`: 楼栋编码
- `building_name`: 楼栋名称

**CSV格式：**
```csv
楼层,房号,业主姓名,联系电话,面积
1,101,张三,13800138001,85.5
1,102,李四,13800138002,90.0
```

#### 2. 导入签字意愿JSON

```bash
curl -X POST http://localhost:3000/api/import/signatures/json \
  -H "Content-Type: application/json" \
  -d @data/signatures.json
```

**JSON格式：**
```json
{
  "building_code": "XQ-001",
  "signatures": [
    {
      "unit_number": "101",
      "is_agree": false,
      "signature_date": "2026-04-15",
      "notes": "低楼层，担心噪音和采光问题"
    }
  ]
}
```

#### 3. 导入施工批次

```bash
curl -X POST http://localhost:3000/api/import/construction-batches \
  -H "Content-Type: application/json" \
  -d @data/construction_batches.json
```

#### 4. 导入投诉记录

```bash
curl -X POST http://localhost:3000/api/import/complaints \
  -H "Content-Type: application/json" \
  -d @data/complaints.json
```

### 校验接口

#### 1. 楼栋完整校验

```bash
curl http://localhost:3000/api/validation/building/XQ-001
```

#### 2. 重复签字校验

```bash
curl -X POST http://localhost:3000/api/validation/check/duplicate-signatures \
  -H "Content-Type: application/json" \
  -d '{"building_code": "XQ-001", "unit_numbers": ["101", "102"]}'
```

#### 3. 低楼层反对检查

```bash
curl -X POST http://localhost:3000/api/validation/check/low-floor-opposition \
  -H "Content-Type: application/json" \
  -d '{"building_code": "XQ-001", "low_floor_threshold": 3}'
```

#### 4. 施工时间冲突检查

```bash
curl -X POST http://localhost:3000/api/validation/check/construction-conflicts \
  -H "Content-Type: application/json" \
  -d '{
    "batch": {
      "start_date": "2026-06-07",
      "end_date": "2026-06-15",
      "work_hours_start": "07:00",
      "work_hours_end": "23:00"
    }
  }'
```

#### 5. 签字比例检查

```bash
curl http://localhost:3000/api/validation/check/signature-ratio/XQ-001?required_ratio=0.7
```

#### 6. 冲突复核

```bash
curl -X POST http://localhost:3000/api/validation/conflict-review \
  -H "Content-Type: application/json" \
  -d '{
    "building_code": "XQ-001",
    "review_type": "low_floor_opposition",
    "conflict_details": {"threshold": 3},
    "resolution": "已与低楼层住户协商补偿方案"
  }'
```

**review_type 可选值：**
- `signature_duplicate` - 重复签字复核
- `low_floor_opposition` - 低楼层反对复核
- `construction_time` - 施工时间冲突复核

### 汇总接口

#### 1. 单楼栋方案汇总

```bash
curl http://localhost:3000/api/summary/building/XQ-001
```

#### 2. 所有楼栋汇总

```bash
curl http://localhost:3000/api/summary/all-buildings
```

#### 3. 仪表板数据

```bash
curl http://localhost:3000/api/summary/dashboard
```

### 导出接口

#### 1. 导出楼栋汇总

```bash
# JSON格式
curl http://localhost:3000/api/export/building/XQ-001

# CSV格式
curl http://localhost:3000/api/export/building/XQ-001?format=csv
```

#### 2. 导出所有楼栋

```bash
curl http://localhost:3000/api/export/all-buildings?format=csv
```

#### 3. 导出签字记录

```bash
curl http://localhost:3000/api/export/signatures/XQ-001?format=csv
```

#### 4. 导出校验报告

```bash
curl http://localhost:3000/api/export/validation-report/XQ-001?format=csv
```

## 完整流程示例

### 步骤1: 启动服务

```bash
npm install
npm start
```

### 步骤2: 导入楼栋住户表

```bash
curl -X POST http://localhost:3000/api/import/households/csv \
  -F "file=@data/households.csv" \
  -F "building_code=XQ-001" \
  -F "building_name=幸福小区1号楼"
```

### 步骤3: 导入签字意愿

```bash
curl -X POST http://localhost:3000/api/import/signatures/json \
  -H "Content-Type: application/json" \
  -d @data/signatures.json
```

### 步骤4: 导入施工批次

```bash
curl -X POST http://localhost:3000/api/import/construction-batches \
  -H "Content-Type: application/json" \
  -d @data/construction_batches.json
```

### 步骤5: 导入投诉记录

```bash
curl -X POST http://localhost:3000/api/import/complaints \
  -H "Content-Type: application/json" \
  -d @data/complaints.json
```

### 步骤6: 完整校验

```bash
curl http://localhost:3000/api/validation/building/XQ-001
```

### 步骤7: 查看方案汇总

```bash
curl http://localhost:3000/api/summary/building/XQ-001
```

### 步骤8: 导出报告

```bash
curl http://localhost:3000/api/export/validation-report/XQ-001?format=csv
```

## 校验规则说明

### 1. 重复签字检查 (duplicate_signature_check)
- 检测同一住户是否存在多条签字记录
- 导入时自动检查并拒绝重复签字

### 2. 低楼层反对检查 (low_floor_opposition_check)
- 关注3层及以下住户的反对意见
- 可配置低楼层阈值
- 提醒社区重点关注反对意见

### 3. 施工时间冲突检查 (construction_time_conflict_check)
- **高考期冲突**: 每年6月7日-9日
- **夜间禁噪**: 22:00 - 06:00
- **午休禁噪**: 12:00 - 14:00
- 自动检测并提醒冲突

### 4. 签字比例检查 (signature_ratio_check)
- 检查签字比例是否达到70%要求
- 支持按楼层检查
- 确保每楼层都达到要求

## 数据库表结构

### buildings (楼栋表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| building_code | TEXT | 楼栋编码 |
| building_name | TEXT | 楼栋名称 |
| total_floors | INTEGER | 总层数 |
| units_per_floor | INTEGER | 每层户数 |
| total_units | INTEGER | 总户数 |

### households (住户表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| building_id | INTEGER | 楼栋ID |
| unit_number | TEXT | 房号 |
| floor | INTEGER | 楼层 |
| owner_name | TEXT | 业主姓名 |
| phone | TEXT | 联系电话 |
| area | REAL | 面积 |

### signatures (签字表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| household_id | INTEGER | 住户ID |
| is_agree | BOOLEAN | 是否同意 |
| signature_date | DATE | 签字日期 |
| notes | TEXT | 备注 |

### construction_batches (施工批次表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| batch_name | TEXT | 批次名称 |
| building_id | INTEGER | 楼栋ID |
| start_date | DATE | 开始日期 |
| end_date | DATE | 结束日期 |
| work_hours_start | TEXT | 工作开始时间 |
| work_hours_end | TEXT | 工作结束时间 |
| status | TEXT | 状态 |

### complaints (投诉记录表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| building_id | INTEGER | 楼栋ID |
| household_id | INTEGER | 住户ID |
| complaint_date | DATE | 投诉日期 |
| complaint_type | TEXT | 投诉类型 |
| description | TEXT | 描述 |
| status | TEXT | 状态 |
| resolution | TEXT | 处理结果 |

### validation_rules (校验规则表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| rule_name | TEXT | 规则名称 |
| rule_description | TEXT | 规则描述 |
| is_active | BOOLEAN | 是否启用 |
| rule_config | TEXT | 规则配置(JSON) |

## License

MIT

# 冷链中转多源导入巡检 CLI (cci)

解决冷链中转数据导入中的跨日签收、箱号改名、赔付计算错误、重复导入等问题。

## 功能特性

- ✅ **多源数据导入**：支持 WMS 箱号表、温度记录仪、班次记录、司机照片元数据
- ✅ **脏数据检测**：缺字段、跨日签收、箱号改名、金额冲突、数量冲突、重复导入
- ✅ **修复流程**：保留原始内容、记录处理意见、修正后重新汇总
- ✅ **权限控制**：数据录入员、复核员、运营主管、只读查看四种角色
- ✅ **轨迹追踪**：所有操作留痕，支持历史查询和审计
- ✅ **运营报表**：原始行号、失败清单、修正后再导入追踪

## 快速开始

### 1. 安装依赖

```bash
pip install click sqlalchemy pandas python-dotenv rich questionary
```

### 2. 初始化系统

```bash
python -m cold_chain_inspector.cli init
```

### 3. 登录系统

默认账号：

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 数据录入员 | entry | entry123 |
| 复核员 | reviewer | reviewer123 |
| 运营主管 | supervisor | supervisor123 |
| 只读查看 | viewer | viewer123 |

```bash
python -m cold_chain_inspector.cli login -u supervisor -p supervisor123
```

## 命令详解

### `init` - 初始化系统
创建本地 SQLite 数据库和默认用户。

```bash
cci init
```

### `login` - 用户登录
```bash
cci login -u <用户名> -p <密码>
```

### `import-data` - 导入数据

支持四种数据源：
- `wms` - WMS 箱号表 CSV
- `temperature` - 温度记录仪 CSV
- `shift` - 班次记录 CSV
- `photo` - 司机照片元数据 CSV

```bash
cci import-data wms ./data/wms.csv
cci import-data temperature ./data/temp.csv
cci import-data shift ./data/shift.csv
cci import-data photo ./data/photo.csv
```

导入后可选择立即执行数据检查。

### `check` - 检查数据质量

```bash
cci check                 # 检查所有数据
cci check -b 1            # 检查指定批次
```

检查内容：
- 缺字段检查
- 跨日签收检查
- 箱号改名检查
- 金额冲突检查
- 数量冲突检查
- 重复记录检查

### `fix` - 修复问题记录

```bash
cci fix                   # 列出待修复记录
cci fix -r 1 -f amount -v 5000 -m "修正金额计算错误"
```

### `batches` - 查看导入批次

```bash
cci batches
```

### `report` - 运营主管报表

```bash
cci report                # 近7天报表
cci report -d 30          # 近30天报表
cci report -b 1           # 指定批次报表
```

报表包含：
- 总体概览（总记录数、问题数、状态分布）
- 问题分类统计
- 失败清单（原始行号 + 问题描述）
- 已修复记录追踪
- 修正后再导入批次汇总

### `history` - 查看操作历史

```bash
cci history               # 近30天操作记录
cci history -l 100        # 显示100条
cci history -a import     # 筛选导入操作
```

### `export` - 导出数据

```bash
cci export -o records.csv         # 导出记录
cci export --issues -o issues.csv # 导出问题清单
cci export -b 1 -o batch1.csv     # 导出指定批次
```

### `reimport` - 重新导入已修复记录

```bash
cci reimport 1             # 将批次1中已修复的记录重新导入
```

### `approve` - 审批记录（主管专用）

```bash
cci approve 1              # 审批通过记录ID为1的记录
```

## 权限矩阵

| 功能 | 数据录入员 | 复核员 | 运营主管 | 只读查看 |
|------|-----------|--------|----------|---------|
| init | ✅ | ✅ | ✅ | ❌ |
| import | ✅ | ✅ | ✅ | ❌ |
| check | ✅ | ✅ | ✅ | ❌ |
| fix | ❌ | ✅ | ✅ | ❌ |
| report | ❌ | ❌ | ✅ | ❌ |
| history | ❌ | ❌ | ✅ | ❌ |
| export | 仅自有 | ✅ | ✅ | 受限 |
| approve | ❌ | ❌ | ✅ | ❌ |

## 问题类型说明

| 类型 | 说明 |
|------|------|
| `missing_field` | 缺少必填字段（箱号、数量、金额、发货日期） |
| `cross_day_sign` | 跨日签收（发货日 ≠ 签收日） |
| `box_rename` | 箱号改名（同一原始箱号出现多个别名） |
| `amount_conflict` | 金额冲突（数量×单价 ≠ 记录金额） |
| `quantity_conflict` | 数量冲突（同一箱号多条记录数量不一致） |
| `duplicate_import` | 重复导入（相同箱号+日期+数量+金额） |

## 数据文件格式

### WMS 箱号表 CSV
```csv
箱号,司机,车牌号,出发地,目的地,发货日期,签收日期,数量,单价,金额,班次,签收人
BOX001,张三,沪A12345,上海,北京,2024-01-15,2024-01-15,100,50.0,5000.0,早班,李四
```

### 温度记录仪 CSV
```csv
箱号,时间,温度
BOX001,2024-01-15 08:00:00,5.0
```

### 班次记录 CSV
```csv
班次号,司机,车辆,日期
S001,张三,沪A12345,2024-01-15
```

### 司机照片元数据 CSV
```csv
箱号,司机,照片路径,拍摄时间,签收人
BOX001,张三,/photos/box001.jpg,2024-01-15 18:00:00,李四
```

## 验收测试

```bash
python acceptance_test.py
```

测试内容：
1. 正常链路：初始化 → 登录 → 多源导入 → 检查 → 导出
2. 坏数据检测：导入含问题数据 → 自动检测多种问题类型
3. 重复导入防重：同一文件不能重复导入
4. 修复与再导入：查看报表 → 导出问题清单 → 操作历史
5. 权限控制：各角色权限边界验证

## 项目结构

```
cold_chain_inspector/
├── __init__.py
├── cli.py              # CLI 命令入口
├── models.py           # 数据库模型
├── database.py         # 数据库连接和用户管理
├── permissions.py      # 权限控制
├── importer.py         # 多源数据导入
├── checker.py          # 脏数据检测
├── fixer.py            # 记录修复
└── reporter.py         # 报表和导出
```

## 数据库位置

本地数据库位于：`~/.cold_chain_inspector/cold_chain.db`

# 生鲜分拣损耗多源导入巡检工具 CLI

一个用于管理和巡检生鲜分拣损耗数据的命令行工具，支持多源数据导入、数据质量检查、脏数据修复、报表生成等功能。

## 功能特性

- **多源数据导入**: 支持供应商送货单、称重记录、退筐照片、手工改价表
- **去重更新**: 重复请求只更新同一条事实，不会重复计算
- **数据质量检查**: 自动检测缺字段、跨日异常、商品改名、金额冲突、数量冲突
- **交互式修复**: 保留原始内容和处理意见，支持修正后重新汇总
- **权限控制**: 录入、复核、主管、只读四种角色权限
- **操作审计**: 完整的操作历史记录
- **多格式导出**: 支持 Excel、CSV、JSON 格式导出
- **采购经理视图**: 原始行号、失败清单、修正记录一目了然

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化系统

```bash
node src/index.js init
```

或全局安装后使用 `fli` 命令:

```bash
npm link
fli init
```

### 3. 登录系统

默认管理员账号:
- 用户名: `admin`
- 密码: `admin123`

```bash
fli login admin admin123
```

### 4. 导入测试数据

```bash
# 导入供应商送货单（正常数据）
fli import data/test_delivery_normal.csv -t delivery

# 导入称重记录
fli import data/test_weight.csv -t weight

# 导入重复数据（验证去重更新）
fli import data/test_delivery_duplicate.csv -t delivery

# 导入脏数据（用于测试检查功能）
fli import data/test_delivery_dirty.csv -t delivery
```

### 5. 数据质量检查

```bash
# 全量检查
fli check

# 只检查特定类型
fli check -t missing_field
fli check -t amount_conflict

# 试运行，不保存结果
fli check --dry-run
```

### 6. 修复脏记录

```bash
# 列出待处理的脏记录
fli fix --list

# 交互式修复指定脏记录
fli fix 1
```

### 7. 生成巡检报告

```bash
# 完整报告
fli report

# 只看汇总
fli report -t summary

# 只看失败清单
fli report -t failures

# 按日期范围
fli report --start-date 2024-05-01 --end-date 2024-05-31
```

### 8. 查看操作历史

```bash
fli history

# 查看详细变更
fli history --detail

# 筛选特定操作
fli history -a import
```

### 9. 导出数据

```bash
# 导出全部（Excel格式）
fli export

# 只导出事实记录
fli export -t facts

# 导出为 CSV
fli export -f csv
```

## 命令说明

| 命令 | 说明 | 需要权限 |
|------|------|---------|
| `fli init` | 初始化系统 | - |
| `fli login <user> <pass>` | 用户登录 | - |
| `fli logout` | 退出登录 | - |
| `fli whoami` | 显示当前用户 | - |
| `fli user:create <user> <pass> <role>` | 创建新用户 | manager |
| `fli import <file> -t <type>` | 导入数据 | entry+ |
| `fli check` | 数据质量检查 | entry+ |
| `fli fix [id]` | 修复脏记录 | review+ |
| `fli report` | 生成巡检报告 | manager |
| `fli history` | 查看操作历史 | entry+ |
| `fli export` | 导出数据 | manager |

## 角色权限

| 角色 | 权限说明 |
|------|---------|
| **entry (录入员)** | 导入数据、查看数据、修复自己导入的数据 |
| **review (复核员)** | 导入数据、查看数据、修复所有数据、复核数据 |
| **manager (主管)** | 全部权限 + 报表导出 + 用户管理 |
| **readonly (只读)** | 只能查看数据，不能修改 |

## 数据质量检查类型

| 类型 | 说明 |
|------|------|
| `missing_field` | 缺少必填字段（供应商、商品名、日期等） |
| `cross_date` | 同一商品日期间隔异常（可能跨月或日期错误） |
| `name_change` | 同一商品编码对应多个商品名称 |
| `amount_conflict` | 金额计算不一致（数量×单价 ≠ 金额） |
| `quantity_conflict` | 数量不平衡（送货量 ≠ 分拣量 + 损耗量） |

## 数据源类型

| 类型标识 | 数据源名称 |
|---------|-----------|
| `delivery` | 供应商送货单 |
| `weight` | 称重记录 |
| `return_basket` | 退筐照片 |
| `price_adjust` | 手工改价表 |

## 验收测试流程

### 正常链路测试

```bash
# 1. 初始化
fli init

# 2. 登录
fli login admin admin123

# 3. 导入正常数据
fli import data/test_delivery_normal.csv -t delivery
fli import data/test_weight.csv -t weight

# 4. 质量检查
fli check

# 5. 查看报告
fli report

# 6. 导出数据
fli export
```

### 重复提交测试

```bash
# 导入重复数据
fli import data/test_delivery_duplicate.csv -t delivery

# 检查数据是否累加而不是重复
fli report -t detail

# 查看操作历史
fli history -a update_record
```

### 坏数据测试

```bash
# 导入脏数据
fli import data/test_delivery_dirty.csv -t delivery

# 检查出脏记录
fli check

# 查看脏记录列表
fli fix --list

# 交互式修复
fli fix 1

# 重新检查验证
fli check
```

### 重启后历史查询

```bash
# 退出后重新登录
fli logout
fli login admin admin123

# 查看历史操作
fli history --detail

# 验证数据完整性
fli report
```

## 目录结构

```
.
├── src/
│   ├── index.js              # CLI 入口文件
│   ├── commands/             # 命令实现
│   │   ├── init.js
│   │   ├── import.js
│   │   ├── check.js
│   │   ├── fix.js
│   │   ├── report.js
│   │   ├── history.js
│   │   └── export.js
│   └── utils/                # 工具函数
│       ├── database.js       # 数据库操作
│       ├── auth.js           # 权限认证
│       └── helpers.js        # 通用工具
├── data/                     # 数据目录
│   ├── inspector.db          # SQLite 数据库
│   ├── imports/              # 导入文件目录
│   ├── exports/              # 导出文件目录
│   └── test_*.csv            # 测试数据
└── package.json
```

## 技术栈

- Node.js + Commander.js (CLI 框架)
- SQLite + better-sqlite3 (数据库)
- xlsx + csv-parser (数据导入)
- chalk + cli-table3 (终端美化)
- inquirer (交互式命令)

## 许可证

MIT

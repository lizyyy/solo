# CRM 数据迁移预检工具

一个用于客户成功团队在 CRM 数据迁移前进行离线预检的命令行工具。

## 功能特性

- **数据验证**: 检查必填字段、类型、长度、枚举值、邮箱/手机号格式
- **关联检查**: 验证外键引用、孤立记录、重复自然键
- **风险分级**: 区分阻断迁移的错误和需要人工确认的警告
- **SQL 生成**: 根据表依赖关系生成迁移 SQL 和回滚 SQL
- **报告输出**: 生成可读的 Markdown 报告和机器可读的 JSON 报告

## 安装

```bash
# 安装依赖
pip install -e .
```

或者使用 `python -m` 方式运行（无需安装）：

```bash
python -m crm_migrate.cli --help
```

## 使用方法

### 基本命令

```bash
crm-migrate-check \
  --source-dir ./sample/source \
  --schema ./sample/schema.json \
  --mapping ./sample/mapping.yaml \
  --out ./out
```

### 参数说明

| 参数 | 简写 | 必需 | 说明 |
|------|------|------|------|
| `--source-dir` | `-s` | 是 | 包含源 CSV 文件的目录路径 |
| `--schema` | `-m` | 是 | 目标表结构配置文件 (JSON/YAML) |
| `--mapping` | `-p` | 是 | 字段映射配置文件 (JSON/YAML) |
| `--out` | `-o` | 是 | 输出目录路径 |
| `--force` | `-f` | 否 | 即使存在错误也强制生成 SQL |

### 强制模式

如果预检发现阻断性错误，默认不会生成迁移 SQL。使用 `--force` 可以强制生成草稿版本（带警告注释）：

```bash
crm-migrate-check \
  --source-dir ./sample/source \
  --schema ./sample/schema.json \
  --mapping ./sample/mapping.yaml \
  --out ./out \
  --force
```

## 输出文件

工具会在输出目录生成以下文件：

| 文件 | 说明 |
|------|------|
| `report.md` | 人类可读的预检报告（Markdown 格式） |
| `report.json` | 机器可读的预检报告（JSON 格式） |
| `migrate.sql` | 迁移 SQL 脚本（无错误或 `--force` 时生成） |
| `rollback.sql` | 回滚 SQL 脚本（无错误或 `--force` 时生成） |

## 运行示例

项目包含一套完整的示例数据，可以直接运行测试：

```bash
# 使用已安装的命令
crm-migrate-check \
  --source-dir ./sample/source \
  --schema ./sample/schema.json \
  --mapping ./sample/mapping.yaml \
  --out ./out

# 或者使用 python -m 方式
python -m crm_migrate.cli \
  --source-dir ./sample/source \
  --schema ./sample/schema.json \
  --mapping ./sample/mapping.yaml \
  --out ./out
```

运行后查看生成的报告：

```bash
cat ./out/report.md
```

## 配置说明

### Schema 配置（目标表结构）

定义目标数据库的表结构，支持以下属性：

```json
{
  "tables": {
    "accounts": {
      "columns": {
        "id": {
          "type": "string",
          "max_length": 50,
          "required": true
        },
        "status": {
          "type": "string",
          "enum": ["active", "inactive"],
          "default": "active"
        }
      },
      "foreign_keys": [
        {
          "column": "parent_id",
          "referenced_table": "accounts",
          "referenced_column": "id"
        }
      ]
    }
  }
}
```

#### 列属性

| 属性 | 说明 |
|------|------|
| `type` | 数据类型：`string`, `integer`, `float`, `boolean`, `date`, `datetime` |
| `max_length` | 最大长度（适用于字符串类型） |
| `required` | 是否必填 |
| `default` | 默认值 |
| `enum` | 允许的枚举值列表 |
| `format` | 格式验证：`email`, `phone`, `url` |
| `auto_increment` | 是否自增（不包含在 INSERT 中） |

### Mapping 配置（字段映射）

定义源 CSV 字段到目标表字段的映射关系：

```yaml
accounts:
  source_file: accounts.csv
  natural_keys:
    - id
  fields:
    id: id
    name: company_name
    website: website
  transformations:
    website:
      type: lowercase
    created_at:
      type: normalize_date
      format: "%Y-%m-%d"
```

#### 转换类型

| 类型 | 说明 |
|------|------|
| `lowercase` | 转换为小写 |
| `uppercase` | 转换为大写 |
| `trim` | 去除首尾空格 |
| `normalize_date` | 标准化日期格式 |
| `normalize_datetime` | 标准化日期时间格式 |
| `normalize_email` | 标准化邮箱（小写、去空格） |
| `normalize_phone` | 标准化手机号（保留数字和 +） |
| `boolean` | 转换为布尔值 |
| `integer` | 转换为整数 |
| `float` | 转换为浮点数 |

## 运行测试

```bash
python -m pytest tests/ -v
```

## 项目结构

```
zy8005/
├── crm_migrate/
│   ├── __init__.py
│   ├── cli.py              # 命令行入口
│   ├── config.py           # 配置解析
│   ├── csv_loader.py       # CSV 加载与规范化
│   ├── validators.py       # 校验规则
│   ├── dependency_sorter.py # 依赖排序
│   ├── sql_generator.py    # SQL 生成
│   ├── report_generator.py # 报告生成
│   └── engine.py           # 核心流程引擎
├── sample/
│   ├── source/
│   │   ├── accounts.csv
│   │   ├── contacts.csv
│   │   └── activities.csv
│   ├── schema.json
│   └── mapping.yaml
├── tests/
│   └── test_migrate.py
├── setup.py
└── README.md
```

## 校验规则说明

| 规则 | 严重程度 | 说明 |
|------|----------|------|
| `missing_mapping` | ERROR/WARNING | 目标表字段缺少映射配置 |
| `required_field` | ERROR | 必填字段缺失 |
| `type_check` | ERROR | 字段类型不匹配 |
| `length_check` | ERROR | 字段长度超限 |
| `enum_check` | ERROR | 枚举值不在允许列表中 |
| `email_format` | WARNING | 邮箱格式可能无效 |
| `phone_format` | WARNING | 手机号格式可能无效 |
| `duplicate_natural_key` | ERROR | 自然键重复 |
| `foreign_key` | ERROR | 外键引用不存在 |

## 注意事项

1. **表头大小写**: CSV 表头会自动标准化为小写
2. **空值处理**: 空字符串、"null"、"none"、"nan" 会被视为 NULL
3. **日期格式**: 支持多种日期格式自动解析
4. **SQL 转义**: 字符串中的单引号会自动转义为双单引号
5. **依赖顺序**: 迁移 SQL 按依赖关系排序（先主表后从表），回滚 SQL 相反

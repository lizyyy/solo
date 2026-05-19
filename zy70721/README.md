# SSO 属性映射测试用户回放排查工具

企业 SSO 接入时最容易错的是部门、角色、邮箱字段映射，测试通过后也缺少留痕。本工具提供完整的属性映射校验、测试用户回放、角色冲突检测、修正留痕和报告导出功能。

## 核心特性

- **属性映射校验**: 根据映射规则验证身份源数据的格式和必填项
- **测试用户回放**: 将实际映射结果与期望结果对比，找出差异
- **角色冲突检测**: 检测角色缺失、多余角色、重复角色等问题
- **修正留痕**: 记录手动修正的内容，便于追溯和复现
- **报告导出**: 支持 JSON、CSV、Markdown 多种格式报告
- **来源追踪**: 所有错误都保留原始文件位置，便于排查
- **结果稳定**: 重复运行同一批材料结果稳定，不受排序影响

## 目录结构

```
sso_mapping_tester/
├── __init__.py
├── __main__.py          # 包入口
├── cli.py               # CLI 主程序
├── core/                # 核心业务逻辑
│   ├── __init__.py
│   ├── validator.py     # 属性映射校验引擎
│   ├── playback.py      # 测试用户回放引擎
│   ├── conflict_detector.py  # 角色冲突检测器
│   └── trace.py         # 来源追踪器
├── models/              # 数据模型
│   ├── __init__.py
│   ├── user.py          # 用户相关模型
│   ├── mapping.py       # 映射规则模型
│   ├── role.py          # 角色相关模型
│   └── correction.py    # 修正记录模型
├── parsers/             # 文件解析器
│   ├── __init__.py
│   ├── base_parser.py   # 基础解析器
│   ├── identity_source_parser.py  # 身份源解析器
│   ├── mapping_parser.py         # 映射规则解析器
│   ├── test_user_parser.py       # 测试用户解析器
│   ├── role_result_parser.py     # 角色结果解析器
│   └── correction_parser.py      # 修正记录解析器
├── reports/             # 报告生成器
│   ├── __init__.py
│   └── report_generator.py
└── utils/               # 工具函数
    ├── __init__.py
    ├── hash.py          # 稳定哈希和排序
    ├── diff.py          # 差异对比
    └── validation.py    # 通用验证函数
```

## 快速开始

### 安装

无需安装，直接使用 Python 运行即可。

### 准备输入文件

1. **身份源文件** (CSV/JSON): 包含用户原始数据
   - 必填字段: `user_id` (或 `source_id`, `id`)
   - 其他字段: 如 `email`, `username`, `department` 等

2. **属性映射规则文件** (CSV/JSON): 定义映射关系和验证规则
   - `source_field`: 源字段名
   - `target_field`: 目标字段名
   - `mapping_type`: 映射类型 (`direct`, `transform`, `constant`, `conditional`)
   - `validation`: 验证规则 (`required`, `email`, `not_empty` 等，用 `|` 分隔)

3. **测试用户期望结果文件** (CSV/JSON): 定义期望的映射结果
   - `user_id`: 用户ID
   - `email`, `department`, `username` 等期望字段
   - `roles`: 期望角色列表，用 `|` 分隔

4. **实际角色结果文件** (CSV/JSON): SSO 实际输出的角色结果
   - `user_id`: 用户ID
   - `roles`: 实际角色列表，用 `|` 分隔

5. **修正记录文件** (CSV/JSON) [可选]: 记录手动修正的内容
   - `correction_id`: 修正记录ID
   - `user_id`: 用户ID
   - `correction_type`: 修正类型 (`role`, `attribute`, `role_add`, `role_remove`)
   - `field_name`: 字段名
   - `old_value`: 原值
   - `new_value`: 新值
   - `reason`: 修正原因
   - `corrected_by`: 修正人
   - `applied`: 是否应用修正

### 运行工具

```bash
python3 -m sso_mapping_tester \
  -i examples/identity.csv \
  -m examples/mapping.csv \
  -t examples/test_users.csv \
  -r examples/roles.csv \
  -c examples/corrections.csv \
  -o output
```

### 命令行参数

```
-i, --identity     身份源数据文件 (CSV或JSON)
-m, --mapping      属性映射规则文件 (CSV或JSON)
-t, --test         测试用户期望结果文件 (CSV或JSON)
-r, --roles        实际角色结果文件 (CSV或JSON)
-c, --corrections  修正记录文件 (CSV或JSON, 可选)
-o, --output       报告输出目录
-f, --format       输出报告格式 (all, json, csv, markdown, 默认: all)
-v, --verbose      显示详细输出
```

## 输出报告

工具会在输出目录生成以下文件：

- `report.json`: 完整的 JSON 格式报告
- `report_summary.json`: 简化的 JSON 摘要报告
- `report.md`: Markdown 格式报告
- `csv/mapping_errors.csv`: 属性映射错误详情
- `csv/playback_diffs.csv`: 回放差异详情
- `csv/conflicts.csv`: 角色冲突详情
- `csv/parse_errors.csv`: 文件解析错误详情

## 示例数据

`examples/` 目录包含了完整的示例数据，可以用于测试：

```bash
# 使用示例数据运行测试
python3 -m sso_mapping_tester \
  -i examples/identity.csv \
  -m examples/mapping.csv \
  -t examples/test_users.csv \
  -r examples/roles.csv \
  -c examples/corrections.csv \
  -o output
```

## 支持的文件格式

工具自动识别文件扩展名，支持 `.csv` 和 `.json` 格式。

### CSV 格式示例

**identity.csv**:
```csv
user_id,username,email,department,display_name,employee_id
U001,zhangsan,zhangsan@example.com,技术研发部,张三,E001
```

**mapping.csv**:
```csv
source_field,target_field,mapping_type,transform,validation
email,email,direct,,required|email
username,username,direct,,required
```

**test_users.csv**:
```csv
user_id,email,department,username,roles,description,tags
U001,zhangsan@example.com,技术研发部,zhangsan,developer|viewer,张三-测试用户1,base
```

**roles.csv**:
```csv
user_id,roles,success
U001,developer|viewer,true
```

**corrections.csv**:
```csv
correction_id,user_id,correction_type,field_name,old_value,new_value,reason,corrected_by,applied
C001,U002,role_remove,roles,admin,,多余的管理员角色,test,true
```

## 核心模块说明

### 属性映射校验 (Validator)

支持的验证规则：
- `required`: 必填字段，不能为空
- `not_empty`: 不能为空白字符串
- `email`: 邮箱格式验证

支持的映射类型：
- `direct`: 直接映射
- `transform`: 转换后映射（支持 `lower`, `upper`, `strip`, `replace`, `prefix`, `suffix`）
- `constant`: 常量映射
- `conditional`: 条件映射

### 测试用户回放 (Playback Engine)

对比期望属性和实际映射结果，检测以下差异类型：
- `missing`: 期望字段缺失
- `unexpected`: 出现未期望的字段
- `value_mismatch`: 字段值不匹配

### 角色冲突检测 (Conflict Detector)

检测的冲突类型：
- `missing_role`: 角色缺失
- `extra_role`: 多余角色
- `duplicate_role`: 重复角色

检测结果会保留原始文件位置，便于追溯。

## 稳定性保证

- 使用 `stable_hash` 对所有数据进行哈希，确保不依赖对象内存地址
- 使用 `stable_sort` 对所有列表进行排序，确保输出顺序稳定
- 使用 `stable_dict` 对字典键进行稳定排序
- 重复运行同一批材料结果完全一致

## License

MIT

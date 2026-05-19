# OpenAPI 示例扰动兼容校验排查 CLI

一个用于检测 OpenAPI 接口文档示例兼容性问题的命令行工具。通过对正常示例进行各种扰动（空值、类型不匹配、边界值、脏数据等），排查 Schema 校验可能存在的兼容问题。

## 功能特性

- **Schema 读取**: 支持 OpenAPI 3.0 规范，自动解析并提取 Schema 定义
- **样例变体生成**: 13 种扰动类型，包括：
  - 空值扰动 (null_value, empty_string, empty_array, empty_object)
  - 字段移除 (remove_required_field, remove_optional_field)
  - 类型不匹配 (type_mismatch)
  - 枚举错误 (wrong_enum)
  - 边界值 (boundary_value)
  - 脏数据注入 (dirty_data)
  - 数组重排 (array_reorder)
  - 额外字段 (add_extra_field)
- **校验归因**: 精确定位验证失败原因和影响字段
- **覆盖统计**: 统计扰动覆盖率和错误分布
- **多格式报告**: 支持 JSON、HTML、Markdown 三种报告格式

## 安装

```bash
pip install -e .
```

## 使用方法

### 1. 查看帮助

```bash
openapi-fuzz --help
openapi-fuzz check --help
```

### 2. 列出所有 Schema

```bash
openapi-fuzz list-schemas examples/sample_openapi.yaml
```

### 3. 列出所有 API 端点

```bash
openapi-fuzz list-endpoints examples/sample_openapi.yaml
```

### 4. 从 Schema 提取示例

```bash
openapi-fuzz extract-example examples/sample_openapi.yaml --schema-name User --output example.json
```

### 5. 执行扰动校验

```bash
# 使用默认设置
openapi-fuzz check examples/sample_openapi.yaml --schema-name User

# 使用自定义示例文件
openapi-fuzz check examples/sample_openapi.yaml --schema-name User --example-file examples/test_cases/normal_input.json

# 生成 HTML 报告
openapi-fuzz check examples/sample_openapi.yaml --schema-name User --output report.html --format html

# 限制扰动数量
openapi-fuzz check examples/sample_openapi.yaml --schema-name User --limit 50
```

### 6. 生成测试样例材料

```bash
openapi-fuzz generate-test-data examples/sample_openapi.yaml --output-dir test_data
```

## 测试样例分类

- **正常输入 (normal_input)**: 符合 Schema 规范的有效示例
- **脏数据 (dirty_data)**: XSS 注入、SQL 注入、路径遍历、空字节等恶意数据
- **边界冲突 (boundary_conflict)**: 超出范围值、类型不匹配、非法枚举值等
- **空结果 (empty_results)**: 空值、空字符串、空数组、移除必填字段等

## 项目结构

```
openapi_fuzz_checker/
├── __init__.py
├── cli/
│   ├── __init__.py
│   └── main.py           # CLI 入口
├── core/
│   ├── __init__.py
│   ├── schema_reader.py  # OpenAPI Schema 读取解析
│   ├── mutator.py        # 样例变体生成器
│   ├── validator.py      # 校验归因分析
│   └── reporter.py       # 覆盖统计和报告输出
└── utils/
    ├── __init__.py
    └── logger.py         # 日志工具
```

## 核心模块说明

### SchemaReader
- 加载和解析 OpenAPI YAML/JSON 文件
- 自动解析 `$ref` 引用
- 提取 Schema 中的示例值或生成默认示例
- 列出所有端点和 Schema 名称

### ExampleMutator
- 根据 Schema 类型智能生成扰动变体
- 支持对象、数组、基本类型的递归扰动
- 保持 Schema 结构，只修改目标字段

### SchemaValidator
- 使用 jsonschema 进行标准校验
- 归因分析：关联扰动类型和验证错误
- 假阳性检测：识别预期外的校验行为
- 错误分类：按错误类型分组统计

### ReportGenerator
- 覆盖率统计：扰动类型、字段覆盖度
- 多格式报告输出：JSON (机器可读)、HTML、Markdown (人类可读)
- 控制台实时摘要：高亮显示失败项

## 验收标准

1. **机器可读输出**: JSON 报告包含完整的验证结果和统计数据
2. **人类可读报告**: HTML/Markdown 报告清晰展示验证结果
3. **扰动覆盖度**: 至少覆盖 10 种以上扰动类型
4. **错误归因**: 每个验证失败都能关联到具体的扰动类型

## 开发

### 运行测试

```bash
pytest tests/ -v
```

### 依赖

- `click>=8.0.0`: 命令行界面
- `pyyaml>=6.0`: YAML 解析
- `jsonschema>=4.0.0`: Schema 验证
- `prance>=0.21.0`: OpenAPI 规范解析
- `rich>=12.0.0`: 终端输出美化
- `pydantic>=1.10.0`: 数据验证

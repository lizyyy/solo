# JSON Schema 边界样本排查 CLI

> 后端同学写了 JSON Schema，却没有成套的正常、边界和非法样本给联调用？

这个工具自动为你的 JSON Schema 生成成套的测试样本，包含：
- ✅ 正常输入样本 (valid)
- ⚠️ 边界条件样本 (boundary)
- ❌ 非法输入样本 - 脏数据 (invalid)
- 🔲 边缘案例 - 空值、冲突等 (edge_case)

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成示例 Schema（可选）

```bash
python schema_sample_cli.py example
```

### 3. 生成测试样本

```bash
python schema_sample_cli.py generate user_schema.json -o test_samples
```

## 命令说明

### generate - 生成测试样本

```bash
python schema_sample_cli.py generate <schema_file> [OPTIONS]
```

参数：
- `schema_file`: Schema 文件路径（必需）
- `-o, --output`: 输出目录（默认: ./test_samples）
- `-s, --seed`: 随机种子，保证重复生成稳定（默认: 42）
- `-n, --name`: Schema 名称（默认使用文件名）

### list-samples - 列出样本索引

```bash
python schema_sample_cli.py list-samples <index_file> [OPTIONS]
```

参数：
- `index_file`: index.json 文件路径（必需）
- `-t, --type`: 按类型过滤: valid/boundary/invalid/edge_case
- `-f, --field`: 按字段名过滤

### show - 查看单个样本详情

```bash
python schema_sample_cli.py show <sample_dir> <sample_id>
```

参数：
- `sample_dir`: 样本目录
- `sample_id`: 样本ID

### example - 生成示例 Schema

```bash
python schema_sample_cli.py example
```

## 输出目录结构

```
test_samples/
├── valid/          # 正常输入样本
│   └── valid_xxx.json
├── boundary/       # 边界条件样本（极值）
│   └── boundary_xxx.json
├── invalid/        # 非法输入样本（脏数据）
│   └── invalid_xxx.json
├── edge_case/      # 边缘案例（空值、冲突等）
│   └── edge_xxx.json
├── index.json      # 机器可读索引文件
└── report.txt      # 人可读的报告文件
```

## 机器可读索引文件 (index.json)

包含所有样本的元数据，可用于自动化测试集成：

```json
{
  "schema": "user_schema",
  "generated_at": "2026-05-19T15:25:40.114724",
  "total_samples": 23,
  "samples_by_type": {
    "valid": 1,
    "boundary": 6,
    "invalid": 13,
    "edge_case": 3
  },
  "samples": [
    {
      "id": "valid_3ac43b08",
      "type": "valid",
      "data": {...},
      "reason": "Valid sample",
      "field": null
    },
    ...
  ]
}
```

## 支持的 Schema 约束

- `type`: object, array, string, number, integer, boolean, null
- `string`: minLength, maxLength, pattern, enum, format (email, uri, uuid)
- `number/integer`: minimum, maximum
- `array`: minItems, maxItems, items
- `object`: properties, required

## 重复生成稳定性

使用相同的 `--seed` 参数可以保证每次生成的样本完全一致，便于复现和回归测试。

```bash
# 每次运行都会生成完全相同的样本
python schema_sample_cli.py generate schema.json -o output1 -s 42
python schema_sample_cli.py generate schema.json -o output2 -s 42
```

## 典型工作流

1. 从后端获取 API 的 JSON Schema
2. 用此工具生成全套测试样本
3. 前端/联调同学使用这些样本进行测试：
   - 使用 valid 样本验证正常流程
   - 使用 boundary 样本验证边界条件
   - 使用 invalid 样本验证错误处理逻辑
   - 使用 edge_case 样本验证极端情况
4. 配合自动化测试框架，使用 index.json 进行批量验证

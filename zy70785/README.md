# 备份 Manifest 校验排查 CLI (bmcheck)

一个用于检查备份文件完整性的命令行工具，支持解析 manifest 文件、校验文件存在性、验证校验和、归因分析缺失块。

## 功能特性

- **Manifest 解析**: 支持 JSON、YAML、简单文本格式
- **文件存在性检查**: 验证备份目录中所有分片文件是否存在
- **校验和验证**: 支持 MD5、SHA1、SHA256、SHA512 等算法
- **缺块归因**: 智能分析缺失块的可能原因
- **模式识别**: 发现连续缺失、相同前缀缺失等模式
- **报告输出**: 支持文本、JSON、CSV 格式报告
- **结果稳定**: 所有输出按固定顺序排序，确保重复运行结果一致

## 安装

```bash
pip install -e .
```

或

```bash
pip install -r requirements.txt
python -m backup_manifest_checker.cli.main
```

## 使用方法

### 1. 完整校验流程

```bash
bmcheck check <manifest_path> <backup_dir>
```

示例：
```bash
bmcheck check manifest.txt /path/to/backup
```

### 2. 跳过校验和计算（快速检查）

```bash
bmcheck check --skip-checksum manifest.txt /path/to/backup
```

### 3. 输出报告到文件

```bash
# 文本格式
bmcheck check manifest.txt /path/to/backup -o report.txt

# JSON 格式
bmcheck check manifest.txt /path/to/backup -o report.json -f json

# CSV 格式（输出多个文件到目录）
bmcheck check manifest.txt /path/to/backup -o reports/ -f csv
```

### 4. 仅解析 Manifest 文件

```bash
bmcheck parse manifest.txt
```

### 5. 列出备份目录所有文件

```bash
bmcheck list-files /path/to/backup
```

### 6. 详细输出

```bash
bmcheck check manifest.txt /path/to/backup -v
```

## Manifest 文件格式

### 简单文本格式

每行一个文件，校验和在前：

```
d41d8cd98f00b204e9800998ecf8427e  chunk1.dat
e5a8a7d7b8c9d0e1f2a3b4c5d6e7f8a9  chunk2.dat
```

或使用管道分隔符：

```
chunk1.dat | /path/to/chunk1.dat | d41d8cd98f00b204e9800998ecf8427e
```

### JSON 格式

```json
{
  "chunks": [
    {
      "chunk_id": "chunk1.dat",
      "file_path": "chunk1.dat",
      "checksum": "d41d8cd98f00b204e9800998ecf8427e",
      "size": 1024
    }
  ]
}
```

### YAML 格式

```yaml
chunks:
  - chunk_id: chunk1.dat
    file_path: chunk1.dat
    checksum: d41d8cd98f00b204e9800998ecf8427e
    size: 1024
```

## 项目结构

```
backup_manifest_checker/
├── __init__.py
├── cli/
│   ├── __init__.py
│   └── main.py              # CLI 入口
└── core/
    ├── __init__.py
    ├── parser.py            # Manifest 解析模块
    ├── checksum.py          # 校验和检查模块
    ├── attribution.py       # 归因分析模块
    └── report.py            # 报告生成模块
```

## 故障原因说明

| 原因 | 说明 |
|------|------|
| file_not_found | 文件未找到 |
| name_mismatch | 文件名不匹配（但有相似文件） |
| checksum_mismatch | 校验和不匹配 |
| partial_upload | 文件不完整（大小不匹配） |
| corrupted_file | 文件已损坏 |
| invalid_manifest | Manifest 文件格式错误 |
| unknown | 未知原因 |

## 退出代码

- `0`: 所有检查通过
- `1`: 发现问题（文件缺失、校验和失败、解析错误等）

## 开发

### 运行测试

```bash
cd tests
python -m pytest
```

### 测试数据

参考 `tests/sample_data/` 目录下的示例文件。

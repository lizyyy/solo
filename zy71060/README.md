# 对象存储校验清单 CLI

一个功能完整的命令行工具，用于验证备份数据上传到对象存储后的完整性。解决了"只看文件数量，恢复时才发现分片和 checksum 对不上"的问题。

## ✨ 功能特性

- **Manifest 解析** - 支持 JSON/YAML 多种格式，兼容不同厂商的清单格式
- **分片完整性校验** - 检查分片是否缺失、大小是否匹配、checksum 是否正确
- **多格式 Checksum 验证** - 支持 MD5/SHA1/SHA256/SHA512/CRC32，自动处理 HEX/Base64 格式转换
- **多区域副本对比** - 对比不同存储区域的副本一致性，检测不一致问题
- **缺失分片定位** - 精确定位缺失的分片编号和位置
- **详细报告导出** - 终端摘要 + 机器可读 JSON + 同事可读 Markdown 三种输出格式
- **稳定退出码** - 便于集成到自动化脚本和 CI/CD 流程

## 📦 安装

### 环境要求
- Python 3.8+
- pip 或 poetry

### 安装步骤

```bash
# 克隆或下载代码到本地
cd oss-checksum-cli

# 安装依赖
pip install -e .

# 验证安装
oss-check --version
```

### 可选依赖

如需支持 YAML 格式的 Manifest：
```bash
pip install pyyaml
```

## 🚀 快速开始

### 1. 生成示例数据（测试用）

```bash
# 生成包含正常数据和坏数据的示例
oss-check examples --with-bad-data
```

### 2. 查看 Manifest 内容

```bash
# 文本格式查看
oss-check inspect examples/manifest_good.json

# JSON 格式输出
oss-check inspect examples/manifest_good.json -f json

# YAML 格式输出（需要安装 pyyaml）
oss-check inspect examples/manifest_good.json -f yaml
```

### 3. 执行完整性校验

基础校验（只检查 Manifest 内部一致性和区域对比）：
```bash
oss-check validate examples/manifest_good.json
```

带实际分片内容校验：
```bash
oss-check validate examples/manifest_good.json -c examples/chunks
```

指定输出目录：
```bash
oss-check validate examples/manifest_good.json -o ./my-reports
```

静默模式（只输出退出码）：
```bash
oss-check validate examples/manifest_good.json -q
```

### 4. 查看退出码说明

```bash
oss-check list-exit-codes
```

## 📁 输入目录结构

### 推荐的目录布局

```
backup-20240115/
├── manifest.json           # 主清单文件（必需）
├── chunks/                 # 分片文件目录（可选，用于实际校验）
│   ├── chunk-001
│   ├── chunk-002
│   └── chunk-003
└── reports/                # 输出报告目录（自动创建）
    ├── validation_report_20240115_120000.json
    ├── validation_report_20240115_120000.md
    └── validation_report_20240115_120000_summary.txt
```

### Manifest 文件格式

#### 最小格式（单区域）

```json
{
  "manifest_id": "backup-2024-01-15",
  "version": "1.0",
  "files": [
    {
      "file_id": "data-001",
      "file_name": "data.tar.gz",
      "total_size": 10485760,
      "expected_chunks": 2,
      "chunks": [
        {
          "chunk_id": "chunk-001",
          "part_number": 1,
          "size": 5242880,
          "checksums": {
            "md5": "5d41402abc4b2a76b9719d911017c592"
          }
        }
      ]
    }
  ]
}
```

#### 完整格式（多区域）

```json
{
  "manifest_id": "backup-2024-01-15",
  "version": "1.0",
  "created_at": "2024-01-15T03:00:00Z",
  "checksum_algorithms": ["md5", "sha256"],
  "regions": {
    "cn-north-1": {
      "region": "cn-north-1",
      "bucket": "backup-primary",
      "files": []
    },
    "cn-south-1": {
      "region": "cn-south-1",
      "bucket": "backup-replica",
      "files": []
    }
  }
}
```

## 🔧 命令参考

### validate - 执行完整性校验

```
Usage: oss-check validate [OPTIONS] MANIFEST_PATH

  校验对象存储备份数据的完整性

Options:
  -c, --chunks-dir PATH         本地分片文件所在目录
  -o, --output-dir PATH         报告输出目录 [default: ./reports]
  --compare-regions / --no-compare-regions
                                是否对比多区域副本一致性 [default: compare-regions]
  -a, --algorithm [md5|sha1|sha256|sha512|crc32|crc64]
                                指定校验算法（可多选）
  -v, --verbose                 显示详细输出
  -q, --quiet                   静默模式，只输出最终结果
  --help                        Show this message and exit.
```

### inspect - 查看 Manifest 内容

```
Usage: oss-check inspect [OPTIONS] MANIFEST_PATH

  查看 Manifest 文件内容

Options:
  -f, --output-format [json|yaml|text]
                                  输出格式 [default: text]
  --help                          Show this message and exit.
```

### examples - 生成示例数据

```
Usage: oss-check examples [OPTIONS]

  生成示例 Manifest 文件和测试数据

Options:
  -o, --output-dir PATH   示例文件输出目录 [default: ./examples]
  --with-bad-data         包含坏数据示例（用于测试）
  --help                  Show this message and exit.
```

### list-exit-codes - 列出退出码

```
Usage: oss-check list-exit-codes [OPTIONS]

  列出所有退出码及其含义

Options:
  --help  Show this message and exit.
```

## ❌ 坏数据怎么处理

### 常见问题类型及处理方法

#### 1. 分片缺失 (chunk_missing)

**现象**：
- 错误代码: `chunk_missing`
- 提示信息: "Chunk file not found" 或 "Chunk data not available"

**处理步骤**：
1. 检查分片文件目录是否正确
2. 确认分片文件命名是否与 manifest 一致
3. 从源端重新上传缺失的分片
4. 或使用对象存储的版本管理恢复

#### 2. Checksum 不匹配 (chunk_checksum_mismatch)

**现象**：
- 错误代码: `chunk_checksum_mismatch`
- 提示信息包含 expected 和 actual 值对比

**可能原因**：
- 传输过程中数据损坏
- checksum 格式不匹配（HEX vs Base64）
- 算法选择错误

**处理步骤**：
1. 确认 checksum 算法和格式是否一致
2. 重新下载或传输该分片
3. 如源端数据已损坏，从备份恢复

#### 3. 大小不匹配 (chunk_size_mismatch)

**现象**：
- 错误代码: `chunk_size_mismatch`
- 提示信息显示 expected 和 actual 大小

**处理步骤**：
1. 检查是否为分片上传中断导致的不完整文件
2. 重新上传该分片
3. 确认分片大小配置是否正确

#### 4. 文件缺失区域副本 (file_missing_in_region)

**现象**：
- 错误代码: `file_missing_in_region`
- 提示某个文件在特定区域不存在

**处理步骤**：
1. 触发跨区域复制 (CRR)
2. 手动同步缺失的文件
3. 检查复制规则配置

#### 5. 跨区域 checksum 不一致

**现象**：
- 区域对比发现同一文件在不同区域 checksum 不同

**处理步骤**：
1. 以源区域为准，重新同步副本区域
2. 检查是否有未完成的复制任务
3. 验证源区域数据完整性后重新复制

### 在脚本中自动化处理

```bash
#!/bin/bash

oss-check validate manifest.json -c ./chunks -o ./reports
EXIT_CODE=$?

case $EXIT_CODE in
    0)
        echo "✅ 校验通过"
        ;;
    1)
        echo "❌ 发现数据问题，查看报告: ./reports/*.md"
        # 可以在这里触发告警或自动修复
        ;;
    2)
        echo "⚠️ 输入错误，检查参数和文件"
        exit 1
        ;;
    *)
        echo "❓ 未知错误"
        exit 1
        ;;
esac
```

## 📊 退出码说明

| 退出码 | 名称 | 说明 |
|--------|------|------|
| 0 | SUCCESS | 校验成功，没有发现错误 |
| 1 | VALIDATION_ERROR | 校验失败，发现数据完整性问题 |
| 2 | INPUT_ERROR | 输入错误（文件不存在、格式错误等） |
| 3 | IO_ERROR | 文件读写错误 |
| 4 | CONFIG_ERROR | 配置错误 |
| 10 | UNKNOWN_ERROR | 未知错误 |

## 📝 报告格式说明

### 终端输出
- 彩色友好的摘要信息
- 关键指标一目了然
- 前 N 条错误详情
- 适合人工快速查看

### JSON 报告
- 完整的结构化数据
- 包含所有错误详情
- 适合程序解析和自动化处理
- 文件名: `validation_report_*.json`

### Markdown 报告
- 格式化的文档
- 包含问题详情和建议行动
- 适合分享给同事查看
- 可直接粘贴到工单或邮件中
- 文件名: `validation_report_*.md`

### 纯文本摘要
- 最精简的信息
- 适合日志记录
- 文件名: `validation_report_*_summary.txt`

## 🔍 高级用法

### 集成到 CI/CD

```yaml
# .github/workflows/backup-validation.yml
name: Backup Validation

on:
  schedule:
    - cron: '0 4 * * *'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install oss-check
        run: |
          cd tools/oss-checksum-cli
          pip install -e .
      
      - name: Download latest manifest
        run: aws s3 cp s3://backup-bucket/manifest/latest.json ./manifest.json
      
      - name: Run validation
        run: |
          oss-check validate ./manifest.json -o ./reports
          EXIT_CODE=$?
          if [ $EXIT_CODE -ne 0 ]; then
            echo "::error::Backup validation failed!"
            exit 1
          fi
```

### 与对象存储 SDK 集成

可以编写脚本从对象存储获取实际的分片列表和 ETag，然后与 manifest 对比：

```python
import boto3
from oss_checksum_cli import ManifestParser, FileValidator

s3 = boto3.client('s3')

# 获取 S3 上的实际对象列表
response = s3.list_objects_v2(Bucket='my-bucket', Prefix='backup/')
actual_objects = {obj['Key']: obj for obj in response.get('Contents', [])}

# 解析 manifest 并对比
parser = ManifestParser()
manifest = parser.parse('manifest.json')

for region in manifest.regions.values():
    for file_id, file in region.files.items():
        for chunk in file.chunks:
            expected_key = f"backup/chunks/{chunk.chunk_id}"
            if expected_key not in actual_objects:
                print(f"Missing: {expected_key}")
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

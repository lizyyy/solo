# 环境变量快照命令行工具

一个用于管理供应商环境变量快照、签名验证和合规报告的命令行工具。

## 功能特性

- ✅ **供应商目录管理** - 单个/批量添加，支持预览
- ✅ **签名算法验证** - 支持 SHA256/SHA512/MD5/HMAC/RSA
- ✅ **异常检测** - 算法不一致、签名不匹配自动识别
- ✅ **批量操作** - 支持预览影响范围后执行
- ✅ **数据持久化** - SQLite 本地存储，重启不丢失
- ✅ **多格式输出** - JSON/Markdown 报告
- ✅ **错误样本** - 自动记录错误详情
- ✅ **历史查询** - 按批次/操作者/风险类型过滤
- ✅ **法务证据** - 复核样例 + 重跑标记追溯

## 安装

```bash
pip install -e .
```

或

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 初始化数据库

```bash
env-snapshot init
```

### 2. 添加供应商

单个添加：
```bash
env-snapshot add-supplier "供应商A" --algorithm SHA256 --contact "a@example.com"
```

批量补录（先预览）：
```bash
env-snapshot batch-suppliers examples/suppliers.json --preview
```

批量补录（执行）：
```bash
env-snapshot batch-suppliers examples/suppliers.json --operator "张三"
```

### 3. 创建快照并验证

先对环境变量文件签名：
```bash
env-snapshot sign examples/env_vars.json SHA256
```

创建快照：
```bash
env-snapshot snapshot "供应商A" examples/env_vars.json "签名值" SHA256
```

### 4. 查询历史

```bash
# 查看所有
env-snapshot history

# 按批次过滤
env-snapshot history --batch BATCH-XXXX

# 按操作者过滤
env-snapshot history --operator "张三"

# 按风险类型过滤
env-snapshot history --risk algorithm_mismatch

# JSON格式输出
env-snapshot history --format json
```

### 5. 生成报告

```bash
# Markdown 格式（含法务证据）
env-snapshot report --format markdown

# JSON 格式
env-snapshot report --format json

# 指定批次
env-snapshot report --batch BATCH-XXXX
```

## 支持的签名算法

- SHA256
- SHA512
- MD5
- HMAC-SHA256
- RSA-SHA256

## 数据存储位置

数据库文件位于：`~/.env-snapshot/env_snapshot.db`

## 项目结构

```
env_snapshot/
├── __init__.py          # 包初始化
├── database.py          # 数据库模型和连接
├── signature.py         # 签名/验证服务
├── service.py           # 业务逻辑层
├── report.py            # 报告生成器
└── cli.py               # CLI 命令入口
```

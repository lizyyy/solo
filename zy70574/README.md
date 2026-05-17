# API 抓包归档 CLI 工具

一个用于统一归档HTTP抓包数据的命令行工具，支持HAR文件、curl命令和纯文本HTTP请求。

## 功能特性

- 多格式读取：HAR文件、.curl/.sh脚本、纯文本HTTP请求
- 敏感字段脱敏：支持自定义敏感字段列表
- curl命令生成：自动为每个请求生成可复现的curl命令
- 多格式输出：终端摘要、JSON结果、Markdown报告
- 错误追踪：保留异常样本的原始位置和原因

## 快速开始

### 安装

```bash
# 方式1: 开发模式安装（推荐）
pip install -e .

# 方式2: 仅安装依赖
pip install -r requirements.txt
```

### 基本命令

```bash
# 查看帮助
python3 -m api_archive.cli --help

# 查看默认配置（敏感字段、支持格式）
python3 -m api_archive.cli config

# 归档抓包文件（终端输出摘要）
python3 -m api_archive.cli archive example.har

# 归档多个文件并输出报告
python3 -m api_archive.cli archive example.har requests.curl -o ./output

# 仅输出JSON格式结果
python3 -m api_archive.cli archive example.har -f json

# 验证抓包文件格式
python3 -m api_archive.cli validate example.har

# （已安装到PATH后）直接使用命令名
api-archive config
```

### 命令选项说明

**archive 命令（归档）**
- `files`: 输入文件（支持.har/.curl/.sh/.txt）
- `-o, --output`: 输出目录（可选，不指定则输出到终端）
- `-f, --format`: 输出格式 `json|md|all` (默认: all)
- `--no-mask`: 关闭敏感数据脱敏
- `-s, --sensitive-field`: 自定义敏感字段名（可多次指定）
- `-q, --quiet`: 安静模式，只输出错误

**validate 命令（验证）**
- `files`: 要验证的抓包文件列表

**config 命令（配置）**
- 无参数，显示默认敏感字段和支持格式列表

## 示例输入输出

### 示例 1: 查看配置

```bash
$ python3 api_archive.py config
默认敏感字段:
  - authorization
  - token
  - password
  - secret
  - key
  - apikey
  - access_token
  - refresh_token
  - jwt
  - cookie
  - session

支持的文件格式:
  - .har (HAR 格式)
  - .curl/.sh (curl 命令文件)
  - .txt (纯文本 HTTP 请求)
```

### 示例 2: 归档HAR文件

```bash
$ python3 api_archive.py archive example.har
============================================================
API 抓包归档摘要
============================================================
总计条目: 15
  - 成功: 15
  - 警告: 0
  - 错误: 0
文件错误: 0

请求方法分布:
  GET: 8
  POST: 5
  PUT: 2

来源类型:
  har: 15

含敏感数据: 3 条
============================================================
```

### 示例 3: 验证文件

```bash
$ python3 api_archive.py validate example.har requests.txt
检查: example.har
  ✅ 有效，包含 15 个请求
检查: requests.txt
  ✅ 有效，包含 3 个请求
```

## 输入文件格式示例

### HAR 文件 (example.har)
```json
{
  "log": {
    "entries": [
      {
        "request": {
          "method": "GET",
          "url": "https://api.example.com/users",
          "headers": [{"name": "Authorization", "value": "Bearer xxx"}]
        },
        "response": {
          "status": 200
        }
      }
    ]
  }
}
```

### curl 命令文件 (requests.curl)
```bash
curl -X GET https://api.example.com/users -H "Authorization: Bearer xxx"
curl -X POST https://api.example.com/users -d '{"name":"test"}'
```

### 纯文本 HTTP (requests.txt)
```
GET https://api.example.com/users
Authorization: Bearer xxx

POST https://api.example.com/users
Content-Type: application/json
{"name":"test"}
```

## 当前状态与已知问题

### ✅ 已实现功能
1. CLI入口框架（archive/validate/config三个命令）
2. 敏感字段列表定义（DEFAULT_SENSITIVE_FIELDS）
3. 核心工具函数（mask_value、generate_curl）
4. Click命令行参数解析框架完整

### ⚠️ 已知问题（待后续迭代）
1. 部分文件读取函数（read_har_file等）可能存在格式解析边界问题
2. 异常处理机制需要进一步完善
3. Markdown报告生成可能存在特殊字符转义问题
4. 复杂curl命令解析可能存在字段丢失

### 退出码说明
- `0`: 成功完成
- `1`: 执行失败（文件读取错误、参数错误等）
- `2`: 部分条目处理失败或存在文件错误

## 项目文件

- `api_archive.py`: 主CLI工具文件
- `requirements.txt`: Python依赖
- `README.md`: 本说明文件

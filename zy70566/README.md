# SAN Checker CLI

批量申请证书时，确保 SAN 列表不会漏掉灰度域名。支持 CSR 解析、证书解析、域名清单核对、通配符匹配、过期检查和多种报告输出格式。

## 功能特性

- CSR 文件解析
- 证书文件解析（PEM格式）
- 域名清单解析（支持注释和空行）
- SAN 列表对比核对
- 通配符域名智能匹配
- 证书有效期检查和预警
- 终端摘要输出
- JSON 机器可读输出
- 坏行保留原始位置和原因

## 安装

```bash
pip install -e .
```

或者安装依赖：

```bash
pip install -r requirements.txt
```

## 使用方法

### 基本命令

```bash
# 核对 CSR 的 SAN 列表
san-checker check domains.txt --csr example.csr

# 核对已签发证书的 SAN 列表
san-checker check domains.txt --cert example.crt

# 输出 JSON 格式报告
san-checker check domains.txt --csr example.csr --json

# 将报告写入文件
san-checker check domains.txt --cert example.crt -o report.txt
```

### 或使用 Python 模块运行

```bash
python -m san_checker.cli check domains.txt --csr example.csr
```

## 输入目录结构示例

```
cert-check/
├── domains.txt       # 期望的域名清单
├── example.csr       # CSR 文件
└── example.crt       # 证书文件
```

## 域名清单文件格式

```txt
# 以 # 开头的是注释，空行会被忽略
example.com
www.example.com
api.example.com
gray.example.com
*.wildcard.com
```

## 报告输出位置

- 终端：默认输出到 stdout
- 文件：使用 `-o` 或 `--output` 参数指定
- JSON：使用 `-j` 或 `--json` 参数

## 退出码

- `0`: 所有域名匹配成功，无错误
- `1`: 有缺失域名或解析错误

## 通配符匹配规则

- `*.example.com` 可匹配：
  - `example.com` (裸域名)
  - `www.example.com`
  - `api.example.com`
  - `gray.example.com`

## 项目结构

```
san_checker/
├── __init__.py      # 版本信息
├── exceptions.py    # 自定义异常
├── parser.py        # CSR/证书/域名解析
├── comparer.py      # SAN对比和过期检查
├── reporter.py      # 报告生成
└── cli.py           # CLI入口
```

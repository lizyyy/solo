# 死配置扫描命令行工具

用于检测失效链接、废弃配置的命令行工具，专为灰度法务证据页等场景设计。

## 功能特性

- ✅ **链接有效性检测**: HTTP/HTTPS 链接存活检测，支持 404、500 等错误码
- ✅ **智能检测策略**: 先尝试 HEAD 请求，失败后自动用 GET 兜底（带 Range 头避免下载大文件）
- ✅ **规则版本管理**: 规则变更时，旧批次仍能解释当时使用的判断口径
- ✅ **批次管理**: 批量扫描，结果持久化存储
- ✅ **结果复用**: 相同内容再次提交时自动复用旧结论
- ✅ **冲突检测**: 规则版本变更时提示冲突
- ✅ **失败项单独保存**: 每个失败项独立文件，方便接手时直接查看原因
- ✅ **边界记录**: 报告中展示输入和失败原因
- ✅ **按摘要查询**: 通过内容摘要过滤历史记录
- ✅ **人工确认**: 支持标记失败项为已人工审核
- ✅ **清晰的返回码**: 验收时可通过命令返回码判断结果

## 返回码说明

| 返回码 | 含义 |
|--------|------|
| 0 | 全部通过，无失效项 |
| 1 | 存在无效项（如 404 链接） |
| 2 | 存在扫描错误（如网络异常） |
| 3 | 输入文件错误 |

## 安装

```bash
pip install poetry
poetry install
```

## 使用方法

### 1. 运行演示（包含边界测试用例）

```bash
poetry run dcs demo
```

### 2. 扫描文件中的 URL

```bash
# 扫描 txt 文件，每行一个 URL
poetry run dcs scan examples.txt

# 指定批次名称和输出目录
poetry run dcs scan examples.txt --name "法务证据页扫描" --output ./results

# 不使用缓存，强制重新扫描
poetry run dcs scan examples.txt --no-cache
```

### 3. 列出所有扫描批次

```bash
poetry run dcs list
```

### 4. 查看指定批次详情

```bash
poetry run dcs show <batch_id>
```

### 5. 按内容摘要查询

```bash
poetry run dcs query <content_hash>
```

### 6. 查看失败记录

```bash
# 查看所有失败记录
poetry run dcs failures

# 按批次过滤
poetry run dcs failures --batch-id <batch_id>

# 按内容摘要过滤
poetry run dcs failures --hash <content_hash>

# JSON 格式输出
poetry run dcs failures --json
```

### 7. 标记人工审核

```bash
poetry run dcs review <record_id> --comment "已确认，此链接已废弃"
```

## 项目结构

```
dead_config_scanner/
├── __init__.py          # 包入口
├── cli.py               # 命令行接口
├── scanner.py           # 核心扫描协调器
├── models/              # 数据模型
│   ├── __init__.py
│   ├── scan.py          # 扫描相关模型（批次、项、配置）
│   ├── rule.py          # 规则相关模型
│   └── failure.py       # 失败记录模型
├── rules/               # 规则引擎
│   ├── __init__.py
│   ├── engine.py        # 规则执行引擎
│   └── builtin.py       # 内置规则集
├── storage/             # 存储管理
│   ├── __init__.py
│   └── manager.py       # 持久化和缓存管理
└── reports/             # 报告生成
    ├── __init__.py
    └── generator.py     # 报告生成器
```

## 输出目录结构

```
output/
├── batches/             # 批次扫描结果（JSON）
├── failures/            # 失败项单独存储（每个失败一个文件）
├── cache/               # 扫描结果缓存（用于复用）
└── reports/             # 生成的报告
    ├── batch_*_report.json  # JSON 格式详细报告
    └── batch_*_summary.txt  # 文本格式摘要报告
```

## 边界测试用例

演示模式内置以下边界案例：
- 404 失效链接（法务证据页场景）
- 200 有效链接（正常场景）
- 无效域名（网络错误场景）
- 废弃 API 模式（配置废弃场景）

## 规则说明

当前内置规则：
1. **URL 存活检测**: 检查 HTTP 状态码，4xx/5xx 视为失效
2. **废弃配置模式**: 匹配已知废弃的 URL 模式
3. **法务证据页专用检测**: 针对高优先级证据页的专门检测逻辑

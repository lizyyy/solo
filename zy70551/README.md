# Helm Values 覆盖审计 CLI 工具

追踪多层环境中 Helm values 的覆盖来源，避免生产值来自临时文件导致的事故。

## 功能特性

- ✅ **YAML 合并** - 支持多层 values 文件深度合并
- 🔗 **覆盖链追踪** - 显示每个键在每个文件中的来源和行号
- 🔒 **敏感值遮蔽** - 自动识别 password/secret/token 等敏感键
- 📊 **多种报告** - 终端摘要、JSON 机器可读、HTML 友好报告
- ❌ **错误处理** - 坏行保留原始位置和原因，不抛异常
- 🎯 **退出码区分** - 成功返回0，有错误返回非0

## 安装方式

```bash
cd /path/to/project
pip3 install -e .
```

安装后使用 `helm-value-auditor` 命令，如果提示 command not found:
```bash
# 使用完整路径
/Users/lzy/Library/Python/3.9/bin/helm-value-auditor

# 或者添加到 PATH
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
```

## 目录结构示例

典型的 Helm chart 项目结构：

```
mychart/
├── Chart.yaml
├── templates/
└── values/
    ├── base.yaml          # 基础默认配置
    ├── dev.yaml           # 开发环境覆盖
    ├── staging.yaml       # 预发布环境覆盖
    └── prod.yaml          # 生产环境覆盖
```

建议的加载顺序：从基础到特定，如 `base.yaml → staging.yaml → prod.yaml`

## 使用示例

### 1. 基本审计

```bash
helm-value-auditor audit values/base.yaml values/staging.yaml values/prod.yaml
```

输出终端摘要，显示每个被覆盖键的来源链。

### 2. 生成完整报告

```bash
helm-value-auditor audit values/*.yaml \
  --json audit-report.json \
  --html audit-report.html
```

生成机器可读的 JSON 和可分享的 HTML 报告。

### 3. 比较两个 values 文件

```bash
helm-value-auditor diff values/base.yaml values/prod.yaml
```

显示新增、删除、修改的键。

### 4. 包含坏文件的情况

```bash
helm-value-auditor audit base.yaml broken.yaml prod.yaml
```

坏文件会被标记 [ERROR]，并保留行号和原始内容位置。

## 报告位置和格式

### 终端输出
- 文件加载状态（OK/ERROR）
- 覆盖链显示（旧值 → 新值 @ 文件）
- 敏感键列表
- 解析错误详情（含行号和原始内容）

### JSON 报告 (`--json`)
完整的结构化数据，适合 CI/CD 集成：
```json
{
  "files_loaded": ["base.yaml", "prod.yaml"],
  "merged_values": {},
  "override_chains": [],
  "errors": []
}
```

### HTML 报告 (`--html`)
美观的网页报告，适合发给团队同事查看：
- 文件加载状态卡片
- 覆盖链可视化
- 敏感值高亮标记
- 错误详情展示

## 退出码说明

- `0` - 审计完成，所有文件解析成功
- `1` - 部分文件解析失败，或命令执行错误

## 敏感键自动识别

以下模式的键会被自动标记为敏感值，输出时遮蔽为 `********`：
- `password`
- `secret`
- `token`
- `api_key` / `apikey`
- `private_key`

## 示例数据

项目包含 `examples/values/` 目录的测试文件：

```bash
# 使用示例数据测试
helm-value-auditor audit examples/values/*.yaml --html sample-report.html
```

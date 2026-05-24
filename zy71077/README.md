# Jenkins 参数快照 CLI

离线保留每次 Jenkins 构建的输入参数和产物，解决流水线失败后参数页被下次构建覆盖的问题。

## 功能特性

- **参数归档**：保存构建参数、状态、触发人、Git 信息
- **产物校验**：检查产物文件完整性，记录缺失情况
- **差异比较**：对比两次构建的参数变化、类型变化、产物变化
- **重跑处理**：支持同一构建号多次重跑的快照变体
- **多格式输出**：
  - 终端彩色摘要
  - 机器可读 JSON
  - 给同事看的 Markdown 报告
- **稳定退出码**：便于脚本集成

## 安装

```bash
pip install -e .
```

## 快速开始

### 1. 归档构建记录

```bash
jenkins-snapshot archive examples/build_record_123.json --export-report
```

### 2. 查看已归档快照

```bash
jenkins-snapshot list
jenkins-snapshot list --job "MyApp/Build/Production"
```

### 3. 查看快照详情

```bash
jenkins-snapshot show "MyApp/Build/Production" 123
```

### 4. 比较两次构建差异

```bash
jenkins-snapshot diff "MyApp/Build/Production" 123 124 --export-report
```

### 5. 校验产物完整性

```bash
jenkins-snapshot validate "MyApp/Build/Production" 123 --artifact-base-dir ./artifacts
```

## 命令详解

### archive - 归档构建

```bash
jenkins-snapshot archive [OPTIONS] INPUT_FILE
```

**选项：**
- `-o, --output-dir TEXT`：输出目录（默认 ./snapshots）
- `--overwrite`：覆盖已存在的快照
- `--rerun-suffix TEXT`：为重跑创建变体快照
- `--copy-artifacts`：复制产物文件到快照目录
- `--artifact-base-dir TEXT`：产物文件的基础目录
- `--skip-validation`：跳过输入校验
- `--compare-with TEXT`：与指定构建号进行差异比较
- `--export-report`：导出 JSON 和 Markdown 报告

**示例：**
```bash
# 基本归档
jenkins-snapshot archive build.json

# 处理重跑（同一构建号多次执行）
jenkins-snapshot archive build.json --rerun-suffix retry_20240524

# 强制覆盖
jenkins-snapshot archive build.json --overwrite

# 归档时比较差异
jenkins-snapshot archive build.json --compare-with 122 --export-report
```

### list - 列出快照

```bash
jenkins-snapshot list [OPTIONS]
```

**选项：**
- `-j, --job TEXT`：只列出指定 Job
- `-f, --format [table|json|csv]`：输出格式

### show - 查看详情

```bash
jenkins-snapshot show [OPTIONS] JOB_NAME BUILD_NUMBER
```

**选项：**
- `--rerun-suffix TEXT`：查看重跑变体
- `--export-json PATH`：导出 JSON
- `--export-md PATH`：导出 Markdown

### diff - 比较差异

```bash
jenkins-snapshot diff [OPTIONS] JOB_NAME BUILD_OLD BUILD_NEW
```

比较两个快照的：
- 参数值变化
- 参数类型变化（重要！排查问题的关键）
- 产物新增/删除/修改
- 构建状态变化

### validate - 校验产物

```bash
jenkins-snapshot validate [OPTIONS] JOB_NAME BUILD_NUMBER
```

校验快照中记录的产物文件是否真实存在。

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 错误 |
| 2 | 警告（校验有警告但可继续） |
| 3 | 输入错误 |

## 快照目录结构

```
snapshots/
└── MyApp_Build_Production/
    └── build_123/
        ├── build_info.json      # 构建基本信息
        ├── parameters.json      # 参数列表
        ├── artifacts.json       # 产物清单
        ├── source_input.json    # 原始输入文件（保留）
        ├── snapshot_report.json # 完整快照报告
        ├── artifacts/           # （可选）复制的产物文件
        │   ├── app.tar.gz
        │   └── build.log
        └── rerun_20240524/      # （可选）重跑变体
            ├── build_info.json
            ├── parameters.json
            └── snapshot_report.json
```

## 典型使用场景

### 场景 1：构建失败后立即快照

```bash
# Jenkins 流水线失败时执行
curl -o build_${BUILD_NUMBER}.json ${JENKINS_URL}/job/${JOB_NAME}/${BUILD_NUMBER}/api/json
jenkins-snapshot archive build_${BUILD_NUMBER}.json --export-report
```

### 场景 2：排查重跑为何成功

```bash
# 第一次失败
jenkins-snapshot archive build_123_fail.json --rerun-suffix failed

# 重跑成功
jenkins-snapshot archive build_123_success.json --rerun-suffix success

# 比较同一构建号的两个重跑变体差异
jenkins-snapshot diff MyJob 123 123 --old-rerun-suffix failed --new-rerun-suffix success
```

### 场景 3：批量导出给同事排查

```bash
jenkins-snapshot show MyJob 123 --export-md failure_analysis_123.md
# 然后把 failure_analysis_123.md 发给同事
```

## 输入格式

支持的 Jenkins 构建记录 JSON 格式：

```json
{
  "job_name": "MyJob",
  "build_number": 123,
  "status": "FAILURE",
  "timestamp": 1716710400000,
  "triggered_by": "张三",
  "parameters": [
    {"name": "ENV", "value": "prod", "type": "CHOICE"}
  ],
  "artifacts": [
    {"name": "app.tar.gz", "path": "dist/app.tar.gz", "size": 15420000}
  ],
  "git_info": {
    "commit": "a1b2c3d4...",
    "branch": "main"
  }
}
```

也支持直接使用 Jenkins API 返回的原始 JSON 格式。

## 注意事项

1. **重复运行行为**：重复执行 `archive` 同一构建记录时，若快照已存在，会显示明确提示并跳过归档操作，不会修改已有文件。如需强制更新请使用 `--overwrite`，如需创建变体请使用 `--rerun-suffix`。

2. **重跑覆盖**：默认不允许覆盖，使用 `--rerun-suffix` 创建变体是推荐做法，可以保留同一构建号的多次执行记录。

3. **产物复制**：使用 `--copy-artifacts` 会复制文件到快照目录，注意磁盘空间。

4. **幂等性**：相同输入重复运行会产生相同结果（除非使用 `--overwrite`）。

5. **重跑变体比较**：使用 `--old-rerun-suffix` 和 `--new-rerun-suffix` 可以比较同一构建号的两个重跑快照差异，排查为什么第一次失败重跑就成功。

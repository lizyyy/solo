# Git LFS 迁移预检员

给开源仓库维护者用的本地命令行工具，用于在 Git LFS 迁移前进行全面检查和演练。

## 功能特性

- **scan**: 解析仓库清单（git rev-list、文件大小、.gitattributes、保护分支表）
- **plan**: 生成迁移 dry-run 计划
- **check**: 检测各类风险（大文件、规则冲突、路径大小写、受保护标签、回滚风险）
- **apply**: 在临时镜像中演练迁移并写审计日志
- **report**: 导出 Markdown、CSV 和 JSON 报告包

## 安装

```bash
# 安装依赖
pip install -e .

# 或使用开发模式
pip install -e ".[dev]"
```

## 快速开始

### 1. 扫描仓库

```bash
# 扫描当前目录
git-lfs-migrator scan

# 扫描指定目录
git-lfs-migrator scan /path/to/repo

# 输出 JSON 结果
git-lfs-migrator scan /path/to/repo --output-json scan_result.json
```

### 2. 生成迁移计划

```bash
# 生成默认计划（100KB 阈值）
git-lfs-migrator plan

# 自定义大文件阈值（200KB）
git-lfs-migrator plan --large-file-threshold 200

# 不包含历史记录
git-lfs-migrator plan --no-include-history
```

### 3. 执行风险检查

```bash
# 执行所有检查
git-lfs-migrator check

# 自定义阈值
git-lfs-migrator check --large-file-threshold 50

# 输出检查结果
git-lfs-migrator check --output-json check_result.json
```

### 4. 在沙箱中演练迁移

```bash
# Dry-run 模式（推荐）
git-lfs-migrator apply

# 实际演练（仅在沙箱中）
git-lfs-migrator apply --no-dry-run

# 包含标签
git-lfs-migrator apply --include-tags

# 保留沙箱目录以便检查
git-lfs-migrator apply --keep-sandbox

# 指定沙箱目录
git-lfs-migrator apply --sandbox-dir /tmp/my-sandbox
```

### 5. 生成完整报告

```bash
# 生成所有格式的报告
git-lfs-migrator report

# 指定输出目录
git-lfs-migrator report --output-dir ./my-report

# 只生成特定格式
git-lfs-migrator report --format markdown --format json
```

## 检查项说明

| 检查项 | 严重程度 | 说明 |
|--------|----------|------|
| 大文件未纳入 LFS | HIGH | 发现超过阈值的文件未用 LFS 管理 |
| 规则冲突 | HIGH | .gitattributes 中存在冲突的 LFS 规则 |
| 路径大小写冲突 | CRITICAL | 存在仅大小写不同的相同路径 |
| 受保护标签 | CRITICAL | 标签指向固定提交，迁移后引用会失效 |
| 回滚风险 | HIGH | 检测到难以回滚的场景 |
| 子模块引用 | MEDIUM | 子模块引用的提交哈希可能在迁移后失效 |
| 哈希冲突 | HIGH | 同一文件路径在历史中有不同哈希 |

## 临时目录验证流程

### 为什么需要沙箱演练？

Git LFS 迁移会**重写 Git 历史**，这是一个破坏性操作：
- 所有提交哈希会改变
- 标签引用会失效
- 回滚难度大
- 协作仓库需要所有协作者重新克隆

### 沙箱演练流程

```bash
# 1. 首先在沙箱中执行 dry-run
git-lfs-migrator apply --keep-sandbox

# 2. 检查沙箱目录
# 沙箱默认位置: /tmp/lfs-migrate-sandbox-xxxxxx
# 或查看输出中的 "沙箱目录"

# 3. 查看审计日志
cat /tmp/lfs-migrate-sandbox-xxxxxx/audit_log.json

# 4. 检查 Git 状态
cd /tmp/lfs-migrate-sandbox-xxxxxx
git status
git log --oneline -10
git lfs ls-files

# 5. 对比迁移前后
# 在沙箱中:
git rev-parse HEAD
# 在原仓库:
cd /original/repo
git rev-parse HEAD

# 6. 执行实际演练（仍在沙箱中）
git-lfs-migrator apply --no-dry-run --keep-sandbox --sandbox-dir /tmp/my-sandbox

# 7. 验证迁移结果
cd /tmp/my-sandbox
git lfs ls-files
git log --oneline -20

# 8. 检查所有引用
git show-ref
git tag -l
```

### 沙箱目录结构

```
/tmp/lfs-migrate-sandbox-<random-id>/
├── .git/                    # Git 仓库镜像
├── audit_log.json           # 审计日志（JSON 格式）
└── <working-tree-files>     # 检出的工作区
```

### 审计日志格式

```json
{
  "generated_at": "2026-05-02T10:00:00",
  "entries": [
    {
      "timestamp": "2026-05-02T10:00:00",
      "action": "git_command",
      "details": {
        "command": "git clone --mirror ...",
        "cwd": "/tmp"
      },
      "success": true,
      "error_message": null
    }
  ]
}
```

## 报告输出格式

### Markdown 报告 (`report.md`)

包含：
1. 仓库扫描摘要
2. 大文件列表
3. 风险检查结果
4. 迁移计划
5. 沙箱演练结果

### CSV 报告

- `file_sizes.csv` - 文件大小清单
- `issues.csv` - 问题列表
- `files_to_convert.csv` - 需要转换的文件
- `commands_executed.csv` - 执行的命令

### JSON 报告 (`report.json`)

包含所有数据的结构化 JSON 格式。

## 典型工作流程

```bash
# 1. 扫描仓库
git-lfs-migrator scan /path/to/repo

# 2. 检查风险
git-lfs-migrator check /path/to/repo

# 3. 生成计划
git-lfs-migrator plan /path/to/repo

# 4. 沙箱演练（关键步骤！）
git-lfs-migrator apply /path/to/repo --keep-sandbox

# 5. 验证沙箱结果
# ... 手动检查沙箱目录 ...

# 6. 生成完整报告
git-lfs-migrator report /path/to/repo --output-dir ./migration-report

# 7. 只有在所有演练都成功后，才在真实仓库执行迁移
# 注意：这是破坏性操作！
# git lfs migrate import --everything ...
```

## 回滚策略

### 演练中的回滚

沙箱演练可以随时丢弃：
```bash
# 删除沙箱目录
rm -rf /tmp/lfs-migrate-sandbox-xxxxxx
```

### 真实迁移后的回滚（困难）

1. **使用备份**：迁移前创建完整备份
   ```bash
   # 迁移前备份
   git clone --mirror /original/repo /backup/repo.git
   ```

2. **使用 reflog**（仅保留有限时间）
   ```bash
   git reflog
   git reset --hard HEAD@{1}
   ```

3. **使用 object-map**
   ```bash
   # 迁移时记录映射
   git lfs migrate import --object-map=./object-map.txt ...
   ```

## 配置示例

### 示例 .gitattributes

参见 `examples/sample_gitattributes`

### 示例保护分支表

参见 `examples/sample_protected_refs.txt`

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/

# 覆盖率测试
pytest --cov=git_lfs_migrator tests/
```

## 项目结构

```
git_lfs_migrator/
├── __init__.py
├── _version.py
├── cli.py              # CLI 入口
├── models.py           # 数据模型
├── git_data/           # Git 数据解析
│   ├── __init__.py
│   ├── parser.py
│   ├── rev_list.py
│   ├── file_sizes.py
│   ├── gitattributes.py
│   └── protected_refs.py
├── rules_engine/       # 规则引擎
│   ├── __init__.py
│   ├── engine.py
│   └── checker.py
├── plan/               # 迁移计划
│   ├── __init__.py
│   └── generator.py
├── sandbox/            # 演练沙箱
│   ├── __init__.py
│   └── sandbox.py
└── reporter/           # 报告生成
    ├── __init__.py
    └── generator.py

examples/               # 示例文件
tests/                  # 测试文件
```

## 注意事项

⚠️ **重要警告**：

1. **永远不要直接在生产仓库执行 `git lfs migrate`**，除非：
   - 已在沙箱中完整演练
   - 已创建完整备份
   - 所有协作者已通知

2. **标签处理**：
   - 标签指向固定提交
   - 迁移后标签指向的提交哈希不再存在
   - 建议：删除旧标签，迁移后重新打标签

3. **子模块处理**：
   - 子模块记录的是特定提交哈希
   - 子模块仓库迁移后，父仓库的引用会失效
   - 建议：先迁移子模块，再更新父仓库

4. **大小写敏感**：
   - macOS/Windows 默认大小写不敏感
   - Linux 区分大小写
   - 迁移前检查并修复大小写冲突

## License

MIT License

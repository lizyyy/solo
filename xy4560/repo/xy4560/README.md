# Delivery Inspector - 交付验收巡检器

一个用于外包项目交付验收的自动化巡检工具，帮助你验证 README 文档中的命令、端口、输出文件是否与实际配置一致。

## 功能特性

- 📝 **README 解析** - 自动提取文档中的 npm、pnpm、python、curl 等命令
- 🔍 **配置核对** - 与 package.json、pyproject.toml 实际脚本核对
- 🌐 **端口检查** - 验证文档描述的端口与实际监听是否一致
- 🔒 **安全执行** - 基于白名单执行命令，防止危险操作
- 📊 **数据存储** - 结果存入 SQLite，支持历史查询和误报标记
- 📄 **报告导出** - 生成 Markdown 验收报告和 JSON 明细

## 安装

```bash
cd /path/to/delivery-inspector
pip install -e .
```

或者

```bash
pip install markdown-it-py click rich
```

## 快速开始

### 1. 查看项目信息

先查看巡检器能从项目中提取哪些信息：

```bash
delivery-inspector info examples/normal_case
```

### 2. 执行检查

对项目进行完整的交付验收检查：

```bash
delivery-inspector inspect examples/normal_case
```

只进行静态检查，不实际执行命令：

```bash
delivery-inspector inspect examples/normal_case --no-execute
```

### 3. 查看历史记录

```bash
delivery-inspector history -p examples/normal_case
```

### 4. 导出报告

```bash
delivery-inspector export 1 -p examples/normal_case
```

## 示例项目验证

项目包含三个示例项目，分别演示三种典型场景：

### 场景一：正常情况 ✅

**项目位置**: `examples/normal_case`

**特点**: README 与实际配置完全匹配

**验证步骤**:

```bash
# 1. 查看信息
delivery-inspector info examples/normal_case

# 2. 执行检查
delivery-inspector inspect examples/normal_case

# 3. 查看生成的报告
cat examples/normal_case/.inspector/report_1.md
```

**预期结果**:
- 所有命令都能在 package.json 中找到
- 脚本执行成功，退出码为 0
- 生成预期的输出文件 (dist/index.js, dist/style.css)
- 报告状态为 "completed"，无问题发现

---

### 场景二：命令不存在 ❌

**项目位置**: `examples/missing_command_case`

**特点**: README 提到了 `npm run lint` 和 `npm run format`，但 package.json 中没有这两个脚本

**验证步骤**:

```bash
# 1. 查看信息（注意 lint 和 format 命令）
delivery-inspector info examples/missing_command_case

# 2. 执行检查
delivery-inspector inspect examples/missing_command_case

# 3. 查看问题报告
cat examples/missing_command_case/.inspector/report_1.md
```

**预期问题**:
- 配置核对会发现 `lint` 和 `format` 脚本不存在
- 问题类型: `script_not_found`
- 建议: "请检查 README 中的脚本名称是否正确，或在 package.json 中添加脚本"

---

### 场景三：端口不一致 ⚠️

**项目位置**: `examples/port_mismatch_case`

**特点**: README 说服务器运行在 **端口 8080**，但实际 server.js 监听 **端口 9000**

**验证步骤**:

```bash
# 1. 先安装依赖
cd examples/port_mismatch_case
npm install
cd ../..

# 2. 在后台启动服务器（实际监听 9000 端口）
cd examples/port_mismatch_case
node server.js &
SERVER_PID=$!
cd ../..

# 等待服务器启动
sleep 2

# 3. 执行检查（README 说的是 8080，但实际是 9000）
delivery-inspector inspect examples/port_mismatch_case

# 4. 停止服务器
kill $SERVER_PID
```

**预期问题**:
- 端口检查发现文档中提到的端口 8080 未在监听
- 同时可能发现未在文档中声明的监听端口 9000
- 问题类型: `port_not_listening` 和/或 `unexpected_port`

---

## 完整使用流程

### 1. 对项目进行检查

```bash
# 完整检查（执行命令）
delivery-inspector inspect /path/to/your/project

# 只静态检查，不执行命令
delivery-inspector inspect /path/to/your/project --no-execute
```

### 2. 查看检查结果

```bash
# 查看历史记录
delivery-inspector history -p /path/to/your/project

# 导出最新报告
delivery-inspector export -p /path/to/your/project
```

### 3. 处理误报

如果检查器标记了一个问题，但你认为这是误报：

```bash
# 标记特定问题为误报
delivery-inspector mark-false-positive 1 "这是预期行为，服务器端口是动态分配的" -p /path/to/your/project

# 或者标记所有问题为误报
delivery-inspector mark-false-positive 1 "全部为已知问题" -p /path/to/your/project
# 然后输入 'all'
```

### 4. 重新导出报告

标记误报后，重新导出报告：

```bash
delivery-inspector export 1 -p /path/to/your/project
```

## 安全白名单

为了安全执行命令，巡检器使用白名单机制：

### 允许的基础命令

```
npm, pnpm, yarn, python, python3, curl, wget, echo, ls, cat, node
```

### 允许的子命令

- **npm/pnpm/yarn**: install, run, test, start, build, check, lint
- **python/python3**: -m, -c
- **curl**: -s, -S, -I, -L, -o, -O, -X, -H, -d
- **wget**: -q, -O, -P

### 阻止的危险模式

```
rm -rf, sudo, && rm, > /dev/, eval(, exec(, bash -c, sh -c
```

## 输出文件结构

检查完成后，项目目录下会生成 `.inspector` 文件夹：

```
your-project/
├── .inspector/
│   ├── inspector.db          # SQLite 数据库（所有历史记录）
│   ├── report_1.md           # Markdown 报告
│   ├── report_1.json         # JSON 明细
│   ├── report_2.md           # 第二次检查的报告
│   └── report_2.json
```

## 命令参考

### inspect - 执行检查

```bash
delivery-inspector inspect <项目目录> [选项]
```

选项:
- `--no-execute`: 只静态检查，不执行命令
- `--output, -o`: 指定输出目录（默认: 项目目录/.inspector）

### info - 显示项目信息

```bash
delivery-inspector info <项目目录>
```

显示从 README 提取的命令、端口、预期文件，以及 package.json 中的可用脚本。

### history - 查看历史记录

```bash
delivery-inspector history [选项]
```

选项:
- `--project-dir, -p`: 项目目录路径
- `--limit, -n`: 显示最近 N 条记录（默认 10）

### export - 导出报告

```bash
delivery-inspector export [运行ID] [选项]
```

选项:
- `--project-dir, -p`: 项目目录路径
- `--output, -o`: 输出目录
- `--json/--no-json`: 是否导出 JSON（默认是）
- `--markdown/--no-markdown`: 是否导出 Markdown（默认是）

### mark-false-positive - 标记误报

```bash
delivery-inspector mark-false-positive <运行ID> <原因> [选项]
```

选项:
- `--project-dir, -p`: 项目目录路径
- `--marked-by, -u`: 标记人（默认 user）

## Markdown 报告格式

生成的报告包含以下部分：

1. **报告头部** - 项目目录、检查时间、状态
2. **检查摘要** - 命令执行统计、问题发现统计
3. **问题详情** - 按分类和严重程度列出所有问题
4. **命令执行记录** - 每个命令的执行详情、输出、新生成的文件
5. **报告信息** - 版本信息、生成时间

## 故障排除

### 问题: 命令执行失败

检查:
- 命令是否在安全白名单中
- 项目是否已安装依赖
- 退出码和错误输出

### 问题: 端口检查不准确

注意:
- 端口检查需要服务实际运行才能检测
- 检查器只检查 localhost 上的端口
- 某些服务启动可能需要时间

### 问题: SQLite 数据库错误

解决:
- 删除 `.inspector/inspector.db` 文件重新开始
- 确保有写入权限

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest
```

## 许可证

MIT License

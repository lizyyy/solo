# 重复文件定位命令行工具

## 项目概述

本工具用于检测直播样品表中的重复记录，并能识别字段被截断的异常情况。支持人工修正记录、历史查询过滤、多格式输出等功能。

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 编译TypeScript

```bash
npm run build
```

### 3. 初始化演示数据（添加人工修正记录）

```bash
node dist/cli.js init-demo
```

### 4. 执行重复检测

```bash
node dist/cli.js detect
```

### 5. 查看可用命令

```bash
node dist/cli.js --help
```

## 样例来源

本工具使用 `data/live_samples.json` 作为测试数据，包含以下特征：

- **数据来源**: 模拟跨天直播样品表
- **数据量**: 8条样品记录
- **批次信息**: 包含两个批次 BATCH20260501、BATCH20260502
- **故意构造的问题记录**: 
  - **SMP006**: 商品名称字段被截断（"运动跑鞋男款透气减"），完整名称应为"运动跑鞋男款透气减震防滑"
  - 多组重复商品：SMP001&SMP002、SMP004&SMP005、SMP006&SMP007

## 主流程

### 重复检测流程

1. **数据加载**: 从JSON文件读取直播样品数据
2. **多维检测**:
   - **商品ID匹配**: 相同productId的记录被标记为重复
   - **SKU匹配**: 相同sku的记录被标记为重复
   - **名称相似度匹配**: 使用编辑距离算法检测相似名称
   - **字段截断检测**: 检测被截断的字段（如商品名不完整）
3. **分组合并**: 将重叠的检测结果合并为重复组
4. **风险评估**: 根据匹配字段数量评估风险等级（高/中/低）
5. **输出报告**: 生成JSON和Markdown格式报告
6. **异常导出**: 自动导出截断等异常样本供人工复核
7. **历史记录**: 保存检测历史便于追溯

### 人工修正流程

1. 系统检测出重复或异常
2. 导出异常样本给同事复核
3. 人工确认后通过 `correct` 命令添加修正记录
4. 修正记录包含：操作人、备注、处理方式、来源、处理依据
5. **重要**: 人工修正仅作为备注附加，不直接覆盖系统判断

## 失败路径

### 1. 输入文件不存在

**现象**: 执行检测时报错 "ENOENT: no such file or directory"

**处理**: 
- 确认输入文件路径正确
- 使用 `-i` 参数指定正确的文件路径
- 确保JSON文件格式正确

### 2. JSON格式错误

**现象**: 执行检测时报错 "Unexpected token in JSON"

**处理**:
- 使用JSON校验工具检查文件格式
- 确保引号、逗号、括号匹配正确

### 3. 重复检测漏检

**现象**: 已知重复但未被检测到

**处理**:
- 检查匹配算法阈值是否过高
- 考虑添加更多匹配维度
- 通过人工修正方式标记

### 4. 字段截断误判

**现象**: 正常记录被误标为截断

**处理**:
- 调整截断检测逻辑的相似度阈值
- 通过人工修正标记为非截断
- 优化输入数据的规范性

## 命令详解

### detect - 重复检测

```bash
node dist/cli.js detect [选项]

选项:
  -i, --input <file>      输入JSON文件路径 (默认: "./data/live_samples.json")
  -f, --format <format>   输出格式: json|markdown|both (默认: "both")
  --no-system-judgment    不包含系统判断信息
  --no-corrections        不包含人工修正记录
  -o, --operator <name>   操作人名称 (默认: "system")
```

**示例**:
```bash
# 完整检测
node dist/cli.js detect

# 仅输出JSON格式
node dist/cli.js detect -f json

# 指定操作人
node dist/cli.js detect -o "李小明"
```

### correct - 添加人工修正

```bash
node dist/cli.js correct [必须选项]

选项:
  -b, --batch <batchId>    批次ID (必需)
  -g, --group <groupId>    重复组ID (必需)
  -i, --item <itemId>      样品ID (必需)
  -o, --operator <name>    操作人 (必需)
  -r, --remark <text>      修正备注 (必需)
  -a, --action <action>    处理方式: keep|merge|mark_non_duplicate|dismiss (必需)
  -s, --source <source>    来源 (必需)
  --basis <text>           处理依据 (必需)
```

**示例**:
```bash
node dist/cli.js correct \
  -b BATCH20260502 \
  -g GRP-DEMO001 \
  -i SMP006 \
  -o "张经理" \
  -r "经核对确认重复" \
  -a merge \
  -s "人工复核" \
  --basis "商品ID、SKU、价格完全一致"
```

### history - 查询检测历史

```bash
node dist/cli.js history [选项]

选项:
  -b, --batch <batchId>    按批次ID过滤
  -o, --operator <name>    按操作人过滤
  -r, --risk <type>        按风险类型过滤
```

**示例**:
```bash
# 查看所有历史
node dist/cli.js history

# 按批次过滤
node dist/cli.js history -b BATCH20260501

# 按操作人过滤
node dist/cli.js history -o "system"
```

### list-corrections - 列出人工修正

```bash
node dist/cli.js list-corrections [选项]

选项:
  -b, --batch <batchId>    按批次ID过滤
```

### export-anomalies - 导出异常样本

```bash
node dist/cli.js export-anomalies [选项]

选项:
  -i, --input <file>      输入JSON文件路径 (默认: "./data/live_samples.json")
```

## 输出文件说明

所有输出文件保存在 `output/` 目录：

- `detection_report_{timestamp}.json`: JSON格式完整报告
- `detection_report_{timestamp}.md`: Markdown格式可读报告
- `anomalies_{timestamp}.json`: 异常样本JSON
- `anomalies_{timestamp}.csv`: 异常样本CSV（便于Excel打开）

历史数据保存在 `data/` 目录：

- `detection_history.json`: 检测历史记录
- `manual_corrections.json`: 人工修正记录

## 项目结构

```
.
├── src/
│   ├── cli.ts              # 命令行入口
│   ├── types.ts            # 类型定义
│   ├── detector.ts         # 重复检测核心
│   ├── correctionManager.ts # 修正与历史管理
│   └── outputFormatter.ts  # 多格式输出
├── data/
│   ├── live_samples.json   # 测试数据
│   ├── detection_history.json
│   └── manual_corrections.json
├── output/                 # 输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## 开发模式

使用ts-node直接运行TypeScript（无需编译）：

```bash
npm run dev -- detect
npm run dev -- init-demo
```

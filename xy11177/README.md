# 校园宿舍维修队宿舍维修派单 CLI

专为校园宿舍维修队设计的派单系统，自动处理重复报修、急修单优先分配，生成完整派单报告。

## 功能特性

- **重复报修检测**：自动识别同一宿舍24小时内的重复报修
- **急修单优先**：优先级为 urgent 的报修单优先分配处理
- **可复跑输出**：支持断点续派，避免重复分配
- **清晰日志**：默认简洁输出，加 -v 参数显示详细处理过程
- **模块化设计**：解析、校验、派单、报告分离，易于维护

## 项目结构

```
.
├── src/
│   ├── index.js      # CLI 入口
│   ├── parser.js     # 数据解析模块
│   ├── validator.js  # 数据校验模块
│   ├── dispatcher.js # 派单逻辑模块
│   ├── reporter.js   # 报告生成模块
│   └── logger.js     # 日志系统
├── data/
│   └── repairs.json  # 报修样例数据
├── output/           # 输出目录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 步骤一：预览报修数据

先预览数据，查看问题清单，不实际派单：

```bash
npm run preview
```

或使用完整命令：

```bash
node src/index.js preview -i data/repairs.json
```

**输出内容**：
- 报修单总数
- 有效报修数量
- 重复报修列表
- 数据警告信息

如需查看详细处理日志：

```bash
node src/index.js preview -i data/repairs.json -v
```

### 3. 步骤二：正式执行派单

确认数据无误后，执行派单操作：

```bash
npm run dispatch
```

或使用完整命令：

```bash
node src/index.js dispatch -i data/repairs.json -o output/dispatch.json
```

**断点续派**：如需从已有派单结果恢复，避免重复派单：

```bash
node src/index.js dispatch -i data/repairs.json -o output/dispatch.json --resume
```

### 4. 步骤三：查看派单报告

派单完成后，生成完整派单报告：

```bash
npm run report
```

或使用完整命令：

```bash
node src/index.js report -i output/dispatch.json -o output/report.md -d data/repairs.json
```

报告内容包含：
- 处理概览统计表
- 重复报修清单
- 急修单优先处理列表
- 按维修类型、师傅、区域统计
- 完整派单明细表格
- 数据问题记录

## 命令参考

```bash
# 查看帮助
node src/index.js --help

# 预览命令
node src/index.js preview [options]

# 派单命令  
node src/index.js dispatch [options]

# 报告命令
node src/index.js report [options]
```

## 数据格式说明

报修单数据字段：

| 字段 | 说明 | 必填 |
|------|------|------|
| id | 报修单号 | 是 |
| dormNumber | 宿舍号 | 是 |
| repairType | 维修类型 | 是 |
| description | 问题描述 | 是 |
| reporter | 报修人 | 是 |
| reportTime | 报修时间 | 是 |
| contact | 联系电话 | 急修单必填 |
| area | 区域 | 否 |
| priority | 优先级(urgent/normal/low) | 否 |

## 重点问题处理机制

### 1. 重复报修

- 判定规则：同一宿舍24小时内相同类型报修
- 处理方式：自动排除，在报告中单独列出
- 样例数据包含2条重复报修，可在预览时查看效果

### 2. 急修插入

- 优先级为 urgent 的报修单优先分配
- 急修单必须填写联系方式，否则报错
- 派单列表中急修单排在最前面

### 3. 可复跑输出

- 使用 --resume 参数可从已有派单结果继续
- 自动检测已派单的报修，避免重复分配
- 确保多次执行命令结果一致

## 常见问题

**Q: 急修单派单报错？**
A: 检查急修单的 contact 字段是否填写，急修单必须有联系电话。

**Q: 如何查看详细的派单过程？**
A: 在任意命令后加 -v 参数，会输出详细的处理日志。

**Q: 派单后发现数据有误怎么办？**
A: 修改 repairs.json 后重新执行 dispatch 命令，或使用 --resume 增量派单。

## 维修师傅配置

当前配置的维修师傅及技能：

| 姓名 | 技能 | 负责区域 |
|------|------|----------|
| 张师傅 | 水电、空调 | 东区 |
| 李师傅 | 门窗、家具 | 西区 |
| 王师傅 | 卫浴、其他 | 南区 |
| 赵师傅 | 网络、水电 | 北区 |

可在 `src/dispatcher.js` 中修改配置。

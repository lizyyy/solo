# 排队论窗口配置系统

> 整合手算反例与问卷原始行，支持边界样本复核流程

## 功能特性

- 🎯 **负数样本检测**：自动检测负数样本，旧表标记为缺失的数据会高亮显示
- 📊 **双重视图展示**：支持图表视图和3D视图，点击样本可回溯原始数据
- 📝 **边界样本报告**：详细说明为什么留下、还缺什么材料、下一步该找谁
- 🔄 **复核流程管理**：学生助教 → 竞赛教练唐老师，逐级复核
- ⏱️ **现场因素计算**：午休、临时关窗、排队溢出都会影响等待时间计算
- 🎨 **多种入口**：命令行 CLI、Web 小看板、API 接口

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 一键运行完整演示

```bash
npm run dev demo
```

这会自动完成三步流程：
1. **第一次导入**：导入手算反例，检测负数样本被旧表当成缺失
2. **学生助教补录**：补充问卷原始行（现场说法）
3. **唐老师复核**：竞赛教练唐老师最终确认，生成边界样本报告

### 3. 查看完整命令列表

```bash
npm run dev -- --help
```

## 使用指南

### 数据导入

```bash
# 使用默认数据目录
npm run dev import

# 指定文件路径
npm run dev import -- -m ./data/manualCounterExamples.json -q ./data/questionnaireRows.json
```

**数据格式说明**：

- 手算反例（主流程证据）：`data/manualCounterExamples.json`
- 问卷原始行（现场说法）：`data/questionnaireRows.json`

### 生成边界样本报告

```bash
# 终端输出
npm run dev report

# 保存为文本文件
npm run dev report -- -o report.txt -f txt

# 保存为HTML报告
npm run dev report -- -o report.html -f html
```

**报告包含**：
- ✅ 为什么留下这条样本
- 📦 还缺什么材料
- ➡️ 下一步该找学生助教还是唐老师

### 复核流程

```bash
# 学生助教复核
npm run dev ta-review SAMPLE-001 -v true -n "已核实现场说法"

# 唐老师复核
npm run dev coach-review SAMPLE-001 -v true -n "情况属实，保留用于分析"
```

### 排队指标计算

```bash
# 计算指定窗口的排队指标
npm run dev calculate -- -w 1 -t 10:00 -a 15 -s 8
```

**考虑的现场因素**：
- 午休时间（默认12:00-13:00）
- 临时关窗
- 排队溢出

### 启动 Web 小看板

```bash
npm run dev web
# 或指定端口
npm run dev web -- -p 8080
```

打开浏览器访问 `http://localhost:3000`

**Web 功能**：
- 📊 图表视图：柱状图展示等待时间，红色标记负数样本
- 🎲 3D 视图：窗口排班现场可视化
- 🔍 点击回溯：点击样本查看手算反例和问卷原始行
- ✅ 在线复核：直接在页面进行学生助教和唐老师复核

## 三步完整流程示例

### 第一步：导入手算反例

```bash
npm run dev import -- -m ./data/manualCounterExamples.json
```

此时会检测到 3 个负数样本（SAMPLE-001、SAMPLE-002、SAMPLE-004），它们被旧表标记为缺失，状态为「待学生助教复核」。

### 第二步：学生助教补录问卷原始行

```bash
# 补录 SAMPLE-001 的现场说法
npm run dev ta-review SAMPLE-001 -v true -n "已核实现场说法" -q ./data/questionnaireRows.json

# 补录 SAMPLE-002 的现场说法
npm run dev ta-review SAMPLE-002 -v true -n "排队溢出情况属实" -q ./data/questionnaireRows.json
```

补录后，边界样本报告会自动更新：
- 缺失材料减少
- 为什么留下的说明更完整
- 状态变为「待唐老师复核」

### 第三步：唐老师最终确认

```bash
npm run dev coach-review SAMPLE-001 -v true -n "临时关窗情况确认，该样本保留用于窗口排班优化分析"
npm run dev coach-review SAMPLE-002 -v true -n "排队溢出情况属实，建议该时段增加窗口"
```

生成最终报告：

```bash
npm run dev report -- -o final-report.html -f html
```

## 项目结构

```
.
├── src/
│   ├── types/              # 数据类型定义
│   ├── core/               # 核心业务逻辑
│   │   ├── queueCalculator.ts      # 排队论算法
│   │   ├── boundarySampleManager.ts # 边界样本管理
│   │   ├── dataImporter.ts         # 数据导入
│   │   └── reportGenerator.ts      # 报告生成
│   ├── cli/                # 命令行入口
│   ├── web/                # Web 小看板
│   │   ├── server.ts
│   │   └── public/
│   ├── tests/              # 测试文件
│   └── utils/              # 工具函数
├── data/                   # 样例数据
│   ├── manualCounterExamples.json
│   └── questionnaireRows.json
└── README.md
```

## 核心概念

### 边界样本

负数样本被旧表当成缺失时，别急着归正常，留给学生助教复核。边界样本会保留：
- 手算反例（主流程证据）
- 问卷原始行（现场说法）
- 为什么留下的原因
- 还缺什么材料
- 下一步该找谁

### 复核流程

```
负数样本检测
    ↓
待学生助教（补录问卷原始行）
    ↓
待唐老师（最终确认）
    ↓
已确认（用于窗口排班优化）
```

### 排队论算法

**不只是算平均到达率**，还考虑：
- **午休影响**：窗口关闭，服务率降低 50%
- **临时关窗**：紧急事务处理，服务率降低 60-80%
- **排队溢出**：队伍排到门外，等待时间增加 30%

## API 接口

启动 Web 服务后可用：

- `GET /api/samples` - 获取所有边界样本
- `GET /api/samples/:id` - 获取单个样本详情
- `POST /api/samples/:id/ta-review` - 学生助教复核
- `POST /api/samples/:id/coach-review` - 唐老师复核
- `GET /api/report` - 获取报告数据
- `GET /api/windows` - 获取窗口配置

## 常见问题

**Q: 负数样本为什么不直接删除？**
A: 边界样本往往包含现场特殊情况（临时关窗、排队溢出等），保留下来可以优化窗口排班算法。

**Q: 旧表把负数当成缺失怎么办？**
A: 系统会自动标记，先让学生助教核实现场说法，再由唐老师最终确认。

**Q: 报告里的"为什么留下"是怎么来的？**
A: 系统根据主流程证据、现场说法、特殊情况自动分析生成。

**Q: 如何确定下一步该找谁？**
A: 缺材料找学生助教补，涉及特殊现场情况找唐老师确认。

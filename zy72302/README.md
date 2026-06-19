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

> ⚠️ **新人必看：npm 参数分隔符**  
> `npm run dev` 后面如果带参数（如 `-v`、`-n`、`-q`），**必须用 `--` 和 `npm run dev` 隔开**，否则 `-v` 会被 npm 当成 `--verbose` 吞掉，脚本收不到必填参数，只输出报错 `error: required option '-v, --verified <true|false>' not specified`。
>
> ✅ 正确：`npm run dev -- ta-review SAMPLE-001 -v true -n "备注"`  
> ❌ 错误：`npm run dev ta-review SAMPLE-001 -v true -n "备注"`（少了 `--`，参数全丢）

```bash
# 学生助教复核（补录问卷、验证通过）
npm run dev -- ta-review SAMPLE-001 -v true -n "已核实现场说法，窗口1在10:20-10:40临时关闭，实际等待15分钟" -q ./data/questionnaireRows.json
# 预期输出：状态 待学生助教复核 → 待竞赛教练唐老师复核，缺项数减少

# 唐老师复核（最终确认）
npm run dev -- coach-review SAMPLE-001 -v true -n "临时关窗情况确认，该样本保留用于窗口排班优化分析"
# 预期输出：状态 待唐老师 → 唐老师已确认，显示最终等待时间/到达人数/后续联系谁
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

## 三步完整流程示例（新人照抄即可，每一步都有预期输出对照）

> 📌 执行前建议先清空已有状态：`npm run dev -- reset --yes`，确保从零开始可复现

### 第一步：导入手算反例（检测负数样本，创建边界样本）

```bash
npm run dev -- import -m ./data/manualCounterExamples.json -q ./data/questionnaireRows.json
```

**✅ 预期输出（对照用，避免"只看到终端评估"）：**
```
=== 开始导入数据 ===
✓ 手算反例: 5 条
✓ 问卷原始行: 2 条

=== 检测负数样本 ===
检测到 3 个负数样本

✓ 创建/更新 3 个边界样本

  📌 SAMPLE-001 [缺1项]  状态: 待学生助教复核  负责人: 学生助教
  📌 SAMPLE-002 [缺1项]  状态: 待学生助教复核  负责人: 学生助教
  📌 SAMPLE-004 [缺2项]  状态: 待学生助教复核  负责人: 学生助教

┌────────┬────────────┬──────────┬────────┬────────┐
│ 总样本 │ 待学生助教 │ 待唐老师 │ 已确认 │ 已解决 │
├────────┼────────────┼──────────┼────────┼────────┤
│ 3      │ 3          │ 0        │ 0      │ 0      │
└────────┴────────────┴──────────┴────────┴────────┘
```

### 第二步：学生助教补录问卷原始行（先服务复核，不急着归正常）

```bash
# 补录 SAMPLE-001 的现场说法（窗口临时关窗）
npm run dev -- ta-review SAMPLE-001 -v true -n "已核实：窗口1在10:20-10:40临时关闭处理紧急事务，实际等待时间应为15分钟，有3位同学作证（问卷原始行已补录）" -q ./data/questionnaireRows.json

# 补录 SAMPLE-002 的现场说法（排队溢出）
npm run dev -- ta-review SAMPLE-002 -v true -n "已核实：下午2点窗口2排队溢出，队伍排到门外，系统统计时重复计数，实际到达25人、等待25分钟" -q ./data/questionnaireRows.json
```

**✅ SAMPLE-001 预期输出：**
```
=== 学生助教复核: SAMPLE-001 ===

✓ 已加载补充问卷原始行

✓ 复核完成
  样本ID: SAMPLE-001
  状态: 待竞赛教练唐老师复核      ← 关键变化
  缺项数: 0                       ← 关键变化（之前是1）
  下一步: find_ta
  负责人: 竞赛教练唐老师          ← 关键变化
```

**关键状态变化（同一条记录的字段，不是新生成的）：**
| 字段 | 补录前 | 补录后 |
|------|--------|--------|
| status | pending_ta（待助教） | pending_coach（待唐老师） |
| missingMaterials.length | 1 | 0 |
| questionnaireRow | 无 | 有现场说法+证人+修正值 |
| reviewLog.length | 1条（创建） | 2条（创建+助教补录） |

### 第三步：唐老师最终确认，报告更新（保留原始值，不提前归入正常）

```bash
# 唐老师确认 SAMPLE-001（临时关窗）
npm run dev -- coach-review SAMPLE-001 -v true -n "唐老师确认：临时关窗影响核实，建议该时段预留1个机动窗口，用于排班优化"

# 唐老师确认 SAMPLE-002（排队溢出）
npm run dev -- coach-review SAMPLE-002 -v true -n "唐老师确认：排队溢出属实，下午2点时段建议由2窗口增至3窗口，避免溢出"
```

**✅ SAMPLE-001 预期输出：**
```
=== 唐老师复核: SAMPLE-001 ===

✓ 复核完成
  样本ID: SAMPLE-001
  状态: 唐老师已确认                ← 关键变化
  最终等待时间: 15分钟               ← 原始 -5 被保留，这里是最终归档值
  最终到达人数: 15人
  后续联系: 竞赛教练唐老师（用于窗口排班优化）  ← 下一步找谁
  下一步: resolve
```

生成最终报告（HTML + TXT 双版本）：

```bash
# 文本版（终端直接看）
npm run dev -- report

# 导出为 HTML 报告
npm run dev -- report -o final-report.html -f html

# 导出为 TXT 报告
npm run dev -- report -o final-report.txt -f txt
```

**✅ 报告中 SAMPLE-001 会显示四块核心内容（都指向同一条记录）：**
1. 🔍 **原始负数 ↔ 修正后三列对比**（保留原始-5，不提前归正常）
2. 📝 **为什么留下 / 还缺什么 / 下一步找谁**
3. ✅ **最终处理结果**（唐老师+时间+原因+后续联系人）
4. 📜 **复核历史时间线**（创建→助教补录→唐老师确认，每条有操作员+备注+状态变迁）

### 一键验证脚本（新人推荐，跑完即证明全链路可用）

如果不想手动一步步跑，或想快速确认环境没问题，可以直接执行：

```bash
bash scripts/verify-readme-path.sh
# 或通过 npm
npm run verify:readme
```

**脚本会依次跑完：**
1. 先复现「旧写法不加 `--`」导致的参数丢失问题（证明确实有坑）
2. Step1 import（3 条负数样本，状态待助教）
3. 故意触发「样本不存在」+「状态不允许」两条边界样例，验证错误提示含总样本数+建议
4. Step2 助教补录 SAMPLE-001 / SAMPLE-002（问卷原始行），验证状态流转 + 缺项数降
5. Step3 唐老师复核，验证最终等待时间 / 到达人数 / 后续联系人
6. list 刷新、history 历史、report 终端、HTML/TXT 双版本导出
7. **最终 Node.js 读取状态文件断言：** 同一条 SAMPLE-001 的 10 个关键字段（originalNegativeValues / 修正后 / 问卷 / dataResolution / reviewLog / whyKept / missingMaterials）100% 对应

**跑成功会输出：**
```
🎉 全部断言通过！README 新人路径可用
  断言通过: 31
  断言失败: 0
```

**每次运行的详细日志（出错时查看）：** `data/verification-logs/` 目录下（每一步一个 step_xxx.log）

### 新人自检清单（跑完后逐条核对）

按三步流程执行后，以 **SAMPLE-001** 为主样本，逐项核对：

| 检查项 | 预期结果（与 SAMPLE-001 同一条记录） | 在什么地方看 |
|--------|-------------------------------------|--------------|
| **样本存在** | SAMPLE-001 存在，ID 不变 | `npm run dev -- list` 第 1 行 |
| **状态流转** | 待助教 → 待唐老师 → 唐老师已确认 | `npm run dev -- history SAMPLE-001` |
| **原始负数（保留）** | 等待时间 = **-5分钟**（永远不被覆盖） | 报告中「原始负数 ↔ 修正后对比」行 |
| **改后的值** | manualCounterExample.waitTime = **15分钟** | 报告中「手算反例」段 |
| **问卷现场说法** | actualWaitTime=15、证人=张三李四王五、临时关窗=是 | 报告中「问卷原始行」段 |
| **处理原因** | 助教/唐老师备注原文（含「README验证-」前缀） | 报告中「助教备注」「唐老师备注」 |
| **当前状态** | coach_verified（唐老师已确认） | list / 报告样本头 |
| **历史记录** | ≥ 3条：创建 + 助教 + 唐老师 | `npm run dev -- history SAMPLE-001` |
| **报告明细** | 四大区块齐备：Δ对比 + 为什么留下 + 最终结果 + 历史 | `npm run dev -- report` |
| **导出内容** | HTML/TXT 双版本都含「原始负数」字样 | `cat final-report.html \| grep "原始负数"` |

只要这 10 项对得上，就是**触发动作 → 处理判断 → 当前状态 → 历史 → 报告 → 导出**全链路接顺同一条记录了。

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

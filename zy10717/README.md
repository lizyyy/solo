# 标注任务导出返工拆包清理 CLI

> Annotation Export Rework Unpack & Cleanup Command Line Tool

专门处理标注任务导出文件，拆出返工包，避免重复分配，处理人员离职、包号重叠、抽检失败等复杂场景。

## 业务规则

| 规则 | 说明 | 输出标记 |
|------|------|----------|
| 拆出返工包 | 筛选 `needRework=true` 或 `status=NEED_REWORK/rejected` 的任务 | `needRework: true` |
| 避免重复分配 | 按 `taskId` 全局去重，防止同一任务多次分配 | 审计日志 `reason: duplicate` |
| 人员离职处理 | 根据 `activeAnnotators` 名单过滤离职人员任务 | 审计日志 `reason: annotator_left` |
| 包号重叠合并 | 跨文件的同一 `packageId` 任务合并标记 | `packageOverlap: true` |
| 抽检失败标记 | `inspectionFailed=true` 特殊标记，优先复核 | `inspectionFailed: true` |

## 目录结构

```
.
├── bin/
│   └── annotation-unpack.js    # CLI 入口
├── src/
│   ├── cli.js                  # 命令行处理
│   ├── unpack-engine.js        # 拆包核心引擎
│   └── report-generator.js     # 报告生成器
├── samples/
│   ├── input/                  # 样例输入数据（各种场景）
│   │   ├── batch-001-normal.json      # 正常返工任务
│   │   ├── batch-002-duplicates.json   # 含重复任务（去重测试）
│   │   ├── batch-003-left-annotator.json # 含离职人员（过滤测试）
│   │   ├── batch-004-overlap.json     # 包号重叠（合并测试）
│   │   ├── batch-005-inspection-failed.json # 抽检失败（标记测试）
│   │   └── batch-006-csv-format.csv   # CSV 格式支持
│   ├── active-annotators.json  # 活跃标注员名单
│   └── expected/               # 期望输出（验收用）
├── test/                       # 自动化测试
└── package.json
```

---

## 完整命令链（从样例输入到结果输出）

### 1. 验证文件格式

先验证输入文件是否有格式问题：

```bash
node bin/annotation-unpack.js validate samples/input/batch-001-normal.json
```

预期输出：
```
[验证通过] 文件格式正确
```

### 2. 基础拆包（不启用离职过滤）

最简单的拆包方式，只启用去重和重叠合并：

```bash
node bin/annotation-unpack.js unpack samples/input samples/output-basic
```

### 3. 完整业务规则拆包（启用离职过滤）

这就是标注任务导出返工拆包清理的完整流程！启用所有业务规则：

```bash
node bin/annotation-unpack.js unpack samples/input samples/output-full --annotator samples/active-annotators.json
```

**预期输出关键指标：**
```
[统计] 总任务数: 17
[统计] 返工任务数: 14
[统计] 去重排除数: 1     (TASK-001 在两个文件重复)
[统计] 离职排除数: 2     (钱七、周八不在活跃名单)
[统计] 重叠包合并数: 3   (PKG-2024-0501-A 跨两个文件)
[统计] 抽检失败数: 2     (赵六连续两个任务抽检失败)
```

### 4. 查看输出结果

进入输出目录查看生成的文件：

```bash
ls -la samples/output-full/
```

输出文件说明：
| 文件 | 说明 |
|------|------|
| `rework-packages.json/csv` | 按包分组的返工任务清单 |
| `reviewer-report.json/csv` | 按标注员统计的风险报告 |
| `audit-log.json/csv` | 审计日志（排除/合并记录） |
| `stats.json` | 统计指标和元数据（用于diff） |
| `SUMMARY.txt` | 人类可读的汇总报告 |
| `REVIEW-REPORT.txt` | 可复核的详细报告 |

### 5. 规则变更前后对比（Diff）

这就是标注任务导出返工拆包清理的核心能力！模拟规则变更前后的对比：

```bash
# 先运行一次不带离职过滤的
node bin/annotation-unpack.js unpack samples/input samples/run-v1 --format json

# 再运行一次带离职过滤的
node bin/annotation-unpack.js unpack samples/input samples/run-v2 --annotator samples/active-annotators.json --format json

# 对比两次结果
node bin/annotation-unpack.js diff samples/run-v1 samples/run-v2
```

预期会看到差异：
```
[发现差异] 两次拆包结果有 2 处差异
  这就是标注任务导出返工拆包清理的 diff 能力 - 规则变更、人员离职、包号重叠、抽检失败都能看清！

详细变更:
  [ANNOTATOR_LEFT] 离职排除数变化: 0 → 2 - 这就是标注任务导出返工拆包清理的人员离职场景！
  [TASK_COUNT] 总任务数变化: 13 → 11 (差: -2)
```

### 6. 禁用去重逻辑测试

```bash
node bin/annotation-unpack.js unpack samples/input samples/output-no-dedup --no-dedup
```

对比去重和不去重的差异：
```bash
node bin/annotation-unpack.js diff samples/output-full samples/output-no-dedup
```

---

## 验收标准

### 正常路径验收

运行完整流程后，检查以下输出：

1. **去重生效**：`stats.json` 中 `duplicateRemoved = 1`
2. **离职过滤生效**：`stats.json` 中 `leftAnnotatorRemoved = 2`
3. **重叠合并生效**：`stats.json` 中 `overlapMerged = 3`
4. **抽检失败标记**：`stats.json` 中 `inspectionFailed = 2`
5. **审计日志完整**：`audit-log.json` 包含所有排除/合并记录
6. **风险等级正确**：赵六因抽检失败标记为 `HIGH` 风险

### 异常路径验收

1. **输入目录不存在**：应该报错提示
   ```bash
   node bin/annotation-unpack.js unpack non-existent-dir output
   ```

2. **空目录输入**：应该报错提示没有文件
   ```bash
   mkdir -p empty-dir && node bin/annotation-unpack.js unpack empty-dir output
   ```

3. **格式错误文件**：validate 命令应该识别问题
   ```bash
   echo 'invalid json' > samples/bad.json && node bin/annotation-unpack.js validate samples/bad.json
   ```

---

## 样例字段说明

这就是标注任务导出返工拆包清理的标准字段！

**输入字段：**
| 字段 | 说明 | 示例 |
|------|------|------|
| `taskId` | 任务唯一ID | `TASK-001` |
| `packageId/batchId` | 包号/批次号 | `PKG-2024-0501-A` |
| `annotator` | 标注员姓名 | `张三` |
| `status` | 任务状态 | `NEED_REWORK` / `PASSED` / `rejected` |
| `quality` | 质量分数 | `65` |
| `needRework` | 是否需要返工 | `true` / `false` |
| `inspectionFailed` | 是否抽检失败 | `true` / `false` |

**输出新增字段：**
| 字段 | 说明 |
|------|------|
| `packageOverlap` | 任务属于跨文件重叠包 |
| `mergedFromSources` | 合并来源的文件名列表 |
| `sourceFile` | 原始来源文件 |
| `riskLevel` | 标注员风险等级 (`HIGH`/`MEDIUM`/`LOW`) |

---

## 运行自动化测试

```bash
npm test
```

---

## 快速体验

一键运行完整演示：

```bash
npm run demo
```

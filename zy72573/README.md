# 知识蒸馏温度试算工具

## 项目结构

```
.
├── models.py          # 核心数据模型定义
├── core.py            # 业务逻辑核心（导入、检测、计算、摘要生成）
├── cli.py             # 命令行入口
├── api.py             # API服务 + 小看板后端
├── dashboard.html     # 小看板前端页面
├── data/
│   └── demo/
│       ├── feature_snapshot.json  # 演示用特征快照（含默认值特征）
│       └── training_log.json      # 演示用训练日志曲线
└── demo_trial.json    # 运行demo后生成的完整试算记录
```

## 三种使用入口

### 1. 命令行（推荐日常使用）

```bash
# 查看帮助
python3 cli.py --help

# 运行完整演示（一键走完所有流程）
python3 cli.py demo
```

### 2. API + 小看板（可视化）

```bash
# 启动服务（默认端口8765）
python3 api.py

# 打开小看板
# 浏览器访问: http://localhost:8765/
```

### 3. API接口（程序化调用）

```bash
# 创建试算
curl -X POST http://localhost:8765/api/trial/create -d '{"output":"my_trial.json"}'

# 导入特征快照
curl -X POST http://localhost:8765/api/trial/import-snapshot \
  -H "Content-Type: application/json" \
  -d '{"trial_path":"my_trial.json","snapshot_file":"data/demo/feature_snapshot.json"}'
```

---

## 核心流程（三步法）

### 👉 步骤1：特征快照编号第一次导入
**目标**：导入特征，检测默认值，生成初始摘要

```bash
# 初始化
python3 cli.py init --output my_trial.json

# 导入特征快照
python3 cli.py import --trial my_trial.json --file data/demo/feature_snapshot.json
```

**关键设计**：
- 自动检测 `is_default=true` 的特征
- 检测到默认值特征时：**结论明确写"暂不可直接照抄"**
- 标注"线上特征缺失但给了默认分，需推荐负责人复核，不归入正常"
- 下一步自动提示：找推荐负责人复核缺失特征

---

### 👉 步骤2：推荐策略老唐补看训练日志曲线
**目标**：补录训练日志，摘要自动更新

```bash
# 补录训练日志
python3 cli.py add-log --trial my_trial.json --file data/demo/training_log.json
```

**关键设计**：
- 补录日志后自动重新生成摘要（版本号+1）
- 置信度从 `low` 提升到 `medium`
- 摘要中增加训练日志相关信息（记录点数、最新步准确率等）
- 缺失材料列表自动移除"训练日志曲线"

---

### 👉 步骤3：可解释摘要更新（人工修正 + 重跑）
**目标**：人工介入调整，最终确认温度

```bash
# 人工修正（推荐策略老唐）
python3 cli.py correct --trial my_trial.json \
  --corrections teacher_confidence=0.92 \
  --by "推荐策略老唐" \
  --reason "回看训练日志后发现教师模型实际置信度更高"

# 重跑验证
python3 cli.py rerun --trial my_trial.json --note "人工修正后重跑验证"
```

**关键设计**：
- 每次修正/重跑都会生成新版本摘要
- 完整保留操作记录（谁在什么时候改了什么、为什么改）
- 最终仍保留默认值特征提示，提醒需推荐负责人最终复核

---

## 可解释摘要包含什么

| 字段 | 说明 |
|------|------|
| `conclusion` | 人话总结，明确说结论能不能直接用 |
| `next_action` | 下一步该找谁（推荐负责人/推荐策略老唐） |
| `confidence` | 置信度等级（low/medium/high） |
| `default_features` | 使用默认值的特征列表 |
| `missing_materials` | 还缺什么材料 |
| `notes` | 逐条备注，解释为什么留下这条记录 |
| `temperature_result` | 推荐的蒸馏温度 |

---

## 演示数据说明

`data/demo/` 目录下包含真实可跑的演示数据：

1. **feature_snapshot.json**
   - 5个特征
   - 其中 `user_ctr_7d` 和 `item_heat_score` 使用默认值（模拟线上特征缺失）
   - 每个特征带行号、来源信息

2. **training_log.json**
   - 8个训练记录点（step 100 ~ 800）
   - 包含 loss、temperature、accuracy 三条曲线数据
   - 准确率从 0.42 收敛到 0.93

运行 `python3 cli.py demo` 会生成完整的 `demo_trial.json`，包含：
- 1份特征快照
- 1份训练日志
- 1次人工修正
- 1次重跑
- 4个版本的可解释摘要

---

## 复盘与重跑

### 查看完整记录
```bash
# 查看状态
python3 cli.py status --trial demo_trial.json

# 查看最新摘要
python3 cli.py summary --trial demo_trial.json

# 查看所有版本摘要
python3 cli.py summary --trial demo_trial.json --all

# 查看指定版本
python3 cli.py summary --trial demo_trial.json --version 2
```

### 完整可复现命令（复制粘贴即用）
```bash
# === 第一步：初始化 ===
python3 cli.py init --output demo_trial.json

# === 第二步：导入特征快照 ===
python3 cli.py import --trial demo_trial.json \
  --file data/demo/feature_snapshot.json

# === 第三步：补录训练日志（推荐策略老唐操作）===
python3 cli.py add-log --trial demo_trial.json \
  --file data/demo/training_log.json

# === 第四步：人工修正（推荐策略老唐操作）===
python3 cli.py correct --trial demo_trial.json \
  --corrections teacher_confidence=0.92 \
  --by "推荐策略老唐" \
  --reason "回看训练日志后发现教师模型实际置信度更高"

# === 第五步：重跑验证 ===
python3 cli.py rerun --trial demo_trial.json \
  --note "人工修正后重跑验证"

# === 查看最终结果 ===
python3 cli.py status --trial demo_trial.json
python3 cli.py summary --trial demo_trial.json --verbose
```

---

## 关键细节提醒

1. **默认值特征不归正常**：只要检测到 `is_default=true`，即使补了训练日志、做了修正，摘要里始终会标注"结论暂不可直接照抄"，强制要求推荐负责人最终复核。

2. **摘要版本自动演进**：每一步操作（导入/补录/修正/重跑）都会生成新版本摘要，完整留痕。

3. **明确找人**：`next_action` 字段明确说下一步该找"推荐负责人"还是"推荐策略老唐"，不模糊。

4. **小而真的演示数据**：演示数据就是真实业务场景的缩小版，推荐策略老唐可以直接拿给新人讲流程。

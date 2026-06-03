# 多臂老虎机活动分流 - 演示项目

竞赛教练唐老师给新人培训专用，包含完整的复盘流程和可重跑命令。

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 一键完整演示（推荐给新人）
```bash
python scripts/correction_flow.py
```

### 分别运行三种模式
```bash
# 正常材料 - 新公式
python scripts/run_bandit.py --mode normal --run-id normal_run

# 错口径材料 - 误用新公式
python scripts/run_bandit.py --mode wrong --run-id wrong_run

# 补录材料 - 应用旧公式
python scripts/run_bandit.py --mode corrected --run-id corrected_run
```

### 查看历史记录
```bash
python scripts/run_bandit.py --show-history normal_run
python scripts/run_bandit.py --show-history wrong_run
python scripts/run_bandit.py --show-history corrected_run
```

## 演示数据说明（三条记录）

| 记录ID | 类型 | 点击率格式 | 处理方式 |
|--------|------|------------|----------|
| REC_001 | 顺利记录 | 小数 (0.12) | 正常流程 |
| REC_002 | 格式混合 | 百分数 (8.5%) | 留待活动负责人复核 |
| REC_003 | 旧口径补录 | 小数 (0.15) | 根据唐老师批注应用旧公式 |

## 三步完整流程

### 步骤1: 旧公式截图第一次导入
- 导入 demo_records.json
- 检测到 REC_002 百分数格式问题
- 全部记录默认使用新公式（汤普森采样）

### 步骤2: 竞赛教练唐老师补看老师批注
- 查看 teacher_notes.md
- 发现 REC_003 应使用旧公式
- 应用人工修正
- REC_002 格式问题**不自动处理**，留给活动负责人

### 步骤3: 计算明细更新（重跑）
- 根据批注重新计算
- REC_003 应用旧公式: `score = CTR * 0.8 + 0.1`
- 保存完整历史记录

## 目录结构

```
.
├── bandit_calculator.py      # 核心计算模块
├── config.py                 # 配置文件
├── requirements.txt          # 依赖
├── data/
│   ├── demo_records.json     # 演示数据
│   └── teacher_notes.md      # 唐老师批注文档
├── docs/
│   └── old_formula_screenshot.md  # 旧公式截图说明
├── scripts/
│   ├── run_bandit.py         # 单模式运行脚本
│   └── correction_flow.py    # 完整流程演示脚本
└── results/
    └── history/              # 历史运行记录（JSON格式）
```

## 查看计算明细和历史记录

所有运行结果保存在 `results/history/` 目录下，包含：
- 完整计算过程
- 人工修正日志
- 公式使用记录
- 时间戳

## 关键设计点

1. **百分数和小数混合检测** - 发现格式问题但不自动修正
2. **新旧公式双轨制** - 支持同时存在两种计算方式
3. **人工修正留痕** - 所有修改都有操作人记录
4. **完整历史回放** - 每一步都可复盘

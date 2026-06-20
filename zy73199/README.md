# 优化调参参数回放

数学题草稿调参回放工具 —— 把学生草稿里导致同一题被多个版本答案覆盖的记录捋顺。

## 快速开始（老叶看这里）

第一步：初始化示例数据并自动回放

```bash
python main.py init
```

第二步：查看所有记录概览

```bash
python main.py list
```

第三步：看某条记录的详细计算过程

```bash
python main.py detail <记录ID>
```

第四步：对比两组参数的差异

```bash
python main.py compare <记录A> <记录B>
```

## 目录结构

```
.
├── main.py                  # 主程序入口
├── README.md               # 本文档
├── core/
│   ├── models.py           # 数据模型（记录、参数、计算步骤）
│   ├── replay_engine.py    # 回放引擎（公式、单位、阈值校验）
│   ├── draft_manager.py    # 草稿管理器（版本防覆盖）
│   └── persistence.py      # 持久化（JSON存取、CSV导出）
├── data/
│   ├── sample_data.py      # 示例数据生成器
│   └── replay_records.json # 持久化数据（运行init后生成）
├── output/                 # CSV导出目录
│   └── replay_summary.csv  # 汇总CSV（运行init后生成）
└── utils/
    └── unit_converter.py   # 单位换算工具
```

## 支持题型

| 题型ID前缀 | 公式 | 参数 |
|---|---|---|
| speed_ | v = s / t | 距离、时间 |
| density_ | ρ = m / V | 质量、体积 |
| area_ | S = a × b | 长度、宽度 |
| kinetic_ | Ek = ½ × m × v² | 质量、速度 |

## 记录状态说明

| 状态 | 说明 |
|---|---|
| 草稿 | 新建未计算 |
| 计算成功 | 正常完成 |
| 公式错误 | 公式或参数有问题 |
| 单位缺失 | 有参数缺少单位，无法完整计算 |
| 超阈值 | 计算结果超出合理阈值 |
| 边界样本 | 边界测试用例（单独标记） |

## 命令速查

| 命令 | 作用 | CSV输出 |
|---|---|---|
| `python main.py init` | 初始化示例数据+回放 | output/replay_summary.csv |
| `python main.py list` | 列出所有记录 | - |
| `python main.py list --status=单位缺失` | 筛选单位缺失的记录 | - |
| `python main.py detail <记录ID>` | 查看详情+计算步骤 | output/<id>_detail.csv |
| `python main.py compare <A> <B>` | 对比两条记录 | output/*_comparison.csv |
| `python main.py replay --all` | 全部重新回放 | - |
| `python main.py remark <ID> "内容"` | 添加备注 | - |
| `python main.py filter --unit-missing` | 筛选单位缺失 | - |
| `python main.py filter --boundary` | 筛选边界样本 | - |
| `python main.py stats` | 统计概览 | - |
| `python main.py verify` | 验证CSV与数据一致性 | - |

## 关键设计

### 1. 版本防覆盖
同一题目允许多个版本共存，每个版本有独立的 `v1`、`v2`... 版本号，记录ID形如 `speed_001_v2_xxxx`。新草稿不会覆盖旧版本。

### 2. 失败分类不消失
算不出的记录保留并标注失败原因：
- **公式错误** —— 公式或参数逻辑问题（除零、缺参数等）
- **单位缺失** —— 有参数缺少单位，第一步单位检查就卡住
- **超阈值** —— 结果超出合理范围（速度>300m/s、面积>100万m²等）

### 3. 边界样本
草稿试跑时特意放入一条边界样本（`area_002` 操场面积题），面积接近阈值上限，用来验证校验逻辑。边界样本单独标记，不会被"--no-boundary"筛掉时也能看到。

### 4. 单位缺失追溯
- 筛选：`filter --unit-missing` 直接列出
- 详情：`detail` 命令显示缺了哪些参数的单位
- 导出：每条明细CSV里都有"单位完整性检查"步骤，写明缺失单位的参数

### 5. 双参数对照
`compare` 命令逐条对比：
- 参数差异（数值+单位）
- 每一步计算结果的差异
- 最终结果的绝对差和相对差
- 中间的单位换算过程不藏，都在步骤里

### 6. 历史备注持久化
- 备注存在JSON里，重启不丢
- 每条备注自动带时间戳
- `verify` 命令可验证当前状态与CSV明细是否一致

## CSV明细文件说明

运行 `init` 后，`output/` 目录下会有：

- **replay_summary.csv** —— 所有记录的汇总表，一眼看清状态分布
- 运行 `detail` 后会生成 `*_detail.csv` —— 单条记录的完整明细，含基本信息、参数列表、每步计算、备注

## 交接清单

就像现场会收到的材料：
1. `README.md` —— 看这个知道怎么跑
2. `output/replay_summary.csv` —— 汇总明细，先看这个了解全貌
3. `data/replay_records.json` —— 原始数据，重启后自动加载
4. 运行 `detail` 生成的单条明细CSV —— 复核时追溯用

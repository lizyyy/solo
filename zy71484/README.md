# 游泳划水推进分析系统

## 快速开始（新人照着做）

### 第一步：运行样例数据

```bash
# 最简单的运行方式
python -m swim_analysis.cli --sample

# 带池长验证（检测池长输入错误）
python -m swim_analysis.cli --sample --known-pool-length 50.0

# 启用自动修正（速度尖峰）
python -m swim_analysis.cli --sample --known-pool-length 50.0 --auto-correct

# 保存结果到文件
python -m swim_analysis.cli --sample --known-pool-length 50.0 --output result.json --level 4
```

### 第二步：看哪里

运行完命令后，按以下顺序查看：

| 输出层级 | 看什么 | 怎么看 |
|---------|--------|--------|
| **Level 1** | 总体摘要 | 先看「低效率段落」和「警告信息」，快速定位问题 |
| **Level 2** | 段落列表 | 查看每趟的速度、频率、步幅，对比相邻段落变化 |
| **Level 3** | 单段详情 | 点进低效率段落，查看具体原因和代表性数据点 |
| **Level 4** | 逐点数据 | 查看每个采样点的原始数据和完整计算过程 |

## 核心功能

### 1. 公式透明不藏起来

所有计算逻辑都在代码中，公式集中展示在输出的 `formulas_reference` 中：

**运动学公式** (`[kinematics.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/kinematics.py)`)
- 速度: `v = Δx / Δt` [m/s]
- 划水频率: `f = Δstroke / Δt × 60` [次/分钟]
- 划水步幅: `SL = v / (f/60)` [m/次]

**阻力估算公式** (`[resistance.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/resistance.py)`)
- 被动阻力: `D_passive = 0.5 × ρ × v² × Cd × A` [N]
- 主动阻力: `D_active = D_passive × K` [N]
- 推进功率: `P = D_active × v` [W]

**效率计算公式** (`[efficiency.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/efficiency.py)`)
- 划水效率: `η_stroke = (v × SL) / W`
- 整体效率: `η_overall = η_stroke × (1/K)`

### 2. 边界情况处理并保留证据

**池长错误检测** (`[data_validation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/data_validation.py#L101)`)
- 检测：比较输入池长与已知池长
- 保留：原始值、预期值、差异、影响说明
- 修正：需人工确认，不自动覆盖

**速度尖峰检测** (`[data_validation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/data_validation.py#L130)`)
- 检测：3σ 原则，超出均值±3倍标准差
- 保留：z-score、相邻5个点的值、dt和dx
- 修正：可选 `--auto-correct`，用相邻点均值替换

**划水次数漏记** (`[data_validation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/data_validation.py#L187)`)
- 检测：超过池长/最慢速度的时间无新增划水
- 保留：当前次数、已持续时间、预期次数
- 修正：需人工补充，所有修改留痕

### 3. 线索归并到同一件事

**段落划分** (`[segmentation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/segmentation.py)`)
- 基于转身点（位置极值+速度最低点）自动划分单趟
- 每个段落有唯一ID，关联所有相关线索
- 线索类型：速度尖峰、低效率、划水漏记、数据丢失等

**段落对比** (`[segmentation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/segmentation.py#L368)`)
- 自动对比相邻段落的速度、频率、步幅、效率
- 变化超过10%自动标注
- 每一项对比都保留证据链接

### 4. 从摘要到明细不断链

**四层输出结构** (`[output_formatter.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/output_formatter.py)`)

```
Level 1: 总体摘要
    ↓ (点击 low_efficiency_segment 的 detail_ref)
Level 2: 段落列表 → 段落对比
    ↓ (点击 segment_id 的 detail_ref)
Level 3: 单段详情 → 线索详情 → 代表性数据点
    ↓ (点击 raw_data_ref)
Level 4: 逐点数据 → 原始数据 + 计算过程 + 公式
```

**证据链索引** 在输出的 `evidence_chain` 中：
- 数据溯源：原始数据哈希、版本历史
- 段落追溯索引：每段的摘要、详情、原始数据位置
- 线索追溯索引：每条线索的所属段落、数据点、证据来源
- 低效率段落追溯：低效率区的索引范围、原因分析

## 分析流程

```
输入数据 → 数据验证（保留证据）→ 运动学分析 → 阻力估算
                                        ↓
                 输出格式化 ← 段落划分 ← 效率计算
```

## 输入数据格式

```json
{
  "athlete_name": "张三",
  "stroke_style": "自由泳",
  "pool_length": 50.0,
  "sample_rate": 10.0,
  "athlete_height": 1.80,
  "athlete_weight": 72.0,
  "time": [0.0, 0.1, 0.2, ...],
  "position": [0.0, 0.17, 0.35, ...],
  "stroke_count": [0, 0, 0, ...]
}
```

## 常用命令

```bash
# 1. 快速验证数据（只看问题）
python -m swim_analysis.cli --input data.json --known-pool-length 50.0 --level 1

# 2. 完整分析并保存
python -m swim_analysis.cli --input data.json --known-pool-length 50.0 --output result.json --level 4

# 3. 生成样例数据文件
python -m swim_analysis.sample_data

# 4. 用生成的样例数据文件分析
python -m swim_analysis.cli --input sample_data.json --known-pool-length 50.0 --auto-correct
```

## 模块索引

| 模块 | 功能 | 关键文件 |
|------|------|----------|
| 运动学分析 | 速度、加速度、划水频率、步幅 | [kinematics.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/kinematics.py) |
| 阻力估算 | 被动阻力、主动阻力、推进功率 | [resistance.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/resistance.py) |
| 效率计算 | 划水效率、整体效率、低效率段落识别 | [efficiency.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/efficiency.py) |
| 数据验证 | 池长、速度尖峰、划水漏记检测 | [data_validation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/data_validation.py) |
| 段落划分 | 转身点检测、段落划分、线索关联 | [segmentation.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/segmentation.py) |
| 输出格式化 | 四层输出、证据链、追溯链接 | [output_formatter.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/output_formatter.py) |
| CLI入口 | 命令行接口、流程编排 | [cli.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/cli.py) |
| 样例数据 | 带异常的测试数据生成 | [sample_data.py](file:///Users/lzy/pro/solo/workspaces/zy71484/swim_analysis/sample_data.py) |

## 交接要点

1. **别只看结论**：每个数字都能追溯到原始数据点和计算过程
2. **先看警告**：`data_validation_issues` 列出所有数据质量问题
3. **版本控制**：`version_history` 记录所有修改（自动/人工）和操作人
4. **低效率段**：查看 `low_efficiency_segments`，每个都有原因分析和证据链接
5. **对比思路**：段落对比看 `comparisons`，相邻段变化超过10%会自动标注

## 下一步能做什么

- 导入自己的数据（参考输入格式）
- 调整阻力参数（在 `resistance.py` 的 `STROKE_RESISTANCE_PARAMS`）
- 接入视频分析（将视频帧时间戳与数据点索引关联）
- 批量对比多名运动员数据（用效率指数 EI 做跨人对比）

# 港口泊位排队模拟系统

基于 M/M/c 排队模型的港口泊位排队模拟工具，专为运营分析师设计。

## 功能特点

- ✅ **M/M/c 排队模型算法** - 多服务台排队系统精确计算
- ✅ **数据验证** - 自动检测空值、重复项、边界值
- ✅ **结果追溯** - 每条记录可追查到来源，算不出来的记录留下原因
- ✅ **例外处理** - 异常记录保留在统计中，不悄悄消失
- ✅ **筛选功能** - 屏幕和导出文件口径一致
- ✅ **多口径支持** - 新口径/旧口径(课堂讲义历史版本)

## 项目结构

```
.
├── core/                    # 核心模块
│   ├── __init__.py
│   ├── queue_model.py       # M/M/c排队模型算法
│   ├── data_validator.py    # 数据验证模块
│   └── result_tracker.py    # 结果追溯系统
├── cli/                     # 命令行界面
│   ├── __init__.py
│   └── main.py             # CLI主程序
├── data/                    # 数据目录
│   └── sample.csv          # 示例数据
└── README.md
```

## 快速开始

### 1. 基本使用

```bash
# 运行模拟
python -m cli.main -i data/sample.csv

# 导出结果
python -m cli.main -i data/sample.csv -o results.csv
```

### 2. 查看公式/单位/边界值

```bash
python -m cli.main --formulas    # 查看M/M/c模型公式
python -m cli.main --units       # 查看单位说明
python -m cli.main --boundaries  # 查看边界值参考
```

### 3. 筛选功能

```bash
# 只看计算成功的记录
python -m cli.main -i data/sample.csv --filter status=success

# 只看需要人工审核的记录
python -m cli.main -i data/sample.csv --filter review=True

# 只看旧口径计算的记录
python -m cli.main -i data/sample.csv --filter legacy=True
```

### 4. 追溯功能

```bash
# 查看单条记录的完整追溯
python -m cli.main -i data/sample.csv --trace REC001

# 导出完整追溯信息到JSON
python -m cli.main -i data/sample.csv --trace-export trace.json
```

## 输入数据格式 (CSV)

| 字段 | 说明 | 必填 |
|------|------|------|
| record_id | 记录唯一标识 | 是 |
| arrival_rate | 到达率 λ (艘/小时) | 是 |
| service_rate | 服务率 μ (艘/小时) | 是 |
| num_servers | 泊位数量 c | 是 |
| source | 数据来源说明 | 是 |
| legacy_mode | 是否使用旧口径 | 否 |
| notes | 人工备注 | 否 |

## M/M/c 排队模型公式

| 符号 | 公式 | 说明 | 单位 |
|------|------|------|------|
| ρ | λ / (c * μ) | 服务强度 | 无量纲 |
| P0 | 见代码 | 系统空闲概率 | 概率 |
| Lq | 见代码 | 排队等待的平均船舶数 | 艘 |
| L | Lq + λ/μ | 系统中的平均船舶数 | 艘 |
| Wq | Lq / λ | 平均排队等待时间 | 小时 |
| W | Wq + 1/μ | 系统平均逗留时间 | 小时 |
| P_wait | 见代码 | 需要等待的概率 | 概率 |

## 边界值说明

| 参数 | 最小值 | 最大值 | 说明 |
|------|--------|--------|------|
| arrival_rate | 0.1 | 100.0 | 艘/小时 |
| service_rate | 0.1 | 50.0 | 艘/小时 |
| num_servers | 1 | 50 | 泊位数量 |
| rho | - | 0.95 | 服务强度稳定上限 |

## 示例数据说明

示例文件 `data/sample.csv` 包含以下测试用例：

| 记录ID | 类型 | 说明 |
|--------|------|------|
| REC001 | 顺利记录 | 正常工况，计算成功 |
| REC002 | 人工确认 | 服务强度接近上限 |
| REC003 | 旧口径 | 课堂讲义历史版本算法 |
| REC004 | 空值测试 | 到达率为空 |
| REC005 | 越界测试 | 服务率为负 |
| REC006 | 重复参数 | 与REC001参数相同 |
| REC007 | 边界记录 | 最小值边界 |
| REC008 | 边界记录 | 接近经验范围上限 |
| REC009 | 系统不稳定 | ρ >= 1 |

## 输出结果说明

每条结果包含：
- 计算状态（成功/失败）
- 完整的计算指标（ρ, P0, Lq, L, Wq, W, P_wait）
- 是否需要人工审核
- 是否使用旧口径计算
- 失败原因（如失败）
- 数据来源追溯

## 注意事项

1. 异常记录会保留在统计中，不会被过滤掉
2. 换筛选条件后，屏幕显示和导出文件口径一致
3. 每条记录都可追溯到原始数据源
4. 旧口径结果会标记"需人工确认"，建议用新口径复核

# 社区篮球联赛积分排行 CLI

面向社区篮球联赛的专业积分排行计算工具，支持数据校验、申诉改判和可复跑对照输出。

## 功能特性

### 模块化架构
- **解析模块**: CSV格式比赛数据和申诉改判数据解析
- **校验模块**: 数据合法性校验、脏数据检测
- **排行计算**: 胜场积分计算、多级同分规则处理
- **报告生成**: 多格式输出、分离报告便于复核

### 核心功能
1. **积分排行计算**: 按组别自动计算球队排名
2. **同分规则**: 积分 > 净胜分 > 总得分 > 相互对战结果
3. **申诉改判**: 支持比分改判、弃权判定等多种改判类型
4. **可复跑对照**: 改判前后排名对比，便于后续复核
5. **数据校验**: 重复ID、空值、异常值检测
6. **多格式输出**: CSV、Markdown、JSON

## 项目结构

```
basketball_league/
├── cli/
│   └── ranking_cli.py          # CLI入口
├── src/
│   ├── parser/
│   │   └── data_parser.py      # 数据解析模块
│   ├── validator/
│   │   └── data_validator.py   # 数据校验模块
│   ├── ranking/
│   │   └── ranking_calculator.py # 排行计算模块
│   └── reporter/
│       └── report_generator.py # 报告生成模块
├── data/
│   ├── samples/                # 样例数据
│   │   ├── games_normal.csv    # 正常输入样例
│   │   ├── games_dirty.csv     # 脏数据输入样例
│   │   ├── games_rerun.csv     # 重跑对照样例
│   │   └── appeals_rerun.csv   # 申诉改判样例
│   └── output/                 # 输出目录
├── tests/                      # 测试目录
├── requirements.txt            # 依赖包
└── README.md
```

## 安装使用

### 安装依赖
```bash
cd basketball_league
pip install -r requirements.txt
```

### 命令说明

#### 1. 计算积分排行
```bash
python cli/ranking_cli.py calculate <比赛数据文件> [选项]

选项:
  --appeals, -a   申诉改判数据文件
  --output, -o    输出目录 (默认: ./data/output)
  --skip-validation  跳过数据校验
```

示例：
```bash
# 正常计算
python cli/ranking_cli.py calculate data/samples/games_normal.csv

# 带申诉改判计算
python cli/ranking_cli.py calculate data/samples/games_rerun.csv -a data/samples/appeals_rerun.csv
```

#### 2. 数据校验
```bash
python cli/ranking_cli.py validate <比赛数据文件>

示例:
python cli/ranking_cli.py validate data/samples/games_dirty.csv
```

#### 3. 申诉改判重跑
```bash
python cli/ranking_cli.py rerun <比赛数据文件> <申诉改判文件>

示例:
python cli/ranking_cli.py rerun data/samples/games_rerun.csv data/samples/appeals_rerun.csv
```

#### 4. 查看样例说明
```bash
python cli/ranking_cli.py samples
```

## 输出报告说明

### 正常结果报告
- `积分排行_正常_<时间戳>.csv` - 完整积分排行数据表
- `积分排行_正常_<时间戳>.md` - Markdown格式排行报表

### 申诉改判报告
- `积分排行_申诉改判后_<时间戳>.csv/.md` - 改判后的积分排行
- `申诉改判记录_<时间戳>.csv` - 所有申诉改判明细
- `排名变动详情_<时间戳>.csv` - 改判导致的排名变动
- `重跑对照报告_<时间戳>.md` - 改判前后排名对比表

### 其他报告
- `同分规则详情_<时间戳>.csv/.json` - 同分判定详细记录
- `数据校验结果_<时间戳>.csv` - 数据校验错误和警告
- `数据解析错误_<时间戳>.csv` - CSV解析过程中的错误

## 业务字段说明

### 比赛数据字段
| 字段 | 说明 | 示例 |
|------|------|------|
| 比赛ID | 唯一标识 | G001 |
| 主队 | 主场球队名称 | 阳光社区 |
| 客队 | 客场球队名称 | 幸福社区 |
| 主队得分 | 主队终场得分 | 78 |
| 客队得分 | 客队终场得分 | 72 |
| 比赛日期 | 比赛日期 | 2024-04-01 |
| 轮次 | 比赛轮次 | 1 |
| 组别 | 参赛组别 | 社区甲组 |

### 申诉改判字段
| 字段 | 说明 | 示例 |
|------|------|------|
| 比赛ID | 对应比赛 | G006 |
| 改判类型 | 改判类别 | 比分改判 |
| 原主队得分 | 改判前得分 | 68 |
| 原客队得分 | 改判前得分 | 70 |
| 新主队得分 | 改判后得分 | 70 |
| 新客队得分 | 改判后得分 | 68 |
| 改判原因 | 改判说明 | 计时错误 |
| 改判日期 | 改判日期 | 2024-04-18 |

### 积分排行字段
| 字段 | 说明 |
|------|------|
| 组别 | 球队所属组别 |
| 排名 | 当前排名 |
| 球队名称 | 球队名称 |
| 场次 | 参赛场次 |
| 胜 | 胜场数 |
| 负 | 负场数 |
| 积分 | 累计积分（胜2分，负1分） |
| 得分 | 总得分 |
| 失分 | 总失分 |
| 净胜分 | 得分减失分 |

## 同分规则优先级

1. **积分相同** → 比较净胜分
2. **净胜分相同** → 比较总得分
3. **总得分相同** → 比较相互对战战绩
4. **仍相同** → 记入同分规则详情报告

## 支持的组别

- 社区甲组
- 社区乙组
- 社区丙组
- 公开组
- 中年组
- 青年组

## 数据校验规则

### 错误级别（致命问题）
- 比赛ID为空或重复
- 主队或客队名称为空
- 主队与客队为同一球队
- 得分为负数
- 轮次为0或负数

### 警告级别（需关注）
- 双方得分均为0（可能弃权）
- 得分超过200（异常高分）
- 日期格式不规范
- 未知组别名称
- 球队参赛场次不一致
- 相同球队对战超过2次

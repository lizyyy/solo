# 骑行俱乐部补给站排布 CLI

基于爬升、天气和参与者水平智能规划长距离骑行活动的补给站。

## 安装运行

```bash
# 安装依赖
pip install -e .

# 或使用 python -m
python -m bike_supply_cli.cli --help
```

## 样例入口

```bash
# 1. 初始化样例数据
bike-supply init

# 2. 检查样例路线
bike-supply check samples/route_sample.json

# 3. 导入并计算（中级水平，20人，25°C）
bike-supply import samples/route_sample.json --level intermediate --count 20 --temp 25 -e
```

## 核心操作

| 命令 | 说明 |
|------|------|
| `bike-supply init` | 初始化目录和样例 |
| `bike-supply import <file>` | 导入路线并规划补给站 |
| `bike-supply check <file>` | 检查路线数据 |
| `bike-supply history` | 查看运行历史 |
| `bike-supply export` | 导出结果 |

### import 参数

```bash
bike-supply import route.json \
  --level beginner      # 参与者水平: beginner/intermediate/advanced
  --count 30            # 参与人数
  --speed 18            # 平均速度 km/h
  --temp 32             # 气温 °C
  --humidity 70         # 湿度 %
  --force               # 强制重算
  --export              # 立即导出
```

### export 参数

```bash
bike-supply export -f json -f csv        # 指定格式
bike-supply export -f all                 # 全部格式
bike-supply export -r run_abc12345        # 指定 Run ID
```

## 检查结果

```bash
# 查看历史记录
bike-supply history

# 查看某次运行详情
bike-supply history -r <run_id>

# 导出文件位置
bike_supply_cli/exports/
  ├── <run_id>_supply_plan.json
  ├── <run_id>_supply_plan.csv
  └── <run_id>_report.txt
```

## 重跑行为

- 相同路线 + 相同设置 → 返回缓存结果，**不产生新记录**
- 相同路线 + 不同设置 → 新记录，旧记录被清理
- 使用 `--force` 强制重新计算

# 仓储货架承重热区

## 功能入口

- **命令行 (CLI)**: `python -m warehouse_heat_zone <command>`
- **API接口**: FastAPI - `uvicorn warehouse_heat_zone.api:app --reload`
- **小看板**: Flask - `python -m warehouse_heat_zone.dashboard`

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 一键运行完整演示（推荐）
python run_demo.py

# 或单独运行内置演示
python -m warehouse_heat_zone demo

# 启动小看板查看结果
python -m warehouse_heat_zone.dashboard
```

## 核心三步流程

1. **坐标原点说明导入** - 确定仓库基准坐标
2. **补看巡检照片编号** - 培训教官老梁核查照片，遇移动端截图遮挡则留待复核
3. **安全距离报告更新** - 补录后重跑，生成最新报告

## 命令行命令

```bash
# 导入坐标原点
python -m warehouse_heat_zone import-origin --file <json文件>

# 添加货架
python -m warehouse_heat_zone add-shelf --code A-01 --x 10 --y 5 --max-load 1000 --current-load 400 --origin-id origin_warehouse_a

# 创建批次
python -m warehouse_heat_zone new-batch --batch-id BATCH-001

# 处理巡检记录
python -m warehouse_heat_zone process --shelf-code A-01 --origin-id origin_warehouse_a --photo-number P001
python -m warehouse_heat_zone process --shelf-code A-02 --origin-id origin_warehouse_a --mobile-blocked

# 补录照片编号
python -m warehouse_heat_zone supplement --record-id <记录ID> --photo-number P002
python -m warehouse_heat_zone supplement --record-id <记录ID> --photo-number OLD-P003 --old-calibration

# 人工修正
python -m warehouse_heat_zone correct --record-id <记录ID> --status normal --note "复核通过"

# 重跑分析
python -m warehouse_heat_zone rerun --record-id <记录ID>

# 生成报告
python -m warehouse_heat_zone report --batch-id BATCH-001

# 查看所有记录
python -m warehouse_heat_zone list
```

## 演示数据说明

- **顺利记录** (A-01): 承重40%，低风险，安全距离0.8m
- **截图遮挡记录** (A-02): 承重75%，高风险，告警标签被移动端截图遮挡 → 待施工经理复核
- **旧口径记录** (A-03): 从历史照片编号补录，标记为旧口径

## 项目结构

```
warehouse_heat_zone/
├── __init__.py       # 包入口
├── models.py         # 数据模型定义
├── processor.py      # 核心处理逻辑
├── cli.py            # 命令行接口
├── api.py            # REST API接口
└── dashboard.py      # 小看板界面
```

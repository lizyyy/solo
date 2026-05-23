# 充电桩巡检异常回执状态机服务

## 功能概述

本服务用于处理充电桩巡检异常回执的状态流转，支持：

- **多源数据接入**：桩端告警、巡检表、客服投诉单、临时补录单
- **状态机管理**：工单从创建到归档的完整生命周期
- **数据持久化**：所有操作落库，重启不丢失
- **幂等处理**：支持忽略、覆盖、追加三种重复批次策略
- **审计追踪**：完整记录操作人和操作时间
- **异步任务**：失败重试、人工介入、永久失败三种状态
- **汇总导出**：片区经理视角的冻结前后状态对比

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动API服务

```bash
python -m app.main api --host 0.0.0.0 --port 8000
```

### CLI命令行

```bash
# 查看帮助
python -m app.main --help

# 创建批次
python -m app.main batch create --source pile_alarm --file data.json --strategy ignore

# 导出汇总
python -m app.main export summary --area 南山片区 --output report.xlsx
```

## API文档

启动服务后访问：http://localhost:8000/docs

## 状态流转

```
待处理 → 处理中 → 待复核 → 已复核 → 冻结结算 → 归档
           ↓         ↓
         撤回      驳回
           ↘     ↙
           待处理
```

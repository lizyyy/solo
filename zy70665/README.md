# 保养配件替代件库存预演排查CLI

基于车型、保养项目、配件库存、替代件关系进行库存预演和缺口排查的命令行工具。

## 功能特性

- 支持多车型年款配件匹配
- 替代件智能匹配规则
- 库存扣减预演计算
- 缺口数量分级预警
- 备件报告生成
- 坏行来源追踪

## 安装

```bash
pip install -e .
```

## 使用示例

```bash
mparts run \
  --models data/models.csv \
  --maintenance data/maintenance.csv \
  --inventory data/inventory.csv \
  --alternatives data/alternatives.csv \
  --output report/
```

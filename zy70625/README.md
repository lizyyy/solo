# 检录资格替补递补材料校验排查CLI

小型赛事检录资格校验工具，支持证件材料校验、组别限制、替补递补、重复检录拦截、报告导出等功能。

## 功能特性

- **选手信息管理**：支持CSV/Excel格式导入选手报名信息
- **证件材料校验**：检查身份证、照片、健康证明等材料完整性
- **组别限制检查**：验证年龄、性别、报名资格等组别限制
- **替补递补机制**：自动处理替补选手资格递补
- **重复检录拦截**：防止同一选手重复检录
- **来源追踪**：坏行保留原文件位置，结果稳定可追溯
- **报告导出**：支持HTML/Excel格式导出资格校验报告

## 安装

```bash
pip install -e .
```

## 使用方法

```bash
checkin-cli validate \
  --players examples/players.csv \
  --groups examples/groups.csv \
  --materials examples/materials.csv \
  --substitutes examples/substitutes.csv \
  --checkins examples/checkins.csv \
  --output report.html
```

## 输入文件格式

详见 examples/ 目录下的示例文件。

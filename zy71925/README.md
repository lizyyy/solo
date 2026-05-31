# 拍卖图录校对系统

> 专门解决拍卖图录校对中"作品清单和展墙图对不上、修改没留痕、时间长了就乱"的问题。

## ✨ 核心特性

### 📋 完整的工作流程
- **导入**：支持 Excel/CSV 格式的作品清单和展墙图
- **校对**：自动比对两边数据，标出差异和冲突
- **复核**：人工确认、标记待补充、解决差异
- **历史**：所有操作留痕，可追溯每一次修改
- **导出**：多种格式输出，给策展人、灯光师、设计师都能用

### 💡 灯光方案智能追踪
- **不会自动覆盖**：作品清单和展墙图的灯光方案不一致时，两边值都保留
- **来源明确**：清楚显示每个灯光方案来自作品清单还是展墙图
- **下一步指引**：冲突时直接告诉你该找谁确认（策展人？灯光师？）

### 😊 人性化设计
- **不说行话**：所有提示都是人话，没有技术字段名
- **分类展示**：给策展人的布展清单按"已确认/待补/人工改过"分开
- **处理口径**：每条记录都标明能不能直接用，还是需要注意什么

## 🚀 快速开始

### 1. 一键看演示
直接运行完整流程，看看产出是什么样的：

```bash
python3 run_demo.py
```

生成的文件都在 `demo_output/` 目录里，建议先打开 `*_报告.html` 看效果。

### 2. 用自己的数据

```bash
# 先生成模板文件看看格式
python3 -m auction_catalog_proof init

# 然后把自己的数据填进去，执行校对
python3 -m auction_catalog_proof proof 你的作品清单.csv 你的展墙图.csv
```

## 📖 常用命令

### 校对数据
```bash
# 基本用法
python3 -m auction_catalog_proof proof works.csv wall.csv

# 指定会话名称和输出目录
python3 -m auction_catalog_proof proof works.csv wall.csv --name "2026春拍" --output-dir output/
```

### 解决差异
```bash
# 查看当前状态
python3 -m auction_catalog_proof status session.json

# 采用作品清单的值
python3 -m auction_catalog_proof resolve session.json LOT001_title_cn --use-works-list

# 采用展墙图的值
python3 -m auction_catalog_proof resolve session.json LOT001_title_cn --use-wall-layout

# 手动输入新值
python3 -m auction_catalog_proof resolve session.json LOT001_title_cn --custom "正确的名称"
```

### 处理灯光冲突
```bash
# 采用作品清单的灯光要求
python3 -m auction_catalog_proof resolve-lighting session.json LOT001 --use-works-list

# 采用展墙图的现场方案
python3 -m auction_catalog_proof resolve-lighting session.json LOT001 --use-wall-layout
```

### 确认和标记
```bash
# 确认某件作品没问题
python3 -m auction_catalog_proof confirm session.json LOT001 LOT002

# 批量确认所有
python3 -m auction_catalog_proof confirm session.json --all

# 标记某件需要策展人补充信息
python3 -m auction_catalog_proof needs-info session.json LOT003 "需要确认作者款识"
```

### 查看和导出
```bash
# 看操作历史
python3 -m auction_catalog_proof history session.json

# 重新导出所有报告
python3 -m auction_catalog_proof export session.json

# 只导出布展清单
python3 -m auction_catalog_proof export session.json --type exhibition
```

## 📁 文件说明

```
auction_catalog_proof/
├── __init__.py          # 包入口
├── __main__.py          # 命令行入口
├── models.py            # 数据模型定义
├── messages.py          # 人性化消息体系（所有中文提示都在这）
├── data_import.py       # 数据导入模块
├── proof_engine.py      # 校对引擎，比对和处理逻辑
├── report_generator.py  # HTML报告生成器
├── exporter.py          # 各种格式导出
└── cli.py               # 命令行接口
```

## 📊 输出文件说明

### HTML 报告 (`*_报告.html`)
- **校对概览**：统计卡片一目了然
- **布展清单**：给策展人看的，按展墙分组，含处理口径
  - ✅ 已确认：可直接使用
  - ⚠️ 待处理：需要校对
  - 🔴 待补充：需要策展人确认
  - 🟣 人工修改：已调整，请注意核对
- **差异详情**：每一处差异都有两边值对比和处理建议
- **灯光方案追踪**：所有冲突都标明来源和下一步找谁
- **操作历史**：完整的修改留痕

### 布展清单 (`*_布展清单.csv`)
给现场布展用的，含：
- 展墙位置和顺序
- 灯光方案及来源
- 校对状态和处理口径
- 人工修改标记

### 校对后数据
- `*_校对后_作品清单.csv`：可以直接用于出图录
- `*_校对后_展墙图.csv`：可以直接给布展团队
- `*_校对摘要.json`：给程序用的结构化数据

## 🎯 设计理念

### 为什么不自动合并？
因为艺术行业的特殊情况：
- 作品清单是策展人定的，可能有学术要求
- 展墙图是现场量的，可能受物理条件限制
- **两边都有可能是对的**，不能简单取一边

所以我们的做法是：
1. 把差异列出来让人看
2. 标明每处差异的严重程度
3. 给处理建议（找谁确认）
4. 人工决定后留痕

### 为什么灯光方案特殊处理？
灯光是最容易出问题的环节：
- 策展人在清单里写了特殊要求
- 现场设计师可能没注意就覆盖了
- 出了问题两边都不认

所以我们：
- **永远不自动覆盖**
- 始终显示两边的值
- 冲突时明确说清下一步找谁
- 最终决定后记录是谁拍的板

## 📝 数据格式要求

### 作品清单（Excel/CSV）
必需列：`拍品编号`、`作品名称`
可选列：艺术家、年代、材质、尺寸、估价、来源、文献、展览、备注、灯光

### 展墙图（Excel/CSV）
必需列：`展墙编号`、`拍品编号`
可选列：展墙名称、X坐标、Y坐标、宽度、高度、灯光、顺序、备注

## 🔧 系统要求
- Python 3.7+
- 无需安装任何依赖（纯标准库就能跑）
- 要读 Excel 的话装一下 openpyxl：`pip install openpyxl`

## 📄 License
MIT

---

> 做给一线同事用的工具，不炫技，不折腾，解决问题就行。

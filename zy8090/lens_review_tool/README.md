# 配镜加工单复核工具

本地优先的配镜加工单复核桌面工具，基于 Python/Tkinter 开发。

## 功能特性

- 导入验光处方 CSV、镜架参数 JSON、加工中心扫码 JSONL 和公差规则 YAML
- 按订单查看左右眼度数、散光轴位、瞳距、镜架尺寸是否匹配
- 复核状态标记：待复核 / 可交付 / 需返工
- 边界处理：左右眼字段缺失、重复扫码、缺少终检
- 复核备注和状态用 SQLite 留痕
- 导出 Markdown / CSV 报告

## 依赖

- Python 3.8+
- tkinter (标准库)
- PyYAML

安装依赖：

```bash
pip install pyyaml
```

## 项目结构

```
lens_review_tool/
├── app.py                  # 主程序入口 (Tkinter UI)
├── database.py             # SQLite 数据库操作
├── data_loader.py          # 数据加载器 (CSV/JSON/JSONL/YAML)
├── validator.py            # 验光数据校验逻辑
├── SPEC.md                 # 规格说明
├── README.md               # 本文件
├── sample_data/
│   ├── prescription.csv    # 验光处方样例
│   ├── frame.json          # 镜架参数样例
│   ├── scan.jsonl          # 加工扫码样例 (含重复扫码)
│   └── tolerance_rules.yaml # 公差规则样例
└── data/
    └── reviews.db          # SQLite 数据库文件 (自动生成)
```

## 演示命令

使用 sample_data 跑通主流程的演示：

```bash
cd lens_review_tool
python app.py
```

在 GUI 中：
1. 点击菜单「文件 → 导入数据...」
2. 选择 `sample_data` 文件夹
3. 在左侧订单列表中选择一个订单（如 ORD001）
4. 切换到「复核操作」标签页，查看自动检测问题
5. 选择状态（待复核/可交付/需返工），填写备注，点击「保存复核」
6. 点击菜单「文件 → 导出Markdown报告」或「导出CSV报告」

## 示例数据说明

- `prescription.csv`: 8 条验光处方，包含正常数据、散光缺失、左右眼缺失等边界情况
- `scan.jsonl`: 10 条扫码记录（ORD001 和 ORD006 各有重复扫码），包含缺少终检的情况
- `tolerance_rules.yaml`: 公差规则

## 数据文件格式

### prescription.csv

| 字段 | 说明 |
|------|------|
| order_id | 订单编号 |
| patient_name | 患者姓名 |
| right_sph | 右眼球镜 (SPH) |
| right_cyl | 右眼柱镜 (CYL) |
| right_axis | 右眼散光轴位 (AXIS) |
| left_sph | 左眼球镜 |
| left_cyl | 左眼柱镜 |
| left_axis | 左眼散光轴位 |
| pupil_distance | 瞳距 (PD) |
| right_add | 右眼下加 (ADD, 可选) |
| left_add | 左眼下加 (ADD, 可选) |

### frame.json

```json
{
  "order_id": "ORD001",
  "frame_model": "GM-2024",
  "frame_width": 52,
  "bridge_width": 18,
  "temple_length": 145,
  "lens_type": "单焦点"
}
```

### scan.jsonl

```json
{"order_id":"ORD001","scan_time":"2026-05-01T09:00:00","right_sph":-2.00,"right_cyl":-0.75,"right_axis":180,"left_sph":-1.75,"left_cyl":-0.50,"left_axis":175,"pupil_distance":63,"inspection_passed":true,"final_inspection":true}
```

### tolerance_rules.yaml

```yaml
sph_tolerance: 0.25
cyl_tolerance: 0.25
axis_tolerance: 5
pd_tolerance: 2
frame_width_tolerance: 2
bridge_width_tolerance: 2
temple_length_tolerance: 3
```

## 数据库 Schema

SQLite 数据库 `data/reviews.db` 表 `reviews`:

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 自增主键 |
| order_id | TEXT | 订单编号 (唯一) |
| status | TEXT | 复核状态 |
| review_time | TEXT | 复核时间 (ISO 格式) |
| notes | TEXT | 复核备注 |
| issues | TEXT | 问题列表 (逗号分隔) |

## 快捷键

- `Ctrl+O`: 导入数据
- `Ctrl+S`: 保存当前订单复核
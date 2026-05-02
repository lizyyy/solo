# 配镜加工单复核工具规格说明

## 项目概述
- **项目名称**: lens_review_tool
- **类型**: 本地优先桌面工具 (Python/Tkinter)
- **核心功能**: 导入验光处方 CSV、镜架参数 JSON、加工中心扫码 JSONL 和公差规则 YAML，按订单复核左右眼度数、散光轴位、瞳距、镜架尺寸是否匹配，标记状态（待复核/可交付/需返工），复核记录用 SQLite 留痕，支持导出 Markdown/CSV 报告。
- **目标用户**: 眼镜店店员

---

## 数据文件规格

### 1. 验光处方 CSV (`prescription.csv`)
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

### 2. 镜架参数 JSON (`frame.json`)
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

### 3. 加工中心扫码 JSONL (`scan.jsonl`)
```json
{"order_id":"ORD001","scan_time":"2026-05-01T09:00:00","right_sph":-2.00,"right_cyl":-0.75,"right_axis":180,"left_sph":-1.75,"left_cyl":-0.50,"left_axis":175,"pupil_distance":63,"inspection_passed":true,"final_inspection":true}
```

### 4. 公差规则 YAML (`tolerance_rules.yaml`)
```yaml
sph_tolerance: 0.25
cyl_tolerance: 0.25
axis_tolerance: 5
pd_tolerance: 2
frame_width_tolerance: 2
bridge_width_tolerance: 2
temple_length_tolerance: 3
```

---

## 复核状态定义

| 状态 | 含义 |
|------|------|
| 待复核 | 数据已导入，尚未完成复核 |
| 可交付 | 所有字段匹配公差，终检通过 |
| 需返工 | 存在度数偏差超差/缺少终检/瞳距偏差/字段缺失 |

---

## 边界处理

1. **左右眼字段缺失**: 验光处方缺少右眼或左眼数据时，标记为"字段缺失"，状态"需返工"
2. **重复扫码**: 同一订单_id 在 scan.jsonl 中出现多次，复核列表中仅保留最后一条，并标记"重复扫码"警告
3. **缺少终检**: scan 记录中 `final_inspection` 字段为 false，状态置为"需返工"
4. **数据不匹配**: 验光处方与扫码数据偏差超公差，列出具体偏差字段

---

## 数据库 Schema (SQLite)

### 表: reviews
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PRIMARY KEY | 自增 ID |
| order_id | TEXT | 订单编号 |
| status | TEXT | 待复核/可交付/需返工 |
| review_time | TEXT | 复核时间 ISO 格式 |
| notes | TEXT | 复核备注 |
| issues | TEXT | 具体问题 JSON 列表 |

---

## 导出报告格式

### Markdown 报告
```markdown
# 配镜加工单复核报告
生成时间: 2026-05-01T10:00:00

## 汇总
- 待复核: 5
- 可交付: 8
- 需返工: 2

## 订单明细
### ORD001
- 状态: 可交付
- 复核时间: 2026-05-01T09:30:00
- 备注: 无
```

### CSV 报告
```csv
order_id,status,review_time,notes,issues
ORD001,可交付,2026-05-01T09:30:00,无,[]
```

---

## UI 布局

- **左侧面板**: 订单列表 (Treeview)，显示订单号、患者姓名、状态标签
- **右侧面板**: 订单详情，含验光处方 tab、加工扫码 tab、复核操作 tab（状态选择、备注输入）
- **顶部菜单**: 文件（导入数据）、导出（Markdown/CSV）
- **底部状态栏**: 显示当前加载订单数、待复核/可交付/需返工统计

---

## 验收标准

1. ✅ 导入验光处方 CSV、镜架参数 JSON、加工中心扫码 JSONL 和公差规则 YAML
2. ✅ 界面显示订单列表和详情，能按订单查看各项参数
3. ✅ 复核状态标记（待复核/可交付/需返工）
4. ✅ 边界处理：字段缺失、重复扫码、缺少终检
5. ✅ SQLite 留痕，复核备注和状态持久化
6. ✅ 导出 Markdown 和 CSV 报告
7. ✅ 附带 sample 数据和 README
8. ✅ 演示命令可跑通主流程
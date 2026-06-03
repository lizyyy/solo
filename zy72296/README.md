# 景区缆车支架巡检管理系统

## 系统定位

展陈设计师阿景的巡检数据追溯工具，解决**经纬度/米制坐标混合**、**照片编号与CAD图层可信度对比**、**历史变更可追溯**三大核心痛点。

> 结论可以满，但证据链不能断。

---

## 核心特性

### ✅ 完整的证据链
- **原始行号保留**：每条记录永久保存导入时的原始行号和来源文件
- **变更历史追踪**：所有字段修改都记录「改前值 → 改后值 | 操作人 | 原因 | 时间」
- **支持回滚**：任何状态都可以手动回滚到历史状态

### ✅ 边界规则硬编码（不靠口头约定）
详见 [models.py 第126-137行](file:///Users/lzy/pro/solo/workspaces/zy72296/models.py#L126-L137)

| 场景 | 判定规则 | 处理方式 | 回滚方式 |
|------|----------|----------|----------|
| 只有经纬度 | `lat != null AND lng != null` | 标记 `latlng` 类型 | 自动 |
| 只有米制坐标 | `mx != null AND my != null` | 标记 `metric` 类型 | 自动 |
| **两者都有（混合）** | `同时满足以上两个条件` | 🔴 标记 `coord_mixed` 状态，**不归正常**，留待巡检组复核 | 人工补充CAD后或手动回滚 |
| 重复导入同批照片 | `photo_number + source_file` 唯一约束 | 更新而非新增，数量不翻倍 | 自动 |

### ✅ 三步标准工作流

```
① 导入巡检照片编号 → ② 展陈设计师补看CAD图层 → ③ 更新现场说明 → 巡检组确认
```

1. **导入阶段**：系统自动检测坐标类型，混合坐标自动标记待复核
2. **CAD补看**：展陈设计师阿景补充CAD图层名，记录变更轨迹
3. **说明更新**：填写给现场班组的说明后，自动进入「待巡检组确认」状态

### ✅ 临时会议快速视图
- 「现场班组视图」标签页专门为会前10分钟准备
- 一眼看清：哪条来自照片、哪条已有CAD、哪条还在等确认
- 坐标混合项有 ⚠️ 醒目提示

---

## 快速开始

### 安装依赖
```bash
pip install flask
```

### 启动服务
```bash
python app.py
```

访问：http://localhost:5000

### 导入数据示例

准备 CSV 文件：
```csv
photo_number,latitude,longitude,metric_x,metric_y,cad_layer_name,bracket_number,field_note
PIC-001,30.12345,120.67890,,,BRACKET-01,ZJ-001,
PIC-002,30.12346,120.67891,500.5,320.8,,ZJ-002,此条坐标混合需注意
PIC-003,,,480.2,315.6,BRACKET-03,ZJ-003,
```

注意：`PIC-002` 同时有经纬度和米制坐标，导入后会自动标记为「坐标混合待复核」。

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/records` | 获取所有记录，可传 `?status=xxx` 过滤 |
| GET | `/api/records/:id` | 获取单条记录详情+历史 |
| GET | `/api/records/:id/history` | 仅获取变更历史 |
| POST | `/api/import` | 上传CSV导入 |
| PUT | `/api/records/:id/cad` | 更新CAD图层 |
| PUT | `/api/records/:id/note` | 更新现场说明 |
| PUT | `/api/records/:id/confirm` | 巡检组确认 |
| PUT | `/api/records/:id/rollback` | 回滚状态 |
| GET | `/api/summary` | 数据概览 |
| GET | `/api/field-view` | 现场班组视图数据 |

---

## 数据结构

### 巡检记录 (inspection_records)

| 字段 | 说明 | 追溯意义 |
|------|------|----------|
| `original_line_number` | 原始行号 | 回到CSV找证据 |
| `source_file` | 来源文件名 | 知道哪批数据来的 |
| `photo_number` | 照片编号 | 唯一标识（+source_file） |
| `coord_type` | 坐标类型 | latlng/metric/mixed |
| `cad_layer_name` | CAD图层名 | 阿景补看的证据 |
| `field_note` | 现场说明 | 给班组看的内容 |
| `status` | 状态 | 见下文状态机 |

### 变更历史 (change_history)

每条字段修改都有记录，包括：
- `field_name`：修改的字段
- `old_value` / `new_value`：改前改后
- `changed_by`：操作人
- `change_reason`：修改原因
- `changed_at`：时间戳

---

## 状态机

```
imported (已导入)
    ↓ 检测到坐标混合
coord_mixed (坐标混合待复核) ←──┐
    ↓ 补CAD                        │
cad_reviewed (CAD已审核)           │  手动回滚
    ↓ 填现场说明                   │
pending_confirm (待巡检组确认)     │
    ↓ 巡检组确认                   │
confirmed (已确认) ────────────────┘
```

**关键规则**：
- 坐标混合的记录**不会**自动跳到下一状态，必须人工处理
- 修改现场说明后自动进入"待确认"，强制巡检组把关
- 任何状态都可以回滚

---

## 设计原则

1. **宁可慢，不可断**：证据链完整性优先于处理速度
2. **边界即代码**：所有判断规则写在代码里，不依赖口头约定
3. **修改即历史**：任何改动都留痕，支持审计和回滚
4. **界面极简**：功能不炫，但每一个数字都能追到源头

---

## 文件说明

- [app.py](file:///Users/lzy/pro/solo/workspaces/zy72296/app.py) - Flask API 服务
- [models.py](file:///Users/lzy/pro/solo/workspaces/zy72296/models.py) - 数据模型和核心业务逻辑
- [templates/index.html](file:///Users/lzy/pro/solo/workspaces/zy72296/templates/index.html) - 前端界面

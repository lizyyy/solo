# 风洞小车阻力曲线分析系统

用于检测风洞实验中传感器重启后编号变化，自动生成安全提醒，支持完整的实验数据追溯流程。

## 功能特性

- ✅ **传感器重启检测**: 自动检测传感器编号异常变化
- ✅ **安全提醒系统**: 标注保留原因、缺失材料和下一步行动
- ✅ **多入口支持**: 命令行工具、REST API、Web小看板
- ✅ **图表可视化**: 风速-阻力散点图，点击异常点追溯详情
- ✅ **完整追溯**: 设备铭牌参数 → 实验老师补录 → 安全员复核

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行样例（命令行方式）

```bash
# 1. 创建实验会话
python cli.py create-session \
    --name "2024-06-01 风洞教学实验" \
    --date "2024-06-01" \
    --csv examples/sensor_data.csv \
    --device examples/device_plate.json

# 2. 查看所有会话
python cli.py list-sessions

# 3. 查看会话详情（获取record_id）
python cli.py show-session <会话ID>

# 4. （模拟）补录维修群截图
python cli.py add-screenshot <会话ID> <记录ID> \
    --file examples/screenshot_demo.txt \
    --desc "2024-06-01 维修群讨论记录" \
    --note "传感器因软件重启，编号自动重置，数据有效"

# 5. 导出报告
python cli.py export-report <会话ID>
```

### 3. 运行Web界面

```bash
python app.py
```

然后访问 `http://localhost:8000`

## 完整工作流程

```
第一步：导入数据
   ↓
第二步：系统自动检测传感器重启
   ↓
   ├─ 标出异常数据点（红色标记）
   └─ 生成安全提醒
        ├─ 保留原因：为什么这条数据要留下
        ├─ 缺失材料：维修群截图、设备铭牌核对
        └─ 下一步：联系林老师
   ↓
第三步：林老师补录
   ↓
   ├─ 上传维修群截图
   ├─ 填写说明备注
   └─ 安全提醒自动更新
        ├─ 缺失材料减少
        └─ 下一步：联系安全员
   ↓
第四步：安全员复核
   ↓
   ├─ 查看所有材料
   ├─ 填写复核意见
   └─ 通过/驳回
        └─ 状态更新为：已完成
```

## 文件结构

```
.
├── app.py                 # FastAPI Web服务
├── cli.py                 # 命令行工具
├── config.py              # 配置文件
├── models.py              # 数据模型
├── storage.py             # 数据存储
├── detector.py            # 重启检测算法
├── safety_reminder.py     # 安全提醒管理
├── data_import.py         # 数据导入模块
├── requirements.txt       # Python依赖
├── templates/             # HTML模板
│   ├── index.html         # 首页
│   └── session.html       # 会话详情页
├── examples/              # 样例数据
│   ├── sensor_data.csv    # 传感器数据样例
│   └── device_plate.json  # 设备铭牌样例
└── data/                  # 数据存储目录（自动创建）
```

## 数据格式说明

### 传感器数据CSV

必需列：
- `timestamp`: ISO格式时间戳 (如: 2024-06-01T10:00:00)
- `sensor_id`: 传感器唯一标识
- `sensor_number`: 传感器当前编号
- `wind_speed`: 风速 (m/s)
- `drag_force`: 阻力 (N)

可选列：
- `temperature`: 温度
- `pressure`: 气压

### 设备铭牌JSON

```json
{
    "device_id": "设备ID",
    "device_name": "设备名称",
    "model": "型号",
    "manufacturer": "制造商",
    "purchase_date": "采购日期",
    "calibration_date": "校准日期",
    "next_calibration_date": "下次校准日期",
    "sensor_count": 传感器数量,
    "remarks": "备注"
}
```

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | Web首页 |
| GET | `/session/{id}` | 会话详情页 |
| POST | `/api/session` | 创建新会话 |
| GET | `/api/sessions` | 列出所有会话 |
| GET | `/api/session/{id}/data` | 获取会话数据 |
| POST | `/api/session/{id}/screenshot` | 上传维修截图 |
| POST | `/api/session/{id}/check-device` | 标记设备核对 |
| POST | `/api/session/{id}/review` | 安全员复核 |

## 设计理念

1. **数据不丢**: 检测到异常时不自动删除，标记后等待人工复核
2. **责任明确**: 每一步都明确"该找谁"，林老师补材料，安全员做复核
3. **追溯可查**: 从图表点击异常点 → 看到安全提醒 → 查看原始材料
4. **新人友好**: README 从样例到报告，一步步能走完

## 常见问题

**Q: 为什么不自动把异常数据标为正常？**
A: 因为传感器重启可能意味着设备状态变化，需要实验老师确认数据有效性后，再由安全员复核。系统只做检测，不做判断。

**Q: 安全提醒为什么要写那么详细？**
A: 安全员复核时需要知道：这条为什么留下、现在有什么材料、还缺什么、下一步该找谁。而不是只看到一个"警告"标签。

**Q: 可以用3D图表吗？**
A: 当前版本使用Chart.js的2D散点图展示风速-阻力关系。如果需要3D可视化，可以扩展前端使用Plotly或Three.js。

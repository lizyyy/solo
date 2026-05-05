# 密室逃脱闭店机关巡检工具

一个本地部署的密室逃脱闭店巡检工具，帮助店员快速识别房间机关风险，确保次日运营安全。

## 功能特性

### 📊 数据导入
- 支持 JSON 和 CSV 格式导入
- 房间机关清单导入
- 传感器触发日志导入
- 道具电量表导入
- 次日预约人数导入

### 🔍 风险检测
- **连续误触检测**：5分钟内连续触发3次以上标记为误触
- **超时未复位检测**：触发后60分钟未复位标记为异常
- **低电量检测**：电量低于20%标记为低电量
- **维修冲突检测**：明日有维修计划且有预约标记为冲突
- **低电量预约冲突**：低电量设备明日有预约标记为高风险

### 🎨 可视化展示
- **房间平面图**：SVG绘制的可交互房间布局图，风险设备用红色标记
- **时间轴视图**：传感器触发时间轴，支持按房间筛选
- **风险概览**：高/中/低风险统计卡片，风险类型分布

### ✅ 复核管理
- 按房间复核风险
- 添加处理备注
- 风险状态改判（待处理/已复核/已解决）
- 一键判为误报
- 本地存储持久化，刷新不丢失

### 📤 导出功能
- 导出 Markdown 交班单
- 导出 JSON 明细数据

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

## 数据格式说明

### 房间机关清单 (rooms.json)
```json
[
  {
    "id": "room-001",
    "name": "古墓迷踪",
    "status": "normal",
    "hasMaintenance": false,
    "devices": [
      {
        "id": "dev-001",
        "name": "石门机关",
        "type": "door_sensor",
        "x": 50,
        "y": 30
      }
    ],
    "layout": {
      "width": 300,
      "height": 200,
      "walls": [
        {"x1": 0, "y1": 0, "x2": 300, "y2": 0}
      ]
    }
  }
]
```

### 传感器触发日志 (sensors.json)
```json
[
  {
    "id": "sensor-001",
    "roomId": "room-001",
    "deviceId": "dev-001",
    "type": "trigger",
    "timestamp": "2026-05-05T14:30:00Z",
    "isReset": false,
    "notes": "玩家触发"
  }
]
```

### 道具电量表 (batteries.json)
```json
[
  {
    "id": "battery-001",
    "roomId": "room-001",
    "deviceId": "dev-004",
    "deviceName": "火把传感器",
    "percentage": 15,
    "lastChecked": "2026-05-04T10:00:00Z"
  }
]
```

### 次日预约人数 (reservations.json)
```json
[
  {
    "id": "res-001",
    "roomId": "room-001",
    "date": "2026-05-06T00:00:00Z",
    "timeSlot": "10:00-11:30",
    "count": 6,
    "customerName": "张先生团队"
  }
]
```

## 风险规则配置

可在 `src/utils/riskCalculator.js` 中调整以下参数：

```javascript
const batteryThreshold = 20;           // 低电量阈值 (%)
const consecutiveTriggerThreshold = 3;  // 连续触发阈值 (次)
const timeoutMinutes = 60;              // 超时未复位阈值 (分钟)
const consecutiveTriggerWindowMinutes = 5; // 连续触发时间窗口 (分钟)
```

## 技术栈

- **前端框架**: Vue 3
- **构建工具**: Vite
- **样式框架**: Tailwind CSS
- **日期处理**: dayjs
- **唯一ID**: uuid

## 项目结构

```
.
├── src/
│   ├── components/           # Vue组件
│   │   ├── DataImportComponent.vue    # 数据导入组件
│   │   ├── RiskSummary.vue            # 风险概览组件
│   │   ├── RoomPlanner.vue            # 房间平面图组件
│   │   ├── TimelineView.vue           # 时间轴组件
│   │   └── RoomReviewPanel.vue        # 房间复核面板
│   ├── data/
│   │   └── sampleData.js              # 示例数据
│   ├── utils/
│   │   └── riskCalculator.js          # 风险计算引擎
│   ├── App.vue                        # 主应用组件
│   ├── main.js                        # 入口文件
│   └── style.css                      # 全局样式
├── index.html                         # HTML模板
├── vite.config.js                     # Vite配置
├── tailwind.config.js                 # Tailwind配置
├── postcss.config.js                  # PostCSS配置
├── package.json                       # 项目配置
└── README.md                          # 项目说明
```

## 使用流程

1. **启动应用**: `npm run dev`
2. **加载数据**: 
   - 点击"加载示例数据"体验完整功能
   - 或通过数据导入区域导入自己的数据
3. **查看风险**: 在风险概览和房间平面图中查看检测到的风险
4. **复核处理**: 
   - 点击房间卡片进入复核面板
   - 查看详细风险信息
   - 添加处理备注
   - 改判风险状态（待处理/已复核/已解决）
5. **导出交班**: 点击顶部导出按钮生成交班单

## 注意事项

- 数据默认存储在浏览器 localStorage 中，清除浏览器数据会丢失
- 建议每日闭店后导出 JSON 明细进行备份
- 示例数据中的日期会自动根据当前日期计算

## License

MIT

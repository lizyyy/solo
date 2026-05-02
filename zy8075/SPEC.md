# 机场机坪除冰调度游戏 - 规格说明书

## 1. 项目概述

**项目名称**: Deicing Dispatch - 冬季机场机坪除冰调度模拟器

**核心功能**: 玩家扮演机场除冰调度员，在倒计时内将待飞航班、除冰车和除冰液分配到多个除冰位，需要满足机型液量需求、航班优先级和起飞窗口，同时处理临时返场、除冰液不足、车辆换班等突发事件。

**目标用户**: 模拟经营游戏爱好者，对航空运营有兴趣的玩家

## 2. 技术架构

### 模块划分

```
├── index.html          # 主入口和UI布局
├── styles.css          # 样式表
├── js/
│   ├── levels.js       # 关卡数据定义
│   ├── scheduler.js    # 调度状态机
│   ├── rules.js        # 规则判定引擎
│   ├── ui.js           # UI交互模块
│   ├── storage.js      # 本地存档与结算报告
│   └── game.js         # 主游戏逻辑
├── README.md           # 本地预览说明
└── SPEC.md             # 本规格文档
```

## 3. 数据模型

### 3.1 航班 (Flight)

```javascript
{
  id: "CA1234",           // 航班号
  airline: "中国航空",     // 航空公司
  aircraftType: "A320",   // 机型
  destination: "北京PEK", // 目的地
  departureTime: 720,     // 计划起飞时间(分钟，从0点计算，例:720=12:00)
  priority: 1,           // 优先级 1-5 (1最高)
  deicingRequired: true,  // 是否需要除冰
  fluidRequired: 150,    // 所需除冰液量(升)
  fluidType: "TypeI",     // 除冰液类型: TypeI/TypeII/TypeIII/TypeIV
  status: "boarding",     // 状态: scheduled/boarding/deicing/deiced/cleared/takeoff/delayed/diverted
  gate: "12",            // 停机位
  actualDeparture: null,  // 实际起飞时间
  specialEvent: null     // 特殊事件: return_flight(返场)/maintenance(维修)/weather_delay(天气延误)
}
```

### 3.2 除冰位 (DeicingPad)

```javascript
{
  id: "PAD-01",           // 除冰位编号
  name: "除冰位1号",
  status: "available",   // available/busy/offline
  currentFlight: null,   // 当前航班
  fluidType: "TypeI",     // 除冰液类型
  processTime: 15,       // 处理时间(分钟)
  equipment: ["deicer-01"] // 可用设备列表
}
```

### 3.3 除冰车 (DeicingVehicle)

```javascript
{
  id: "VEH-001",          // 车辆编号
  name: "除冰车1号",
  status: "available",   // available/busy/maintenance/off_duty
  currentPad: null,      // 当前位置
  currentFlight: null,   // 当前服务航班
  capacity: 2000,        // 液罐容量(升)
  currentFluid: 1800,    // 当前液量(升)
  fluidType: "TypeI",    // 除冰液类型
  shiftEnd: 480,         // 换班时间(分钟，从0点计算)
  operator: "张三",       // 操作员
  maintenanceDue: 1440   // 下次维护时间(分钟)
}
```

### 3.4 除冰液库存 (FluidInventory)

```javascript
{
  TypeI: { total: 10000, reserved: 500, available: 9500 },
  TypeII: { total: 5000, reserved: 200, available: 4800 },
  TypeIII: { total: 2000, reserved: 0, available: 2000 },
  TypeIV: { total: 3000, reserved: 100, available: 2900 }
}
```

### 3.5 游戏状态 (GameState)

```javascript
{
  levelId: "level-01",
  currentTime: 360,       // 当前时间(分钟)
  dayOfOperation: 1,      // 运营日(可能跨午夜)
  flights: [],           // 所有航班
  vehicles: [],          // 所有除冰车
  pads: [],              // 所有除冰位
  fluidInventory: {},    // 除冰液库存
  assignments: [],       // 调度分配记录
  eventLog: [],          // 事件日志
  score: 0,
  status: "playing"      // menu/playing/paused/completed/failed
}
```

## 4. 游戏机制

### 4.1 时间系统

- 游戏时间以分钟为单位，从0点(00:00)开始
- 支持跨午夜运营(dayOfOperation > 1)
- 倒计时模式：每关有固定时间限制
- 时间加速：1x / 2x / 4x / 8x

### 4.2 调度状态机

```
SCHEDULED → BOARDING → DEICING → DEICED → CLEARED → TAKEOFF
                ↓                      ↓
              DELAYED              DIVERSION
                ↓
           RETURN_FLIGHT (返场)
```

**状态转换规则**:
- `SCHEDULED → BOARDING`: 航班预计起飞前30分钟开始登机
- `BOARDING → DEICING`: 玩家手动分配除冰位
- `DEICING → DEICED`: 除冰完成(处理时间倒计时结束)
- `DEICED → CLEARED`: 航班推出许可
- `CLEARED → TAKEOFF`: 到达起飞时间，自动起飞
- `BOARDING → DELAYED`: 延误发生
- `DELAYED → RETURN_FLIGHT`: 返场航班返回机坪

### 4.3 规则判定引擎

**基本规则**:
1. 航班必须先分配除冰位才能开始除冰
2. 除冰位同一时间只能服务一架航班
3. 除冰车需要移动到除冰位才能作业
4. 除冰液量必须足够完成除冰操作
5. 航班必须在起飞窗口内完成除冰

**机型液量规则**:
| 机型 | 液量需求 | 建议处理时间 |
|------|---------|-------------|
| A220/B737-700 | 80-120L | 10min |
| A320/B737-800 | 120-180L | 15min |
| A330/B767 | 180-250L | 20min |
| A380/B747 | 300-450L | 30min |

**优先级规则**:
- 优先级1-5，1为最高
- 同优先级按起飞时间排序
- 紧急航班(优先级1)可以打断当前除冰作业

**起飞窗口规则**:
- 国际航班: 起飞前45-15分钟完成除冰
- 国内航班: 起飞前30-10分钟完成除冰
- 延误成本: 每分钟延误计-10分

### 4.4 突发事件

**临时返场 (Return Flight)**:
- 已起飞的航班因天气/机械原因返场
- 优先级最高(1)，需要立即处理
- 占用原除冰位或重新分配

**除冰液不足**:
- 当液量低于需求时，提示玩家
- 可选择等待补给(耗时10分钟)或降级使用

**车辆故障 (Vehicle Breakdown)**:
- 车辆随机故障，需维修时间
- 故障期间车辆不可用
- 可调度其他可用车辆

**车辆换班 (Shift Change)**:
- 操作员到达换班时间点
- 换班准备时间5分钟
- 换班期间车辆暂时不可用

**跨午夜航班**:
- 航班起飞时间在00:00后
- dayOfOperation自动增加
- 保持航班连续性

### 4.5 计分系统

```
总分 = 基础分 - 延误惩罚 + 效率奖励 + 完成奖励

基础分: 每成功除冰一架航班 +100分
延误惩罚: 每延误1分钟 -10分
效率奖励: 在最佳窗口完成 +50分
完成奖励: 全部航班正常起飞 +200分
跨午夜奖励: 处理跨午夜航班 +100分
```

## 5. UI设计

### 5.1 主界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo] 除冰调度模拟器           时间: 12:45  日: 第1天      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  倒计时: 45:00              │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────────┐ │
│ │                 │ │         除冰位监控面板              │ │
│ │   航班列表面板   │ │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │ │
│ │                 │ │  │PAD-1│ │PAD-2│ │PAD-3│ │PAD-4│  │ │
│ │  [CA1234] A320  │ │  │空闲 │ │A320 │ │空   │ │B737 │  │ │
│ │  12:00 → PEK   │ │  │     │ │15min│ │     │ │10min│  │ │
│ │  ★★★☆☆         │ │  └─────┘ └─────┘ └─────┘ └─────┘  │ │
│ │                 │ │                                     │ │
│ │  [MU5678] B737  │ ├─────────────────────────────────────┤ │
│ │  12:30 → SHA    │ │         车辆状态面板                │ │
│ │  ★★☆☆☆         │ │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │ │
│ │                 │ │  │VEH-1│ │VEH-2│ │VEH-3│ │VEH-4│  │ │
│ └─────────────────┘ │  │可用 │ │作业中│ │维护 │ │待命 │  │ │
│                    │  │1800L│ │1200L│ │     │ │2000L│  │ │
│ ┌─────────────────┐ │  └─────┘ └─────┘ └─────┘ └─────┘  │ │
│ │  除冰液库存      │ ├─────────────────────────────────────┤ │
│ │  TypeI: 9500L   │ │         事件日志                     │ │
│ │  TypeII: 4800L  │ │  [12:30] CA1234 开始除冰            │ │
│ │  TypeIII: 2000L │ │  [12:25] MU5678 延误                │ │
│ │  TypeIV: 2900L  │ │  [12:20] 天气恶化通知               │ │
│ └─────────────────┘ └─────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  [开始] [暂停] [2x] [4x]  |  得分: 1250  |  [存档] [结算]    │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 拖拽交互

- 航班卡片可拖拽到除冰位
- 车辆可分配到除冰位
- 液量需求实时显示
- 冲突时显示红色警告

### 5.3 结算报告 (deicing_report.json)

```json
{
  "reportId": "RPT-2024-001",
  "levelId": "level-01",
  "gameDate": "2024-01-15",
  "summary": {
    "totalFlights": 8,
    "successfulDeicing": 7,
    "delayedFlights": 2,
    "divertedFlights": 1,
    "onTimeRate": "87.5%",
    "totalScore": 1250
  },
  "timeline": [
    {
      "time": "12:00",
      "event": "CA1234 开始除冰",
      "type": "deicing_start"
    }
  ],
  "fluidUsage": {
    "TypeI": { "used": 1200, "percentage": "85%" },
    "TypeII": { "used": 300, "percentage": "15%" }
  },
  "vehicleUtilization": {
    "VEH-001": { "activeTime": 180, "idleTime": 120 },
    "VEH-002": { "activeTime": 200, "idleTime": 100 }
  },
  "issues": [
    {
      "flight": "MU5678",
      "issue": "除冰液不足，降级使用",
      "resolution": "等待补给10分钟"
    }
  ]
}
```

## 6. 关卡设计

### 6.1 Sample关卡 - 基础教学 (level-01)

**场景**: 白天运营，简单3航班，无突发事件
**时间限制**: 60分钟
**目标**: 学会基本拖拽操作

### 6.2 Sample关卡 - 跨午夜挑战 (level-02)

**场景**:
- 22:00-02:00时段运营
- 包含跨午夜航班
- 夜间低温除冰液消耗增加

**边界条件**:
- MU5678在23:30起飞，除冰完成时已跨午夜
- 夜间视野受限，除冰效率降低20%

### 6.3 Sample关卡 - 车辆故障 (level-03)

**场景**:
- 8架航班混合运营
- 除冰车VEH-002在12:30发生故障
- 需要重新调度资源

**边界条件**:
- 车辆故障发生在高峰期
- 维修时间15分钟
- 需要临时调用备用车辆

### 6.4 Sample关卡 - 综合挑战 (level-04)

**场景**: 全功能关卡
- 12架航班
- 2架临时返场
- 液量紧张
- 车辆换班事件
- 跨午夜运营

## 7. 验收标准

### 7.1 功能验收

- [ ] 玩家可拖拽航班到除冰位
- [ ] 除冰过程自动计时
- [ ] 液量不足时正确提示
- [ ] 车辆可正常调度
- [ ] 跨午夜时间正确增加
- [ ] 车辆故障正确处理
- [ ] 换班事件正确触发
- [ ] 结算报告正确生成

### 7.2 边界覆盖

- [ ] 跨午夜航班: level-02中MU5678在23:30开始除冰，01:15起飞
- [ ] 车辆故障: level-03中VEH-002在12:30故障
- [ ] 液量不足: level-04中可能出现
- [ ] 临时返场: level-04中包含

### 7.3 本地运行

- [ ] 可通过简单HTTP服务器预览
- [ ] 无外部依赖
- [ ] 存档功能正常
- [ ] 报告导出正常

## 8. 技术要求

- 纯前端实现，无需后端
- 使用原生JavaScript ES6+
- CSS Grid/Flexbox布局
- LocalStorage存档
- Blob下载JSON报告
- 响应式设计，支持1024px以上屏幕

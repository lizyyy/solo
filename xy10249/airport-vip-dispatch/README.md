# 机场贵宾车动态调派 CLI (Airport VIP Dispatch CLI)

基于航班延误、航站楼位置和车型偏好的智能调派系统。

## 项目特点

- **航班延误感知**: 根据延误程度动态调整优先级和接驾时间
- **航站楼位置优化**: 计算车辆基地到登机口的距离，优先选择近的车辆
- **车型偏好匹配**: 优先匹配贵宾指定的车型，不匹配时扣分
- **冲突检测**: 自动检测车辆和司机的时间冲突
- **延误重算**: 航班延误时自动重算调派时间并通知司机

## 快速开始

### 环境要求
- Node.js 18.0+

### 安装与初始化

```bash
cd airport-vip-dispatch

# 初始化样例数据
node src/index.js init

# 查看帮助
node src/index.js --help
```

## 可用命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `init` | 初始化样例数据 | `node src/index.js init` |
| `import <文件>` | 从 JSON 文件导入数据 | `node src/index.js import ./sample-data.json` |
| `status` | 显示系统状态 | `node src/index.js status` |
| `list flights` | 查看航班列表 | `node src/index.js list flights` |
| `list vehicles` | 查看车辆列表 | `node src/index.js list vehicles` |
| `list drivers` | 查看司机列表 | `node src/index.js list drivers` |
| `list dispatches` | 查看调派记录 | `node src/index.js list dispatches` |
| `dispatch <航班ID>` | 为指定航班调派 | `node src/index.js dispatch FLIGHT-001` |
| `run` | 执行完整调派流程 | `node src/index.js run` |
| `check` | 检查调派冲突 | `node src/index.js check` |
| `delay <航班ID> <分钟> [原因]` | 更新航班延误 | `node src/index.js delay FLIGHT-001 45 天气原因` |
| `history [数量]` | 查看调派历史 | `node src/index.js history 20` |
| `export [格式] [文件名]` | 导出报告 | `node src/index.js export text` |

## 主流程演示

```bash
# 1. 初始化数据
node src/index.js init

# 2. 查看系统状态
node src/index.js status

# 3. 执行完整调派流程
node src/index.js run

# 4. 检查冲突
node src/index.js check

# 5. 模拟航班延误
node src/index.js delay FLIGHT-002 60 天气原因

# 6. 再次调派
node src/index.js dispatch FLIGHT-002

# 7. 查看调派历史
node src/index.js history

# 8. 导出报告
node src/index.js export text
```

## 异常操作示例

```bash
# 调派不存在的航班（会报错）
node src/index.js dispatch INVALID_FLIGHT

# 导入不存在的文件（会报错）
node src/index.js import /tmp/not-exist.json

# 延误参数错误（会报错）
node src/index.js delay FLIGHT-001 abc
```

## 样例数据说明

初始化后会创建以下数据：

### 航班 (3条)
| ID | 航班号 | 登机口 | 贵宾 | 等级 | 车型偏好 | 延误 |
|----|--------|--------|------|------|----------|------|
| FLIGHT-001 | CA1234 | T3-A01 | 张三 | platinum | limousine | 0分钟 |
| FLIGHT-002 | MU5678 | T1-B02 | 李四 | gold | suv | 45分钟 |
| FLIGHT-003 | CZ9012 | T2-A02 | 王五 | silver | sedan | 0分钟 |

### 车辆 (4辆)
| ID | 车牌号 | 车型 | 基地 | 司机 |
|----|--------|------|------|------|
| VEH-001 | 京A·88888 | limousine | BASE-T3 | 王师傅 |
| VEH-002 | 京B·66666 | suv | BASE-T1 | 李师傅 |
| VEH-003 | 京C·22222 | sedan | BASE-MAIN | 张师傅 |
| VEH-004 | 京D·55555 | van | BASE-MAIN | 赵师傅 |

### 车型说明
- **limousine (礼宾车)**: 最高级，白金卡贵宾首选
- **suv (豪华SUV)**: 适合多人或行李多的情况
- **sedan (豪华轿车)**: 标准豪华车型
- **van (商务车)**: 适合团体

## 航站楼配置

系统预设了 3 个航站楼，每个航站楼有不同的登机口距离权重：

- **T3-A区**: 最近（距离 3-4）
- **T1-A区**: 中等（距离 5-7）
- **T2区**: 中等（距离 8-9）
- **B区登机口**: 较远（距离 10-25）
- **跨航站楼**: 额外 +15 距离

## 评分算法

调派时综合考虑以下因素：

```
总分 = 车型偏好 + 航站楼距离 + 延误程度 + 贵宾等级 + 司机评分
```

各因素权重：
- 车型匹配: +100，不匹配: -50
- 航站楼距离: 0-50（越近越高）
- 延误程度: 0-40（越延误越高）
- 贵宾等级: 白金 +50, 金卡 +30, 银卡 +15
- 司机资质: 评分 × 10 + 经验加成

## 数据存储位置

所有数据存储在项目目录下的 `.avd-data` 文件夹：

- `.avd-data/flights.json` - 航班数据
- `.avd-data/vehicles.json` - 车辆数据
- `.avd-data/drivers.json` - 司机数据
- `.avd-data/dispatch-history.json` - 调派历史
- `.avd-data/reports/` - 导出的报告

## 导入数据格式

可以通过 JSON 文件导入数据：

```json
{
  "flights": [
    {
      "id": "FLIGHT-004",
      "flightNumber": "HU7890",
      "scheduledDeparture": "2026-05-10T18:00:00.000Z",
      "gate": "T3-A02",
      "destination": "深圳",
      "airline": "海航",
      "passengerName": "赵六",
      "passengerLevel": "platinum",
      "vehiclePreference": "limousine",
      "delayMinutes": 0
    }
  ],
  "vehicles": [...],
  "drivers": [...]
}
```

## 运行测试

```bash
npm test
```

## 关键判断的测试验证

系统的核心业务逻辑都有测试覆盖：

1. **登机口验证**: `test-models.test.js` 中测试无效登机口会抛出错误
2. **车型验证**: 测试无效车型会导致验证失败
3. **延误更新**: 测试延误分钟数更新和状态变化
4. **登机口变更**: 测试登机口变更的历史记录
5. **冲突检测**: 命令 `check` 会输出检测到的车辆/司机冲突
6. **通知模拟**: 延误时会在调派记录中添加通知

## 业务闭环

```
航班导入 → 车辆/司机档案 → 调派排程 → 延误重算 → 冲突解释 → 司机通知 → 状态/报告
     ↓                                                                    ↑
     └────────────────────────────────────────────────────────────────────┘
```

## 核心文件结构

```
airport-vip-dispatch/
├── src/
│   ├── index.js           # CLI 入口
│   ├── commands.js        # 命令处理
│   ├── config.js          # 配置常量
│   ├── models/
│   │   ├── flight.js      # 航班模型
│   │   ├── vehicle.js     # 车辆模型
│   │   ├── driver.js      # 司机模型
│   │   └── dispatch.js    # 调派模型
│   ├── services/
│   │   └── dispatch-engine.js  # 核心调派算法
│   └── utils/
│       ├── storage.js     # 数据存储
│       └── help.js        # 帮助信息
├── tests/
│   └── test-models.test.js
├── package.json
└── README.md
```

## License

MIT

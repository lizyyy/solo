# 灾后道路侦察 - 飞行复盘系统

外场队长天黑收队前的飞行复盘工具，让一线同事愿意用。

## 功能特点：

### 1. **人话错误提示** - 不说技术术语，只说你懂的话

2. **幂等性处理** - 同一批材料不重复建新记录

3. **变更检测** - 补传旧版本时提醒哪里变了

4. **实用复盘报告** - 下一班接班直接看，不用翻聊天记录

## 快速开始

```bash
npm install
npm run demo
```

## 使用示例

```javascript
const DisasterRoadRecon = require('./src/index');

const recon = new DisasterRoadRecon();

await recon.analyzeMission({
  date: '2024-05-31',
  routeName: '迎宾大道',
  pilot: '张队长',
  kmlPath: './data/sample-route.kml',
  batteryPath: './data/battery-log.txt',
  weather: { windSpeed: 3.2, visibility: 5000, condition: '晴' }
});
```

## 文件结构

```
├── src/
│   ├── index.js              # 主入口
│   ├── kmlParser.js        # KML航线解析
│   ├── noFlyZoneChecker.js # 禁飞区检测
│   ├── batteryManager.js  # 电池记录管理
│   ├── missionStore.js   # 任务存储（幂等性+版本）
│   ├── reportGenerator.js # 报告生成
│   ├── utils/
│   │   └── errors.js    # 友好错误提示
│   └── demo.js          # 演示脚本
├── data/                   # 数据文件
├── output/                 # 输出报告
└── config.js             # 配置文件
```

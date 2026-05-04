# 🎻 提琴归还放行工具

学校乐器租赁室提琴归还放行工具 - 本地桌面 GUI 应用，用于提琴归还当天判断乐器能不能重新上架。

## 功能特性

### 📥 数据导入
- **租借单 CSV** - 导入学生租借记录，包含租借日期、应还日期等信息
- **琴盒湿度记录 CSV** - 导入琴盒湿度监测数据
- **弓毛/松香点检 JSON** - 导入弓毛和松香的点检记录
- **维修备注 JSON** - 导入维修相关的备注信息

### 🔍 风险识别规则
系统自动识别以下风险：

1. **逾期未归** - 检查租借是否超过应还日期
   - 逾期 > 7 天：严重风险
   - 逾期 > 3 天：高风险
   - 逾期 ≤ 3 天：中风险

2. **湿度超限** - 检查琴盒湿度是否在正常范围（40%-60%）
   - 湿度过高或过低 > 15%：严重风险
   - 湿度过高或过低 > 10%：高风险
   - 湿度超出范围：中风险

3. **弓毛损伤未维修** - 检查弓毛/松香点检状态
   - 总体状态为 fail：严重风险
   - 总体状态为 needs_maintenance：高风险
   - 弓毛或松香状态为 poor：中风险

4. **同一琴号重复预约** - 检查同一琴号是否存在时间重叠的活跃租借
   - 发现冲突：严重风险

### ✏️ 人工复核
- 按乐器显示风险详情
- 支持三种复核决定：
  - **通过** - 乐器可重新上架
  - **标记待维修** - 乐器需要维修
  - **扣留** - 禁止乐器上架
- 解除扣留功能

### 💾 数据持久化
- 保存数据到本地 JSON 文件
- 从本地 JSON 文件加载数据
- 刷新应用后数据不丢失

### 📤 数据导出
- **待维修清单 (Markdown)** - 导出所有需要维修的乐器清单
- **审计日志 (JSON)** - 导出操作审计记录

## 技术栈

- **前端框架**: Vue 3
- **状态管理**: Pinia
- **构建工具**: Vite
- **桌面框架**: Electron
- **CSV 解析**: Papa Parse

## 快速开始

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这将启动 Vite 开发服务器和 Electron 应用。

### 构建应用

```bash
npm run build
```

构建完成后，可执行文件将生成在 `release/` 目录下。

### 仅构建目录（不打包）

```bash
npm run build:dir
```

## 数据格式说明

### 租借单 CSV 格式

| 字段名 (英文) | 字段名 (中文) | 说明 |
|--------------|--------------|------|
| rentalId | 租借单号 | 租借记录唯一标识 |
| studentId | 学生ID/学号 | 学生编号 |
| studentName | 学生姓名 | 学生姓名 |
| violinId | 提琴ID/琴号 | 乐器编号 |
| violinName | 提琴名称 | 乐器名称 |
| rentDate | 租借日期 | 借出日期 (YYYY-MM-DD) |
| dueDate | 应还日期 | 到期日期 (YYYY-MM-DD) |
| status | 状态 | active/returned/overdue |

**示例：**
```csv
rentalId,studentId,studentName,violinId,violinName,rentDate,dueDate,status
R001,S001,张三,V001,4/4 小提琴,2024-01-15,2024-01-22,active
R002,S002,李四,V002,3/4 小提琴,2024-01-10,2024-01-17,overdue
```

### 琴盒湿度记录 CSV 格式

| 字段名 (英文) | 字段名 (中文) | 说明 |
|--------------|--------------|------|
| violinId | 提琴ID/琴号 | 乐器编号 |
| violinName | 提琴名称 | 乐器名称 |
| recordTime | 记录时间 | 监测时间 |
| humidity | 湿度 | 湿度值 (%) |
| temperature | 温度 | 温度值 (可选) |
| location | 位置 | 存放位置 (可选) |

**示例：**
```csv
violinId,violinName,recordTime,humidity,temperature,location
V001,4/4 小提琴,2024-01-22 08:00,45,22,乐器室A
V001,4/4 小提琴,2024-01-22 14:00,35,25,乐器室A
V002,3/4 小提琴,2024-01-22 08:00,50,22,乐器室B
```

### 弓毛/松香点检 JSON 格式

```json
[
  {
    "id": "I001",
    "violinId": "V001",
    "violinName": "4/4 小提琴",
    "inspectionDate": "2024-01-20",
    "bowHairCondition": "fair",
    "bowHairIssues": ["少量断毛", "需要更换"],
    "rosinCondition": "good",
    "rosinIssues": [],
    "inspector": "王老师",
    "overallStatus": "needs_maintenance",
    "notes": "弓毛需要更换"
  }
]
```

**字段说明：**
- `bowHairCondition`: excellent/good/fair/poor (优秀/良好/一般/较差)
- `rosinCondition`: excellent/good/fair/poor (优秀/良好/一般/较差)
- `overallStatus`: pass/needs_maintenance/fail (通过/需维护/不合格)

### 维修备注 JSON 格式

```json
[
  {
    "id": "M001",
    "violinId": "V001",
    "violinName": "4/4 小提琴",
    "createDate": "2024-01-20",
    "issueType": "bow_hair",
    "description": "弓毛断裂较多，需要重新换毛",
    "status": "pending",
    "technician": "张师傅",
    "cost": 150,
    "notes": "需要订购新的马尾"
  }
]
```

**字段说明：**
- `issueType`: bow_hair/rosin/bridge/strings/case/other (弓毛/松香/琴桥/琴弦/琴盒/其他)
- `status`: pending/in_progress/completed (待处理/进行中/已完成)

## 项目结构

```
xy4415/
├── electron/
│   ├── main.ts          # Electron 主进程
│   └── preload.ts       # 预加载脚本
├── src/
│   ├── assets/
│   │   └── styles/
│   │       └── main.css # 全局样式
│   ├── stores/
│   │   └── dataStore.ts # Pinia 状态管理
│   ├── types/
│   │   └── index.ts     # TypeScript 类型定义
│   ├── utils/
│   │   ├── csvParser.ts # CSV/JSON 解析器
│   │   ├── dateUtils.ts # 日期工具函数
│   │   └── riskEngine.ts # 风险评估引擎
│   ├── App.vue          # 主组件
│   └── main.ts          # 应用入口
├── index.html           # HTML 模板
├── package.json         # 项目配置
├── vite.config.ts       # Vite 配置
└── README.md            # 项目文档
```

## 风险评估规则详情

### 湿度正常范围
- **正常范围**: 40% - 60%
- **湿度过低**: < 40% (可能导致乐器开裂)
- **湿度过高**: > 60% (可能导致乐器发霉)

### 逾期判定
- 超过应还日期当天即判定为逾期
- 逾期天数越多，风险级别越高

### 重复预约判定
- 同一琴号存在两个或以上活跃租借记录
- 租借时间段存在时间重叠

## 许可证

MIT License

# 🎬 道具连续性检查工具

一个专为影视场记设计的本地前端工具，用于在补拍前复核道具连续性。

## 功能特性

- **场次时间线展示**：按拍摄顺序展示所有场次，清晰呈现道具在各场景中的位置、状态和负责人
- **自动连续性检查**：内置规则引擎，自动检测以下问题：
  - 道具突然消失（在首次和最后出现之间的场景中缺失）
  - 道具状态倒退（如从"损坏"变回"完好"）
  - 同一道具编号重复使用
  - 补拍日期早于计划/实际拍摄日期
  - 道具缺少负责人
  - 道具状态未验证

- **问题标记与确认**：用户可将检测到的风险标记为已确认，状态保存在 IndexedDB 中
- **数据导入导出**：
  - 导入场景数据（JSON）
  - 导入道具数据（CSV）
  - 导入连续性规则（YAML）
  - 导出审核报告（review_report.md）
  - 导出问题列表（issues.csv）
- **示例数据**：内置完整的示例数据，可快速体验工具功能
- **本地存储**：所有数据保存在浏览器 IndexedDB 中，刷新页面不丢失
- **响应式设计**：支持桌面和移动端访问
- **暗色主题**：自动跟随系统主题设置

## 项目结构

```
zy8138/
├── src/
│   ├── components/          # UI 组件
│   │   ├── index.ts
│   │   ├── timelineComponent.ts       # 时间线组件
│   │   └── importExportComponent.ts   # 导入导出组件
│   ├── data/               # 示例数据
│   │   ├── index.ts
│   │   ├── sampleData.ts              # 整合的示例数据
│   │   ├── sampleScenes.json          # 场景数据
│   │   ├── sampleProps.csv            # 道具数据
│   │   └── sampleContinuityRules.yaml # 连续性规则
│   ├── engine/             # 规则引擎
│   │   ├── index.ts
│   │   └── rulesEngine.ts             # 连续性检查逻辑
│   ├── parsers/            # 数据解析器
│   │   ├── index.ts
│   │   ├── jsonParser.ts              # JSON 解析
│   │   ├── csvParser.ts               # CSV 解析
│   │   └── yamlParser.ts              # YAML 解析
│   ├── storage/            # 状态持久化
│   │   ├── index.ts
│   │   └── indexedDb.ts               # IndexedDB 操作
│   ├── types/              # 类型定义
│   │   └── index.ts
│   ├── main.ts             # 应用入口
│   └── style.css           # 样式文件
├── index.html
├── package.json
├── tsconfig.json
└── README.md
```

## 安装与运行

### 环境要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 安装依赖

```bash
npm install
```

### 本地开发预览

```bash
npm run dev
```

执行后，访问控制台显示的本地地址（通常是 `http://localhost:5173`）即可查看应用。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览生产版本

```bash
npm run preview
```

## 使用指南

### 快速开始

1. 安装依赖并启动开发服务器
2. 访问应用页面，默认会加载示例数据
3. 查看"时间线"页面，了解各场景的道具分布
4. 切换到"问题列表"页面，查看自动检测到的连续性问题
5. 点击"标记已确认"按钮，处理已核实的问题
6. 切换到"导出报告"页面，下载审核报告

### 界面导航

- **时间线**：按场次时间线展示所有场景及其道具，问题场景会高亮显示
- **问题列表**：列出所有检测到的连续性问题，按严重程度分类，支持标记已确认
- **导入数据**：可导入自定义的场景、道具和规则数据，或重新加载示例数据
- **导出报告**：导出详细的审核报告（Markdown 格式）和问题列表（CSV 格式）

### 数据格式说明

#### 场景数据（JSON）

```json
[
  {
    "id": "scene-001",
    "sceneNumber": "1A",
    "description": "场景描述",
    "date": "2024-06-15",
    "timeOfDay": "MORNING",
    "location": "拍摄地点",
    "interiorExterior": "INT",
    "plannedShootDate": "2024-06-10",
    "actualShootDate": "2024-06-10",
    "reshootDate": "2024-06-15",
    "notes": "备注信息"
  }
]
```

#### 道具数据（CSV）

| 列名 | 说明 | 示例 |
|------|------|------|
| propId | 道具唯一标识 | prop-001 |
| propNumber | 道具编号 | P-001 |
| name | 道具名称 | 复古怀表 |
| description | 道具描述 | 金色怀表，有家族徽章 |
| category | 道具类别 | 饰品 |
| responsiblePerson | 负责人 | 道具组-张三 |
| status | 道具状态 | In Use |
| currentLocation | 当前位置 | 主角道具箱 |
| photos | 照片路径 | photos/watch.jpg |
| notes | 备注 | 非常重要的道具 |
| sceneId | 出现场景 ID | scene-001 |
| position | 场景中的位置 | 主角右手口袋 |
| state | 场景中的状态 | Working |
| condition | 道具状况 | Good |

#### 连续性规则（YAML）

```yaml
rules:
  - id: rule-001
    ruleType: prop_disappearance
    name: 道具突然消失检测
    description: 检测在场景时间线中，道具在首次出现和最后出现之间突然消失的情况
    severity: critical
    enabled: true
```

支持的规则类型：
- `prop_disappearance` - 道具突然消失
- `state_regression` - 道具状态倒退
- `duplicate_prop_number` - 重复道具编号
- `reshoot_date_issue` - 补拍日期问题
- `missing_responsibility` - 缺少负责人
- `unverified_condition` - 未验证状态

严重程度：
- `critical` - 严重
- `warning` - 警告
- `info` - 信息

## 技术栈

- **构建工具**：Vite 5.x
- **语言**：TypeScript
- **数据解析**：
  - Papa Parse (CSV)
  - js-yaml (YAML)
- **本地存储**：idb (IndexedDB 包装库)
- **样式**：原生 CSS，支持暗色主题

## 浏览器兼容性

- Chrome >= 60
- Firefox >= 55
- Safari >= 14
- Edge >= 79

（需要支持 IndexedDB 和 ES6+ 特性）

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0

- 初始版本发布
- 实现场次时间线展示
- 实现连续性规则引擎
- 实现 IndexedDB 数据持久化
- 实现数据导入导出功能
- 添加示例数据
- 添加完整的样式和响应式设计

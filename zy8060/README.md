# 3D 器械包灭菌装载预检工具

用于消毒供应中心在灭菌前检查托盘内器械摆放是否符合规范的可视化工具。

## 功能特性

- 📦 **3D 可视化**: 使用 Three.js 实时渲染托盘和器械
- 📊 **多格式数据输入**: 支持 JSON (托盘)、CSV (器械)、YAML (规则)
- ✅ **规则校验**: 检查高度限制、间距、重叠、分层要求
- 🎮 **交互式操作**: 拖拽移动器械、旋转视角
- 📄 **导出功能**: 导出装载计划 (JSON) 和风险报告 (Markdown)
- ⚠️ **异常处理**: 检测缺尺寸、重复器械编号等问题

## 安装与运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问显示的本地地址 (通常是 http://localhost:5173) 即可使用。

## 项目结构

```
.
├── src/
│   ├── parser.js      # 数据解析模块 (JSON/CSV/YAML)
│   ├── validator.js   # 规则校验模块
│   ├── state.js       # 3D 交互状态管理
│   ├── exporter.js    # 导出模块
│   ├── viewer.js      # Three.js 3D 可视化
│   └── main.js        # 主应用入口
├── sample_data/       # 示例数据
│   ├── tray.json      # 托盘规格
│   ├── instruments.csv# 器械清单
│   └── rules.yaml     # 灭菌规则
├── index.html         # HTML 页面
├── package.json
├── vite.config.js
└── README.md
```

## 使用说明

### 1. 加载数据

- 点击「加载全部示例」使用预设数据
- 或分别上传自定义的托盘、器械、规则文件

### 2. 操作器械

- **左键拖拽**: 移动选中的器械
- **右键拖拽**: 旋转视角
- **滚轮**: 缩放视图
- **左键空白 + 拖拽**: 旋转场景

### 3. 校验规则

点击「校验规则」按钮检查是否存在问题，包括：
- ❌ 器械高度超过托盘限制
- ❌ 器械之间重叠遮挡
- ⚠️ 器械间距不足
- ❌ 必须分层的器械未放置在底层

### 4. 导出结果

- **导出 Load Plan**: 导出装载计划 JSON 文件
- **导出 Risk Report**: 导出风险报告 Markdown 文件

## 数据格式

### 托盘规格 (JSON)

```json
{
  "name": "标准灭菌托盘",
  "width": 500,
  "depth": 350,
  "maxHeight": 200
}
```

### 器械清单 (CSV)

| id | name | type | width | depth | height | mustLayer | color |
|----|------|------|-------|-------|--------|-----------|-------|
| INS001 | 手术剪 | 剪刀 | 80 | 40 | 20 | false | #4CAF50 |

### 灭菌规则 (YAML)

```yaml
name: 标准灭菌装载规则
maxHeight: 200
minGap: 10
rules:
  - id: HEIGHT_LIMIT
    name: 高度限制
    enabled: true
```

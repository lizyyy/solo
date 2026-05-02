# 刀模拼版预检工具

纯前端的印刷包装刀模拼版预检工具，用于检测出血不足、文字压线、色版缺失和重叠区域等问题。

## 功能特性

- **文件解析**: 支持导入刀模 JSON、图文元素 CSV、规则配置 YAML
- **规则引擎**: 检测出血、安全线、色版、重叠等问题
- **Canvas 预览**: 可视化展示拼版效果及问题区域
- **导出功能**: 支持导出 issues.csv 和 preview.json
- **示例数据**: 内置可直接加载的 sample 数据

## 项目结构

```
├── index.html              # 主页面
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── app.js             # 主应用入口
│   ├── parsers.js         # 文件解析模块 (JSON/CSV/YAML)
│   ├── ruleEngine.js      # 规则引擎
│   ├── renderer.js        # Canvas 渲染模块
│   ├── state.js           # 状态管理
│   └── exporter.js        # 导出模块
├── samples/
│   ├── sample_diecut.json # 刀模示例
│   ├── sample_graphics.csv # 图文元素示例
│   └── sample_rules.yaml  # 规则配置示例
└── README.md
```

## 本地预览

### 方式一：使用 Python

```bash
cd /Users/lzy/pro/solocoder/pro/zy8044/repo/zy8044
python3 -m http.server 8080
```

然后在浏览器打开: http://localhost:8080

### 方式二：使用 Node.js

```bash
cd /Users/lzy/pro/solocoder/pro/zy8044/repo/zy8044
npx serve .
```

### 方式三：使用 VS Code Live Server

安装 Live Server 扩展，然后在 index.html 上右键选择 "Open with Live Server"

## 完整演示流程

### 1. 启动服务

```bash
cd /Users/lzy/pro/solocoder/pro/zy8044/repo/zy8044
python3 -m http.server 8080
```

### 2. 打开页面

浏览器访问 http://localhost:8080

### 3. 加载示例数据

点击右上角 **📦 加载示例数据** 按钮，系统将自动加载：

- `sample_diecut.json` - 包含 8 个刀模的 A4 页面
- `sample_graphics.csv` - 10 个图文元素
- `sample_rules.yaml` - 标准印刷规则

### 4. 查看检测结果

页面右侧 **⚠️ 检测到的问题** 面板将显示：

- **出血不足**: 刀模超出页面出血区域
  - 正面主图: 顶部出血不足
  - 左侧信息栏: 左侧坐标为 -5mm，存在负坐标问题
  - 底部条码区: 右侧出血不足
  - 顶部标题区: 顶部坐标为 -8mm，存在负坐标问题

- **色版缺失**:
  - 中心Logo区: 缺少 K 版
  - 顶部标题区: 缺少 C 版

- **重叠区域**:
  - 测试重叠区A ↔ 测试重叠区B: 存在重叠

### 5. 识别画布颜色

| 颜色 | 含义 |
|------|------|
| 红色虚线框 | 出血区域边界 |
| 绿色虚线框 | 安全线 |
| 红色高亮 | 出血不足区域 |
| 橙色高亮 | 文字压线 |
| 紫色高亮 | 色版缺失 |
| 粉色高亮 | 重叠区域 |

### 6. 导出报告

- 点击 **📊 导出 Issues CSV** 下载问题列表
- 点击 **📄 导出 Preview JSON** 下载完整预览数据

## 文件格式说明

### 刀模 JSON

```json
{
  "pageWidth": 210,
  "pageHeight": 297,
  "bleed": 3,
  "unit": "mm",
  "dies": [
    {
      "id": "die_001",
      "name": "正面主图",
      "x": 10,
      "y": 20,
      "width": 80,
      "height": 60,
      "colors": ["C", "M", "Y", "K"]
    }
  ]
}
```

### 图文 CSV

```csv
id,type,name,x,y,width,height,colors,isText,text
g001,text,产品名称,15,25,70,12,C;M;Y;K,true,产品名称
```

### 规则 YAML

```yaml
bleed:
  width: 3

safeLine:
  width: 3

colors:
  required:
    - C
    - M
    - Y
    - K

check:
  bleed: true
  overlap: true
  safeLine: true
  colorLayer: true
```

## 边界情况处理

### 1. 负坐标处理

当刀模或图文元素坐标为负数时：
- 系统会自动修正为 0
- 在 issues 中记录警告信息
- 显示原始坐标和修正后坐标

### 2. 单位混用处理

支持 mm 和 pt 两种单位：
- 所有数据内部统一转换为 mm
- pt → mm 转换系数: 0.352778
- 导出时保持 mm 单位

## 技术栈

- 原生 JavaScript (ES6+)
- Canvas 2D API
- js-yaml (YAML 解析)
- 无框架依赖

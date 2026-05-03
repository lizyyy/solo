# 考古探方地层可视化工具

一个基于 Three.js 的 3D 交互可视化工具，用于考古现场整理员复核探方地层记录。

## 功能特性

- **3D 可视化**: 使用 Three.js 展示探方剖面和地层块体
- **交互式查看**: 点击地层查看年代、包含物和出土物信息
- **数据校验**: 自动检测地层高程倒挂、切入关系矛盾、孤立出土物坐标越界等问题
- **报告导出**: 生成问题列表 (issues.csv) 和详细报告 (section_report.md)
- **多模块架构**: 解析、规则校验、3D 渲染、报告导出等模块分离

## 项目结构

```
zy8191/
├── index.html              # 主页面
├── package.json            # 项目配置
├── vite.config.js          # Vite 配置
├── README.md               # 项目说明
├── sample/                 # 样例数据
│   ├── contexts.csv        # 地层记录
│   ├── finds.json          # 出土物记录
│   └── rules.yaml          # 校验规则
└── src/
    ├── main.js             # 主应用入口
    ├── sampleData.js       # 内置样例数据
    ├── parsers/            # 数据解析模块
    │   ├── index.js
    │   ├── csvParser.js    # CSV 解析器
    │   ├── jsonParser.js   # JSON 解析器
    │   └── yamlParser.js   # YAML 解析器
    ├── validators/         # 规则校验模块
    │   ├── index.js
    │   ├── elevationValidator.js    # 高程校验
    │   ├── relationshipValidator.js # 关系校验
    │   └── coordinateValidator.js   # 坐标校验
    ├── renderer/           # 3D 渲染模块
    │   ├── sceneRenderer.js        # 场景渲染器
    │   ├── layerRenderer.js        # 地层渲染器
    │   └── findRenderer.js         # 出土物渲染器
    └── exporters/          # 报告导出模块
        └── reportExporter.js       # 报告导出器
```

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务器启动后会自动打开浏览器访问 `http://localhost:3000`

### 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录下。

### 预览生产版本

```bash
npm run preview
```

## 使用方法

### 1. 加载数据

有两种方式加载数据：

**方式一：加载样例数据**
- 点击界面上的「加载样例数据」按钮
- 系统会自动加载预设的测试数据

**方式二：导入自定义数据**
- 点击「地层记录 (contexts.csv)」选择地层数据文件
- 点击「出土物记录 (finds.json)」选择出土物数据文件
- 点击「校验规则 (rules.yaml)」选择规则配置文件

### 2. 3D 交互操作

- **旋转视角**: 鼠标左键拖拽
- **平移视角**: 鼠标右键拖拽或 Shift + 左键
- **缩放**: 鼠标滚轮
- **查看地层信息**: 点击任意地层块体，右侧会显示该地层的详细信息
- **查看出土物**: 点击任意出土物（球体标记）查看详细信息

### 3. 执行校验

1. 加载完所有必要数据后，「执行校验」按钮会变为可用状态
2. 点击「执行校验」按钮
3. 系统会自动检测以下问题：
   - 地层高程倒挂（底部高程高于顶部高程）
   - 地层切入关系矛盾（循环关系、矛盾的打破关系）
   - 出土物坐标越界（超出探方范围或所属地层范围）
4. 检测结果会显示在「问题检测」区域

### 4. 导出报告

校验完成后，可以导出：

- **导出问题**: 生成 `issues.csv` 文件，包含所有检测到的问题
- **导出报告**: 生成 `section_report.md` 文件，包含详细的地层复核报告

## 数据格式说明

### contexts.csv (地层记录)

| 字段名 | 说明 | 示例 |
|--------|------|------|
| id | 地层编号 | 1, 2, H1 |
| 名称 | 地层名称 | 耕土层, 明清层 |
| 年代 | 地层年代 | 现代, 明清时期 |
| 描述 | 地层描述 | 现代耕作层... |
| 包含物 | 包含物列表，逗号分隔 | 陶片,瓷片 |
| 顶部高程 | 地层顶部海拔 | 5.0 |
| 底部高程 | 地层底部海拔 | 4.5 |
| x_min / x_max | X轴范围 | 0, 10 |
| y_min / y_max | Y轴范围 | 0, 10 |
| 叠压于 | 该地层叠压的地层编号 | 2 |
| 被叠压 | 叠压该地层的地层编号 | 1 |
| 打破 | 该地层打破的地层编号 | 2,3 |
| 被打破 | 打破该地层的地层编号 | H1 |
| 颜色 | 显示颜色 (十六进制) | #8B4513 |

### finds.json (出土物记录)

```json
[
  {
    "id": "F001",
    "name": "青花碗残片",
    "type": "陶器",
    "material": "瓷",
    "description": "明代青花碗口沿残片",
    "layer_id": "2",
    "x": 2.5,
    "y": 3.2,
    "z": 4.2,
    "elevation": 4.2,
    "condition": "较好",
    "notes": "可修复"
  }
]
```

### rules.yaml (校验规则)

```yaml
trench:
  id: T1
  name: 探方 T1
  dimensions:
    x_min: 0
    x_max: 10
    y_min: 0
    y_max: 10
    z_min: 0
    z_max: 5

validation:
  elevation:
    enabled: true
    allow_inversion: false
    tolerance: 0.01
    check_layer_order: true
    expected_order: ["1", "2", "3", "4", "5", "6"]

  relationships:
    enabled: true
    check_mutual: true
    check_cyclic: true
    validate_cut_logic: true

  coordinates:
    enabled: true
    check_bounds: true
    check_elevation_match: true
    tolerance: 0.01
    allow_orphan_finds: false
```

## 校验规则说明

### 高程校验 (Elevation Validation)

- **高程倒挂检测**: 检查地层顶部高程是否大于底部高程
- **地层顺序校验**: 验证地层是否按期望顺序排列
- **厚度检查**: 检测厚度过小的地层（可能存在数据错误）

### 关系校验 (Relationship Validation)

- **引用有效性**: 检查关系中引用的地层是否存在
- **双向关系检查**: 确保叠压/打破关系的双向记录一致
- **循环关系检测**: 检测是否存在不可能的循环依赖
- **打破逻辑验证**: 验证打破地层的高程逻辑是否合理

### 坐标校验 (Coordinate Validation)

- **探方边界检查**: 确认出土物坐标在探方范围内
- **地层范围匹配**: 验证出土物坐标是否在所属地层范围内
- **孤立出土物检测**: 检查是否有关联不存在地层的出土物

## 视图控制

界面左下角的「视图控制」面板提供以下选项：

- **显示网格线**: 显示/隐藏 X-Y 平面网格
- **显示坐标轴**: 显示/隐藏坐标轴辅助线
- **显示地层边界**: 显示/隐藏地层边界线

## 样例数据说明

样例数据包含：

- **7 个地层**: 耕土层(1)、明清层(2)、宋元层(3)、唐代层(4)、汉晋层(5)、生土层(6)、灰坑H1
- **12 件出土物**: 分布在各个地层，包括测试用的问题数据
- **预设问题**: 样例数据中故意包含了一些问题用于测试校验功能：
  - F011: X坐标越界 (15.0 超出 0-10 范围)
  - F012: 高程高于所属地层顶部 (5.5 > 3.8)

## 技术栈

- **前端框架**: 原生 JavaScript (ES6+)
- **3D 引擎**: Three.js
- **构建工具**: Vite
- **数据解析**: 
  - PapaParse (CSV)
  - yaml (YAML)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

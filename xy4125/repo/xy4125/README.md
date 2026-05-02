# 口扫咬合预检台

牙科技工室用本地3D交互校验工具，用于隐形矫治附件设计前的咬合预检。

## 功能特性

- 🦷 **3D模型可视化** - 支持STL/OBJ格式的牙列模型渲染
- 🎯 **附件位置调整** - 交互式拖动附件位置，支持吸附和轴锁定
- 🔍 **实时碰撞检测** - 包围盒碰撞检测、最小间隙计算
- ✅ **智能校验规则** - 牙位缺失检查、单位比例校验、移动路径冲突检测
- 📊 **报告导出** - 导出Markdown风险报告和CSV牙位清单
- 💾 **项目保存** - JSON格式项目导入导出

## 项目结构

```
xy4125/
├── index.html              # 主页面
├── package.json            # 项目配置
├── vite.config.js          # Vite配置
├── README.md              # 本文档
├── src/
│   ├── app.js             # 主应用程序
│   └── core/
│       ├── index.js              # 核心模块导出
│       ├── model-parser.js       # 模型解析模块 (STL/OBJ/JSON)
│       ├── geometry-calculator.js # 几何计算模块 (包围盒/碰撞/间隙)
│       ├── validation-rules.js   # 校验规则模块
│       ├── storage-exporter.js   # 存储导出模块
│       ├── interaction-state.js  # 交互状态管理
│       └── scene-manager.js      # 3D场景管理
├── data/
│   ├── maxillary-annotation.json   # 上颌示例标注
│   └── mandibular-annotation.json  # 下颌示例标注
└── tests/
    ├── run-tests.js                 # 测试运行器
    ├── test-geometry-calculator.js  # 几何计算测试
    └── test-model-parser.js         # 模型解析测试
```

## 模块说明

### 1. 模型解析模块 (model-parser.js)

负责解析各种格式的输入文件：

- **STL解析** - 支持二进制和ASCII格式STL文件
- **OBJ解析** - 支持Wavefront OBJ格式
- **牙位标注JSON解析** - 解析FDI牙位编号、附件信息、移动量

```javascript
import { ModelParser, ToothPosition } from './core/model-parser.js';

const parser = new ModelParser();

// 解析STL文件
const stlData = await parser.parseSTL(file);

// 解析标注JSON
const annotation = parser.parseToothAnnotation(jsonData);
```

### 2. 几何计算模块 (geometry-calculator.js)

提供核心几何计算功能：

- **包围盒计算** - computeBoundingBox, computeBoundingBoxFromGeometry
- **碰撞检测** - boxIntersects, boxContainsBox
- **距离计算** - computeMinimumDistance, computeBoxMinimumGap
- **最近点查找** - computeClosestPoints
- **表面积/体积计算** - computeMeshSurfaceArea, computeMeshVolume

```javascript
import { GeometryCalculator } from './core/geometry-calculator.js';

const calculator = new GeometryCalculator();

// 计算两个包围盒是否相交
const intersects = calculator.boxIntersects(boxA, boxB);

// 计算最小间隙
const gap = calculator.computeBoxMinimumGap(boxA, boxB);
```

### 3. 校验规则模块 (validation-rules.js)

实现所有校验逻辑：

| 校验类型 | 描述 | 严重程度 |
|---------|------|---------|
| 附件碰撞 | 附件与牙列模型碰撞 | ERROR |
| 间隙过小 | 附件与牙面间隙小于阈值 | WARNING/ERROR |
| 牙位缺失 | 预期牙位不存在 | INFO |
| 单位比例 | 模型单位/比例异常 | WARNING/ERROR |
| 移动路径冲突 | 两颗牙移动路径穿模 | ERROR |
| 咬合碰撞 | 上下颌模型咬合碰撞 | ERROR |

```javascript
import { ValidationRules, ValidationSeverity } from './core/validation-rules.js';

const validator = new ValidationRules();

// 运行所有校验
const results = validator.validateAll(
  annotation,
  maxillaryModel,
  mandibularModel,
  { minimumGap: 0.5, criticalGap: 0.2, unit: 'mm' }
);

// 获取校验报告
const report = validator.getValidationReport(results);
```

### 4. 存储导出模块 (storage-exporter.js)

处理项目保存和报告导出：

- **项目导入导出** - JSON格式
- **Markdown报告** - 风险评估报告
- **CSV导出** - 牙位清单、校验结果

```javascript
import { StorageExporter } from './core/storage-exporter.js';

const exporter = new StorageExporter();

// 导出项目JSON
const projectJson = exporter.exportProject(projectData);

// 导出Markdown报告
const markdown = exporter.exportMarkdownReport(projectData, validationResults);

// 导出CSV
const toothListCSV = exporter.exportCSVToothList(annotation);
```

### 5. 交互状态模块 (interaction-state.js)

管理用户交互状态：

- **交互模式** - 选择、移动附件、移动牙齿
- **吸附功能** - 可配置步长的位置吸附
- **轴锁定** - X/Y/Z轴单独锁定
- **撤销/重做** - 操作历史记录

### 6. 3D场景模块 (scene-manager.js)

基于Three.js的3D渲染：

- **场景初始化** - 相机、灯光、渲染器
- **模型加载** - 上下颌模型、附件渲染
- **视图控制** - 旋转、平移、缩放
- **预设视图** - 正面、侧面、顶面视图
- **物体选择** - 点击选择附件/牙齿

## 本地验证流程

### 1. 环境要求

- Node.js 16+
- npm 或 yarn

### 2. 安装依赖

```bash
cd /path/to/xy4125
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

服务器会在 `http://localhost:3000` 启动，浏览器会自动打开。

### 4. 快速测试

1. 点击顶部 **"加载示例"** 按钮
2. 系统会自动加载示例数据并生成合成3D模型
3. 查看3D视图区域，可以看到上下颌牙列和红色的附件
4. 底部校验面板会显示校验结果
5. 左侧牙位列表可以选择不同牙齿

### 5. 主要功能操作

#### 视图控制
- 鼠标左键拖动：旋转视图
- 鼠标右键拖动：平移视图
- 滚轮：缩放视图
- 右侧按钮：预设视图（正/侧/顶/重置）

#### 视图切换
- **双颌**：同时显示上下颌
- **上颌**：仅显示上颌
- **下颌**：仅显示下颌

#### 交互设置
- **启用吸附**：移动时按固定步长对齐
- **吸附步长**：设置吸附间隔（默认0.5mm）
- **轴锁定**：锁定X/Y/Z轴单独移动

### 6. 校验功能

1. 点击 **"运行校验"** 按钮
2. 底部面板会显示：
   - 错误（红色）：需要修复的严重问题
   - 警告（黄色）：需要注意的问题
   - 信息（蓝色）：参考信息

校验项包括：
- 牙位缺失检查
- 模型单位比例校验
- 附件碰撞检测
- 移动路径冲突检测
- 咬合间隙检查

### 7. 导出功能

#### 保存/加载方案
- **保存方案**：将当前项目导出为JSON文件
- **加载方案**：从JSON文件恢复项目

#### 导出报告
- **导出报告**：生成Markdown格式的风险评估报告
- **导出CSV**：导出牙位清单和校验结果

### 8. 运行单元测试

```bash
npm run test
```

测试会验证：
- 几何计算模块（8个测试）
- 模型解析模块（7个测试）

### 9. 构建生产版本

```bash
npm run build
```

构建产物会输出到 `dist/` 目录。

## 数据格式说明

### 牙位标注JSON格式

```json
{
  "caseId": "CASE-2026-001",
  "position": "upper",
  "unit": "mm",
  "scale": 1.0,
  "notes": "上颌矫治方案",
  "teeth": [
    {
      "id": 1,
      "fdiNumber": 11,
      "present": true,
      "hasAttachment": true,
      "attachment": {
        "type": "rectangular",
        "position": { "x": -15, "y": 10, "z": 5 },
        "size": { "x": 2.5, "y": 3, "z": 1.5 },
        "rotation": 0
      },
      "movement": {
        "translation": { "x": 0, "y": 0, "z": -1 },
        "rotation": { "x": 0, "y": 0, "z": 2 }
      },
      "meshId": "tooth_11"
    }
  ]
}
```

### FDI牙位编号说明

| 象限 | 编号范围 | 描述 |
|------|---------|------|
| 1 | 11-18 | 右上象限 |
| 2 | 21-28 | 左上象限 |
| 3 | 31-38 | 左下象限 |
| 4 | 41-48 | 右下象限 |

牙位编号（1-8）：
1. 中切牙
2. 侧切牙
3. 尖牙
4. 第一前磨牙
5. 第二前磨牙
6. 第一磨牙
7. 第二磨牙
8. 第三磨牙（智齿）

## 技术栈

- **Three.js** - 3D渲染引擎
- **Vite** - 构建工具
- **JavaScript (ES6+)** - 开发语言
- **WebGL** - GPU加速渲染

## 常见问题

### Q: 支持哪些3D模型格式？
A: 目前支持 STL（二进制/ASCII）和 OBJ 格式。

### Q: 模型单位是什么？
A: 默认使用毫米（mm），校验规则会检测单位异常。

### Q: 如何导入自己的模型？
A: 点击"导入 STL/OBJ"按钮，文件名包含 "upper" 或 "maxillary" 会被识别为上颌，否则为下颌。

### Q: 校验的阈值可以调整吗？
A: 可以在 `validation-rules.js` 中修改默认配置，或在调用 validateAll 时传入自定义参数。

## 更新日志

### v1.0.0 (2026-05-02)
- 初始版本发布
- 3D场景渲染
- STL/OBJ模型解析
- 附件位置交互调整
- 包围盒碰撞检测
- 最小间隙计算
- 牙位缺失校验
- 单位比例校验
- 移动路径冲突检测
- Markdown报告导出
- CSV牙位清单导出
- JSON项目导入导出
- 单元测试

## 许可证

MIT License

# 吊点载荷预演台

一款专为舞台机械安全员设计的本地 3D 交互工具，用于剧场换装台时的安全预演。通过可视化桁架、吊点和设备，实时计算吊点受力、重心偏移、净空碰撞和动态冲击系数，帮助用户直观发现偏载、吊点超限或设备扫到幕布等安全隐患。

## 功能特性

### 核心功能

- **3D 可视化场景**：基于 Three.js 的 WebGL 渲染，支持实时 3D 交互
- **拖拽交互**：鼠标拖动设备和桁架，实时更新位置
- **实时力学计算**：
  - 吊点受力分配（基于杠杆原理）
  - 重心位置计算（质量加权平均）
  - 偏载分析（重心偏移比率）
  - 动态冲击系数（速度/加速度影响）
- **碰撞检测**：
  - 设备与边界碰撞检测
  - 设备之间碰撞检测
  - 桁架与边界碰撞检测
  - 接近警告（安全距离检测）

### 数据管理

- **撤销/重做**：最多支持 50 步历史记录
- **导入导出**：
  - JSON 格式项目文件
  - Markdown 安全说明报告
  - CSV 载荷数据表
- **示例场景**：内置 5 个典型场景示例

### 安全校验

- 吊点超载检测（>100% 额定载荷）
- 吊点接近满载警告（>80%）
- 偏载超限检测
- 碰撞穿透检测
- 接近边界警告

## 技术栈

- **前端框架**：TypeScript + Vite
- **3D 引擎**：Three.js
- **测试框架**：Vitest
- **依赖管理**：npm
- **UI 框架**：原生 HTML/CSS/JavaScript

## 项目结构

```
xy4089/
├── src/
│   ├── __tests__/              # 单元测试
│   │   ├── models.test.ts      # 数据模型测试
│   │   └── physics.test.ts     # 力学计算测试
│   ├── models/                 # 数据模型模块
│   │   ├── types.ts            # 接口类型定义
│   │   └── index.ts            # 工厂函数和工具函数
│   ├── physics/                # 力学计算模块
│   │   └── index.ts            # 重心、吊点载荷、偏载计算
│   ├── validation/             # 校验规则模块
│   │   └── index.ts            # 综合校验和碰撞检测
│   ├── scene/                  # 3D 场景模块
│   │   ├── SceneManager.ts     # Three.js 场景管理
│   │   └── InteractiveControls.ts  # 拖拽交互控制
│   ├── state/                  # 状态管理模块
│   │   └── history.ts          # 撤销重做历史管理
│   ├── io/                     # 导入导出模块
│   │   └── index.ts            # JSON/Markdown/CSV 导入导出
│   ├── examples/               # 示例数据模块
│   │   └── index.ts            # 内置示例场景
│   └── main.ts                 # 主应用入口
├── index.html                  # 入口 HTML
├── package.json                # 项目依赖
├── tsconfig.json               # TypeScript 配置
├── vite.config.ts              # Vite 构建配置
└── README.md                   # 本文档
```

## 模块说明

### 1. 数据模型模块 (`src/models/`)

定义所有核心数据结构和工厂函数。

**主要类型**：
- `Vector3`：3D 坐标点 {x, y, z}
- `Truss`：桁架（id, name, type, length, weightPerMeter, position 等）
- `HoistPoint`：吊点（id, name, position, maxLoad, trussId 等）
- `Equipment`：设备（id, name, type, weight, dimensions, position 等）
- `StageBoundary`：舞台边界（幕布、墙体、天花板等）
- `Project`：完整项目配置
- `ValidationResult`：校验结果

**工厂函数**：
- `createTruss(options?)`：创建桁架
- `createHoistPoint(options?)`：创建吊点
- `createEquipment(options?)`：创建设备
- `createProject(options?)`：创建项目

**工具函数**：
- `cloneProject(project)`：深拷贝项目
- `getTrussWeight(truss)`：计算桁架总重量
- `getTrussCenter(truss)`：获取桁架中心点位置

### 2. 力学计算模块 (`src/physics/`)

实现所有核心力学计算算法。

**主要函数**：

**重心计算**：
```typescript
calculateCenterOfGravity(trusses: Truss[], equipment: Equipment[]): CenterOfGravityResult
```
- 基于质量加权平均计算系统重心
- 返回总质量、重心位置、桁架和设备数量

**吊点载荷计算**：
```typescript
calculateHoistPointLoads(trusses, hoistPoints, equipment, settings): HoistLoadResult[]
```
- 基于杠杆原理分配两端吊点负荷
- 多点吊点采用简化均分策略
- 计算静态载荷、动态载荷、负载比率
- 标记超载和警告状态

**偏载计算**：
```typescript
calculateUnbalance(trusses, hoistPoints, equipment, settings): UnbalanceResult
```
- 计算重心与吊点几何中心的偏移
- 返回 X/Z 方向偏载比率
- 判断是否超过安全阈值

**冲击系数计算**：
```typescript
calculateImpactFactor(settings, speed, acceleration): ImpactFactorResult
```
- 基础冲击系数：1.2（默认）
- 速度系数：1 + speed * 0.1
- 加速度系数：1 + acceleration * 0.05
- 总冲击系数：baseFactor * sqrt(speedFactor * accelerationFactor)

### 3. 校验规则模块 (`src/validation/`)

实现综合校验和碰撞检测。

**主要函数**：

**综合校验**：
```typescript
validateProject(project: Project): ValidationResult
```
- 调用所有力学计算函数
- 执行碰撞检测
- 汇总所有错误和警告

**碰撞检测**：
```typescript
detectAllCollisions(trusses, equipment, boundaries): CollisionResult[]
```
- 使用 AABB 包围盒进行碰撞检测
- 支持点到线段距离计算
- 支持多边形平面距离计算
- 返回碰撞类型、距离、穿透深度

**校验摘要**：
```typescript
getValidationSummary(validation): { errors: string[], warnings: string[], safe: boolean }
```
- 将校验结果转换为可读文本
- 用于 UI 显示和报告生成

### 4. 3D 场景模块 (`src/scene/`)

**SceneManager** 类：
- 初始化 Three.js 场景、相机、渲染器
- 设置光照（环境光 + 方向光）、地面、网格
- 管理场景对象（添加、删除、选择）
- 处理鼠标点击事件

**InteractiveControls** 类：
- 实现 3D 对象拖拽功能
- 使用 Raycaster 进行屏幕坐标到 3D 空间转换
- 支持网格吸附（可选）
- 触发拖拽开始/移动/结束事件

### 5. 状态管理模块 (`src/state/history.ts`)

**HistoryManager** 类：
- 基于命令模式的历史记录管理
- 使用 JSON 深拷贝创建状态快照
- 支持 undo/redo 操作
- 最大历史记录可配置（默认 50）

### 6. 导入导出模块 (`src/io/`)

**JSON 导入导出**：
- `exportProjectToJSON(project)`：序列化为 JSON 字符串
- `importProjectFromJSON(jsonString)`：从 JSON 反序列化
- `validateProjectJSON(jsonString)`：验证 JSON 结构有效性

**Markdown 安全报告**：
```typescript
exportSafetyNoteToMarkdown(project, validation, options?): string
```
- 项目基本信息
- 安全状态摘要
- 吊点载荷详情
- 重心分析
- 碰撞检测结果
- 建议措施

**CSV 载荷表**：
```typescript
exportLoadTableToCSV(project, validation, options?): string
```
- 吊点名称、位置、额定载荷
- 静态载荷、动态载荷、负载比率
- 超载状态

### 7. 示例数据模块 (`src/examples/`)

提供 5 个示例场景：

1. **基础示例** (`createBasicExample`)
   - 一根 6m 桁架
   - 两个吊点（额定 500kg）
   - 两台灯具（各 15kg）
   - 一个音箱（25kg）
   - 安全配置，无偏载

2. **偏载警示示例** (`createUnbalanceExample`)
   - 设备集中在桁架一端
   - 吊点载荷差异超过 20%
   - 触发偏载错误

3. **碰撞检测示例** (`createCollisionExample`)
   - 设备位置贴近边界
   - 触发接近警告或碰撞错误

4. **完整演出场景示例** (`createFullShowExample`)
   - 多根桁架
   - 多个吊点
   - 多种类型设备

5. **超载警示示例** (`createOverloadExample`)
   - 吊点额定载荷较低
   - 设备总重量超过吊点能力
   - 触发超载错误

## 快速开始

### 环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:5173` 启动。

### 构建生产版本

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

### 预览生产构建

```bash
npm run preview
```

### 运行测试

```bash
npm run test
```

或运行单次测试：

```bash
npm run test:run
```

### 类型检查

```bash
npm run typecheck
```

## 使用说明

### 基本操作

**视角控制**：
- 鼠标左键拖拽：旋转视角
- 鼠标右键拖拽：平移视角
- 鼠标滚轮：缩放

**对象选择**：
- 点击 3D 场景中的对象
- 或点击侧边栏设备列表中的项目

**对象移动**：
- 选中对象后按住鼠标左键拖拽
- 释放鼠标完成移动
- 移动操作会自动记录到历史

**撤销/重做**：
- 点击工具栏「撤销」按钮或按 `Ctrl+Z`
- 点击工具栏「重做」按钮或按 `Ctrl+Shift+Z`

**删除对象**：
- 选中对象后按 `Delete` 或 `Backspace` 键
- 或在选中对象面板点击「删除」按钮

### 工具栏功能

| 按钮 | 功能 |
|------|------|
| 新建 | 创建空白项目 |
| 导入 | 从 JSON 文件加载项目 |
| 导出 | 保存项目为 JSON 文件 |
| 报告 | 导出 Markdown 安全说明 |
| CSV | 导出 CSV 载荷数据表 |
| 撤销 | 撤销上一步操作 |
| 重做 | 重做上一步操作 |

### 侧边栏面板

**项目信息**：
- 编辑项目名称和描述
- 添加桁架、吊点、设备

**示例场景**：
- 加载内置示例场景
- 快速体验各种安全场景

**安全状态**：
- 显示整体安全状态（安全/警告/危险）
- 列出所有错误和警告信息
- 错误：红色背景，必须修复
- 警告：黄色背景，建议关注

**吊点载荷**：
- 每个吊点的载荷进度条
- 显示当前载荷 / 额定载荷
- 显示负载比率百分比
- 进度条颜色：绿色(<80%) / 黄色(80-100%) / 红色(>100%)

**重心分析**：
- 总质量
- 重心位置坐标
- 最大偏载比率

**设备列表**：
- 列出所有设备
- 显示设备名称、重量、位置
- 点击可选中对象

**选中对象**：
- 编辑选中对象的属性
- 根据对象类型显示不同字段：
  - 设备：名称、类型、重量、位置
  - 吊点：名称、额定载荷、位置
  - 桁架：名称、类型、长度、每米重量、位置

## 本地验证流程

### 步骤 1：环境检查

确保已安装 Node.js 和 npm：

```bash
node --version
npm --version
```

建议 Node.js 版本 >= 16.0.0。

### 步骤 2：安装依赖

```bash
cd /Users/mac/pro/solocoder/pro/xy4089/repo/xy4089
npm install
```

### 步骤 3：运行测试

```bash
npm run test:run
```

预期输出：
- 所有测试用例通过
- 至少 16 个测试通过（数据模型 + 力学计算）

### 步骤 4：启动开发服务器

```bash
npm run dev
```

服务器启动后，在浏览器中访问显示的 URL（通常是 `http://localhost:5173`）。

### 步骤 5：验证 3D 场景

在浏览器中：

1. **检查场景加载**：
   - 应看到 3D 网格地面
   - 应看到坐标轴（红色 X、绿色 Y、蓝色 Z）
   - 应看到默认加载的示例场景（桁架、吊点、设备）

2. **检查视角控制**：
   - 鼠标左键拖拽：场景应旋转
   - 鼠标滚轮：场景应缩放
   - 鼠标右键拖拽：场景应平移

3. **检查对象选择**：
   - 点击设备或桁架
   - 对象应高亮显示
   - 侧边栏应显示选中对象面板

4. **检查拖拽功能**：
   - 选中设备后按住左键拖拽
   - 设备应随鼠标移动
   - 释放鼠标完成移动

5. **检查实时计算**：
   - 拖拽设备时观察侧边栏「吊点载荷」面板
   - 载荷数值应实时变化
   - 进度条颜色应根据负载比率变化

### 步骤 6：验证示例场景

在侧边栏「示例场景」面板：

1. 点击「加载」按钮加载「基础桁架配置」
2. 观察安全状态应为「安全」
3. 加载「偏载警示场景」
4. 观察安全状态应为「存在安全隐患」
5. 检查吊点载荷差异

### 步骤 7：验证导入导出

1. 点击工具栏「导出」按钮
2. 下载 JSON 文件到本地
3. 点击工具栏「导入」按钮
4. 选择刚下载的 JSON 文件
5. 验证场景是否正确恢复

### 步骤 8：验证报告导出

1. 点击工具栏「报告」按钮
2. 下载 Markdown 文件
3. 用文本编辑器打开
4. 验证内容包含：
   - 项目信息
   - 安全状态
   - 吊点载荷详情
   - 重心分析
   - 如存在问题，应有建议措施

### 步骤 9：验证 CSV 导出

1. 点击工具栏「CSV」按钮
2. 下载 CSV 文件
3. 用 Excel 或表格软件打开
4. 验证包含所有吊点的载荷数据

## 测试说明

### 测试覆盖范围

**数据模型测试** (`src/__tests__/models.test.ts`)：
- Vector3 操作：创建、克隆、加减、缩放、距离、长度、归一化、相等性
- Truss 工厂：默认值、自定义值、重量计算、中心计算
- HoistPoint 工厂：默认值、自定义值
- Equipment 工厂：默认值、不同类型的默认属性
- Project 工厂：默认值、自定义值、深拷贝

**力学计算测试** (`src/__tests__/physics.test.ts`)：
- 重心计算：单桁架、仅设备、空场景
- 吊点载荷计算：居中设备均匀分配、超载检测
- 偏载计算：平衡系统检测、不平衡系统检测
- 冲击系数计算：基础系数、速度影响、加速度影响

### 运行测试

```bash
npm run test          # 监视模式
npm run test:run      # 单次运行
```

### 添加新测试

测试文件位于 `src/__tests__/` 目录，使用 Vitest 框架。

测试模板：
```typescript
import { describe, it, expect } from 'vitest';
import { yourFunction } from '../your-module';

describe('模块名称', () => {
  it('测试场景描述', () => {
    const result = yourFunction(input);
    expect(result).toBe(expected);
  });
});
```

## 力学计算原理

### 吊点载荷分配算法

**两点吊点（简化杠杆模型）**：

假设桁架上有载荷 L，作用点距离左端吊点 a 米，距离右端吊点 b 米，跨度 S = a + b。

- 左端吊点承受：L_right = L * (a / S)
- 右端吊点承受：L_left = L * (b / S)

**多点吊点**：

对于超过 2 个吊点的情况，采用简化均分策略。

### 重心计算

重心位置 = (Σ 质量 × 位置) / 总质量

```
Cx = (m1*x1 + m2*x2 + ... + mn*xn) / (m1 + m2 + ... + mn)
Cy = (m1*y1 + m2*y2 + ... + mn*yn) / (m1 + m2 + ... + mn)
Cz = (m1*z1 + m2*z2 + ... + mn*zn) / (m1 + m2 + ... + mn)
```

### 偏载检测

偏载比率 = |重心偏移| / (跨度 / 2)

当偏载比率 > 阈值（默认 20%）时触发警告。

### 动态冲击系数

动态载荷 = 静态载荷 × 冲击系数

冲击系数受以下因素影响：
- 基础系数：1.2（考虑启动/停止冲击）
- 速度系数：随移动速度增加
- 加速度系数：随加速度增加

## 安全阈值（可配置）

在 `ProjectSettings` 中可配置以下参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| gravity | 9.81 | 重力加速度 (m/s²) |
| safetyFactor | 5.0 | 安全系数 |
| dynamicImpactFactorBase | 1.2 | 基础动态冲击系数 |
| maxUnbalanceRatio | 0.2 | 最大允许偏载比率 (20%) |

## 注意事项

### 局限性

1. **简化模型**：当前力学计算采用简化模型，适用于预演评估，不作为正式工程计算依据
2. **两点吊点假设**：多点吊点载荷分配采用简化策略，实际情况可能更复杂
3. **碰撞检测**：使用 AABB 包围盒，可能存在误判或漏判
4. **无结构力学**：不计算桁架结构应力和变形

### 使用建议

1. 本工具用于**预演评估**，正式吊装前请咨询专业工程师
2. 建议在实际作业前使用本工具进行方案验证
3. 注意检查所有安全警告和错误
4. 导出报告作为作业记录存档

## 故障排除

### 常见问题

**1. 3D 场景不显示**
- 检查浏览器控制台是否有错误
- 确认 Three.js 正确加载
- 尝试刷新页面

**2. 拖拽不工作**
- 确认已选中对象
- 检查是否有其他 UI 元素遮挡
- 尝试重新加载页面

**3. 计算结果异常**
- 检查输入数据是否合理
- 确认吊点与桁架关联正确
- 检查单位是否统一（米、千克）

**4. 导入失败**
- 检查 JSON 格式是否正确
- 确认 JSON 包含必要字段
- 查看浏览器控制台错误信息

### 调试模式

在浏览器开发者工具中：
- Console 面板：查看运行时错误
- Network 面板：检查资源加载
- 使用 `console.log` 输出调试信息

## 开发指南

### 目录结构

新增模块建议放在 `src/` 目录下，使用 TypeScript 编写。

### 代码风格

- 使用严格的 TypeScript 类型
- 函数命名使用 camelCase
- 类型/接口命名使用 PascalCase
- 常量使用 UPPER_SNAKE_CASE
- 添加必要的注释说明算法原理

### 提交前检查

```bash
npm run typecheck   # 类型检查
npm run test:run    # 运行测试
npm run build       # 构建验证
```

## 许可证

本项目仅供学习和工作使用。

## 联系方式

如有问题或建议，请通过项目仓库提交 Issue。

---

**免责声明**：本工具仅用于预演评估，不构成专业工程建议。实际作业请遵循相关安全规范并咨询专业人员。

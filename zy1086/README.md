# 备餐小助手 (Meal Prep Assistant)

一款专为周末一次性备餐设计的本地桌面工具，帮助您高效规划菜谱、计算采购量、安排备料顺序、管理存储。

## 功能特性

### 📖 菜谱管理
- 保存常用菜谱，包含食材列表和详细备料步骤
- 支持为每道菜设置默认份量、备餐时间和烹饪时间
- 为每个步骤标注是否可以批量处理

### 🛒 智能采购
- 自动根据目标份数换算食材用量
- 考虑家中现有食材，计算实际需要采购的量
- 按食材分类（肉类、蔬菜、调料等）整理采购清单
- 支持导出 CSV 格式，方便导入手机备忘录

### ⏱️ 备料规划
- 自动分析步骤依赖关系，生成合理的备料顺序
- 识别可批量处理的步骤（如切菜、腌制），合并处理节省时间
- 计算每步预计耗时，帮助您规划时间

### 🧊 存储管理
- 配置冷藏和冷冻格位容量
- 跟踪每个容器的存储位置、存入日期和有效期
- 临期提醒，避免食物浪费

### ⚠️ 风险提示
- **过敏原检测**：识别菜谱中常见过敏原（花生、坚果、海鲜等）
- **重复食材**：提示多道菜共用的食材，建议合并采购
- **临期提醒**：检测即将过期的食材或容器
- **复热方式**：提示不同菜品的复热方式差异

### 📤 多种导出格式
- **Markdown 备料单**：完整的备餐计划，包含菜谱、采购清单、备料步骤、存储计划、风险提示
- **CSV 采购清单**：可直接导入 Excel 或手机备忘录
- **HTML 分装标签**：可打印的标签，包含菜谱名称、保质期、复热方式

## 技术栈

- **前端**: React 18 + TypeScript
- **桌面框架**: Electron 28
- **构建工具**: Vite 5
- **测试框架**: Vitest
- **CSV 解析**: Papa Parse

## 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 同时启动主进程和渲染进程开发服务器
npm run dev
```

### 构建应用

```bash
# 构建 TypeScript 代码
npm run build

# 启动已构建的应用
npm start
```

### 打包应用

```bash
# 打包为当前平台的可执行文件
npm run package
```

### 运行测试

```bash
npm test
```

## 使用说明

### 第一次使用

应用内置了示例数据，第一次启动时会自动创建一个示例项目，包含：

- **4道示例菜谱**：蒜香鸡胸肉、西兰花炒虾仁、番茄炒蛋、土豆炖牛肉
- **20+种食材**：包含常见肉类、蔬菜、调料
- **4个存储格位**：冷藏2个，冷冻2个
- **1个示例项目**：周末备餐计划 - 下周午餐

### 工作流程

1. **管理菜谱**：在「菜谱管理」页面添加您常做的菜品
   - 填写菜品基本信息（名称、份量、时间）
   - 添加食材列表（名称、用量、单位、备注）
   - 添加备料步骤（描述、预计时间、是否可批量、依赖关系）
   - 设置存储信息（冷藏/冷冻、保质期、复热方式）

2. **创建备餐项目**：在「备餐项目」页面创建新项目
   - 填写项目名称、描述、目标日期
   - 选择想要准备的菜谱
   - 为每道菜设置目标份数（会自动换算用量）
   - 输入家中现有食材（系统会自动从采购清单中扣除）

3. **一键生成**：在项目详情页点击「一键生成」
   - 自动计算采购清单
   - 自动生成备料计划
   - 自动检查风险提示

4. **导出并执行**：
   - 导出采购清单去购物
   - 按照备料计划准备食材
   - 分装后打印标签贴在容器上

## 数据模型

### 菜谱 (Recipe)
```typescript
{
  id: string;
  name: string;
  description?: string;
  servings: number;           // 基础份量
  prepTimeMinutes: number;    // 备餐时间（分钟）
  cookTimeMinutes: number;    // 烹饪时间（分钟）
  ingredients: RecipeIngredient[];
  prepSteps: PrepStep[];
  storageInstructions: {
    storageType: 'refrigerated' | 'frozen';
    shelfLifeDays: number;
    reheatMethod: 'microwave' | 'stovetop' | 'oven' | 'none';
  };
  category: string;
  tags: string[];
}
```

### 备料步骤 (PrepStep)
```typescript
{
  id: string;
  stepNumber: number;
  description: string;
  estimatedMinutes: number;
  canBatch: boolean;           // 是否可批量处理
  dependencies: string[];      // 前置步骤ID
  ingredients: string[];       // 涉及的食材ID
}
```

### 采购清单项 (ShoppingListItem)
```typescript
{
  ingredientId: string;
  ingredientName: string;
  totalQuantity: number;       // 总需量
  unit: string;
  existingQuantity: number;    // 已有量
  toPurchase: number;          // 需采购
  category: string;
  notes?: string;
}
```

### 风险提示 (RiskWarning)
```typescript
{
  id: string;
  type: 'allergen' | 'duplicate' | 'expiring' | 'reheat_mismatch' | 'storage_full';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  relatedItems: string[];
  suggestions?: string[];
}
```

## 本地存储

应用数据存储在用户数据目录：
- **Windows**: `%APPDATA%\meal-prep-assistant\`
- **macOS**: `~/Library/Application Support/meal-prep-assistant/`
- **Linux**: `~/.config/meal-prep-assistant/`

数据文件为 JSON 格式，可以手动备份或迁移。

## 示例数据

应用内置以下示例菜谱：

1. **蒜香鸡胸肉** - 简单快手的减脂菜品，10分钟烹饪
2. **西兰花炒虾仁** - 清爽健康的海鲜菜品，营养均衡
3. **番茄炒蛋** - 经典家常菜，酸甜可口
4. **土豆炖牛肉** - 浓郁入味的炖菜，适合冷冻保存

示例项目包含：
- 4道菜，共8份
- 考虑家中现有食材（鸡蛋、大蒜、姜、调料等）
- 自动计算需要采购的量
- 生成备料步骤和风险提示

## 开发

### 项目结构

```
src/
├── main/                    # Electron 主进程
│   ├── main.ts             # 主进程入口
│   └── store/
│       └── dataStore.ts    # 本地数据存储
├── renderer/                # React 渲染进程
│   ├── main.tsx            # React 入口
│   ├── App.tsx             # 主应用组件
│   ├── index.html          # HTML 模板
│   ├── index.css           # 全局样式
│   ├── components/         # 公共组件
│   │   └── Icons.tsx       # 图标组件
│   └── pages/              # 页面组件
│       ├── Dashboard.tsx           # 仪表盘
│       ├── RecipesPage.tsx         # 菜谱管理
│       ├── ProjectsPage.tsx        # 项目列表
│       ├── ProjectDetailPage.tsx   # 项目详情
│       ├── IngredientsPage.tsx     # 食材库
│       ├── StoragePage.tsx         # 存储管理
│       └── SettingsPage.tsx        # 设置
├── preload/                 # 预加载脚本
│   └── preload.ts          # IPC 桥接
└── shared/                  # 共享代码
    ├── types/
    │   └── index.ts        # TypeScript 类型定义
    ├── utils/
    │   ├── unitConverter.ts       # 单位换算
    │   ├── shoppingListGenerator.ts # 采购清单生成
    │   ├── prepPlanner.ts          # 备料计划生成
    │   ├── riskDetector.ts         # 风险检测
    │   ├── storageManager.ts       # 存储管理
    │   └── exporter.ts             # 导出功能
    └── data/
        └── sampleData.ts    # 示例数据

tests/
└── utils.test.ts           # 单元测试
```

### 核心算法

#### 单位换算
- 支持重量（克、千克、毫克、盎司、磅）
- 支持体积（毫升、升、茶匙、汤匙、杯）
- 支持计数单位（个、片、瓣、束）
- 重量体积转换基于常见食材密度（面粉0.52g/ml、牛奶1.03g/ml等）

#### 步骤依赖排序
- 使用拓扑排序算法处理步骤依赖关系
- 支持并行步骤检测和合并处理建议

#### 风险检测
- 过敏原：基于食材名称关键词匹配
- 重复食材：统计多道菜共用的食材
- 临期：计算距离过期天数（默认3天内提醒）
- 复热方式：检查不同菜品的复热方式是否统一

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

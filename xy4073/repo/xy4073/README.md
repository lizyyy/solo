# 纸样排料用布预估台

为小型服装打样工作室设计的本地桌面 GUI 应用，用于纸样排料和布料预估计算。

## 功能特性

- **纸样片管理**：支持导入 JSON 或简化 SVG 格式的纸样片
- **布料设置**：维护布料宽度、纹向、缩水率、安全边距和禁放区域
- **格纹对齐**：支持格纹/条格布料的对齐要求
- **GUI 交互**：拖拽移动、旋转纸样片，滚轮缩放画布
- **实时校验**：压线（重叠）、越界、纹向不一致、格纹对齐失败、同片重复、禁放区冲突
- **自动排料**：一键自动排料，输出用布长度、余料率
- **数据持久化**：项目本地保存，支持 JSON 导入导出
- **报表导出**：Markdown 报价说明、CSV 裁片清单

## 安装要求

- Python 3.8+
- PyQt5
- svgpathtools
- shapely
- pytest (测试用)

## 安装步骤

```bash
# 1. 创建虚拟环境
python3 -m venv venv

# 2. 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或
# venv\Scripts\activate  # Windows

# 3. 安装依赖
pip install -r requirements.txt
```

## 运行程序

```bash
python main.py
```

## 全流程验证步骤

### 第一步：准备临时目录

```bash
# 创建临时工作目录
mkdir -p /tmp/nesting_test

# 进入项目目录
cd /Users/mac/pro/solocoder/pro/xy4073/repo/xy4073
```

### 第二步：运行单元测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 或运行单个测试模块
python -m pytest tests/test_geometry.py -v
python -m pytest tests/test_validation.py -v
python -m pytest tests/test_nesting.py -v
python -m pytest tests/test_persistence.py -v
```

### 第三步：启动 GUI 应用

```bash
python main.py
```

### 第四步：加载示例项目

在 GUI 中操作：
1. 点击菜单 `文件` → `新建项目`
2. 或点击菜单 `文件` → `导入` 查看可用格式

### 第五步：添加纸样片

1. 点击 `文件` → `导入裁片(JSON)` 或手动添加
2. 在属性面板设置：
   - 裁片名称
   - 数量
   - 是否可旋转
   - 纹向要求
   - 格纹对齐要求

### 第六步：设置布料参数

在布料设置面板：
1. 设置布幅宽度（如 150cm）
2. 设置纹向方向
3. 设置缩水率（经向、纬向）
4. 设置安全边距
5. 如有格纹布料，启用格纹对齐并设置格纹间距

### 第七步：手动排料

1. 在画布上点击裁片进行选择
2. 拖拽移动裁片位置
3. 点击裁片边缘的旋转手柄进行旋转
4. 观察校验面板的实时提示

### 第八步：自动排料

1. 点击工具栏的 `自动排料` 按钮
2. 观察排料结果
3. 查看状态栏显示的用布长度和余料率

### 第九步：导出数据

1. **保存项目**：`文件` → `保存项目` → 选择 `/tmp/nesting_test/project.json`
2. **导出报价单**：`文件` → `导出报价单(Markdown)`
3. **导出裁片清单**：`文件` → `导出裁片清单(CSV)`

### 第十步：验证导出文件

```bash
# 查看项目文件
cat /tmp/nesting_test/project.json

# 查看导出的文件
ls -la /tmp/nesting_test/
```

## 项目结构

```
纸样排料用布预估台/
├── main.py                    # 应用入口
├── requirements.txt           # 依赖配置
├── README.md                 # 本文档
├── models/                   # 数据模型
│   ├── __init__.py
│   ├── piece.py             # 纸样片模型
│   ├── fabric.py            # 布料设置模型
│   ├── project.py           # 项目模型
│   └── validation.py        # 校验结果模型
├── geometry/                 # 几何计算
│   ├── __init__.py
│   ├── point.py             # 点
│   ├── rectangle.py         # 矩形
│   ├── polygon.py           # 多边形
│   └── transform.py         # 坐标变换
├── validation/               # 校验规则
│   ├── __init__.py
│   └── rules.py             # 校验引擎和规则实现
├── nesting/                  # 排料算法
│   ├── __init__.py
│   └── algorithm.py         # 自动排料算法
├── persistence/              # 持久化
│   ├── __init__.py
│   └── manager.py           # 项目保存/加载
├── import_export/            # 导入导出
│   ├── __init__.py
│   ├── svg_handler.py       # SVG 处理
│   ├── markdown_handler.py  # Markdown 导出
│   └── csv_handler.py       # CSV 导出
├── gui/                      # 图形界面
│   ├── __init__.py
│   ├── main_window.py       # 主窗口
│   ├── canvas.py            # 排料画布
│   ├── property_panel.py    # 属性面板
│   ├── piece_list.py        # 裁片列表
│   └── validation_panel.py  # 校验面板
├── examples/                 # 示例数据
│   ├── __init__.py
│   └── sample_data.py       # 示例裁片
└── tests/                    # 测试
    ├── __init__.py
    ├── test_geometry.py     # 几何测试
    ├── test_validation.py   # 校验测试
    ├── test_nesting.py      # 排料测试
    └── test_persistence.py  # 持久化测试
```

## 核心模块说明

### 几何计算 (geometry)

- **Point**：二维点，支持加减乘除、旋转、镜像、距离计算
- **Rectangle**：矩形，边界计算、相交检测、合并操作
- **Polygon**：多边形，面积计算、点包含测试、边相交检测
- **Transform**：坐标变换、角度对齐、网格对齐

### 校验规则 (validation)

- **OverlapValidator**：重叠检测（压线）
- **OutOfBoundsValidator**：越界检测
- **GrainDirectionValidator**：纹向一致性校验
- **PlaidMatchValidator**：格纹对齐校验
- **DuplicatePieceValidator**：数量校验
- **NoPlaceZoneValidator**：禁放区域校验
- **ValidationEngine**：校验引擎

### 排料算法 (nesting)

- **BottomLeftNesting**：左下优先启发式排料算法
- **NestingEngine**：排料引擎包装器

### 持久化 (persistence)

- **ProjectManager**：项目的保存/加载/导入/导出 JSON

### 导入导出 (import_export)

- **SVGImporter**：解析 SVG 的 polygon/path/rect 元素
- **MarkdownExporter**：生成报价说明文档
- **CSVExporter**：导出裁片清单和排料详情

## 数据格式

### 裁片 JSON 格式

```json
{
  "id": "piece_001",
  "name": "前片",
  "quantity": 2,
  "points": [
    {"x": 0, "y": 0},
    {"x": 50, "y": 0},
    {"x": 50, "y": 70},
    {"x": 0, "y": 70}
  ],
  "can_rotate": true,
  "allow_rotate_180": true,
  "grain_direction": 0.0,
  "has_plaid_match": false
}
```

### 项目 JSON 格式

```json
{
  "name": "T 恤订单",
  "description": "客户订单 #2024001",
  "fabric_settings": {
    "width": 150.0,
    "grain_direction": 0.0,
    "shrinkage_warp": 2.0,
    "shrinkage_weft": 3.0,
    "safety_margin": 1.0
  },
  "pieces": [...],
  "placements": [...]
}
```

## 校验规则说明

| 规则 | 严重程度 | 说明 |
|------|---------|------|
| 压线 (重叠) | ERROR | 两个裁片发生碰撞 |
| 越界 | ERROR | 裁片超出布料边界 |
| 纹向不一致 | WARNING | 固定纹向裁片被旋转 |
| 格纹对齐失败 | WARNING | 格纹对齐要求未满足 |
| 数量不足/过多 | WARNING/ERROR | 裁片数量与要求不符 |
| 禁放区冲突 | ERROR | 裁片位于禁放区域内 |

## 常见问题

**Q: 自动排料时间太长？**
A: 可以减少尝试的旋转角度（默认 0°、90°、180°、270°），或减少裁片数量。

**Q: 如何实现更优的排料？**
A: 当前使用的是 Bottom-Left 启发式算法，可尝试：
1. 按面积从大到小排序
2. 尝试不同的旋转角度组合
3. 增加间隙设置

**Q: 支持什么格式的 SVG？**
A: 支持包含 `<polygon>`、`<rect>`、`<path>` 元素的 SVG 文件。

## 开发计划

- [ ] 支持更多排料算法（遗传算法、模拟退火）
- [ ] 支持 DXF 格式导入
- [ ] 实现撤销/重做功能
- [ ] 添加裁片分组管理
- [ ] 支持多布料排料
- [ ] 添加打印功能

## 许可证

MIT License

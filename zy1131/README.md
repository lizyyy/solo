# PCB 打样前预审工具

一个本地运行的 PCB 打样前预审数据分析和可视化 Web 应用，帮助小批量电路板生产前检查设计一致性和制造可行性。

## 功能特性

### 数据导入
- **board.json**: PCB 板数据（器件、焊盘、过孔、走线、丝印等）
- **bom.csv**: 物料清单
- **rules.json**: 检查规则配置
- **pick-place.csv**: 贴片坐标数据

### 2D 可视化
- 板图俯视图渲染
- 分层显示（顶层/底层）
- 区分显示：器件、焊盘、过孔、走线、丝印
- 关键网络高亮
- 板边禁布区显示
- 缩放和平移操作

### 规则检查
| 规则 | 检查内容 | 严重程度 |
|------|----------|----------|
| 走线宽度 | 检查最小线宽要求 | Critical |
| 间距检查 | 走线/焊盘/过孔间距 | Critical |
| 过孔尺寸 | 钻孔直径和环形焊盘 | Warning |
| 器件到板边 | 最小装配距离 | Warning |
| 丝印压焊盘 | 丝印与焊盘间距 | Warning |
| BOM 缺料 | 器件可用性检查 | Warning |
| 封装不匹配 | PCB 与 BOM 封装一致 | Critical |
| 极性器件方向 | 旋转角度规范 | Warning |
| 连接器朝向 | 边缘连接器朝外 | Warning |
| 高功耗散热 | 散热余量和过孔 | Warning |

### 交互功能
- 问题列表点击定位到板图
- 规则开关和阈值调整
- 问题标记：已确认、误报、待修改
- 版本保存和方案对比
- 报告导出：Markdown、HTML、JSON

## 项目结构

```
zy1131/
├── backend/
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI 主应用（API 路由）
│       ├── models.py            # 数据模型定义
│       ├── utils.py             # 工具函数
│       └── services/
│           ├── __init__.py
│           ├── rule_engine.py   # 规则检查引擎
│           └── report_generator.py  # 报告生成器
├── frontend/
│   └── index.html               # 前端单页应用
├── data/
│   ├── sample_board.json        # 示例板数据
│   ├── sample_bom.csv           # 示例 BOM
│   ├── sample_rules.json        # 示例规则
│   ├── sample_pick_place.csv    # 示例贴片数据
│   └── error_board.json         # 异常样例（含错误）
├── requirements.txt             # Python 依赖
├── test_rule_engine.py          # 自测试脚本
├── start.sh                     # 启动脚本
└── README.md
```

## 快速开始

### 方式一：使用启动脚本（推荐）

```bash
# 克隆或下载项目后，进入项目目录
cd zy1131

# 启动应用（自动安装依赖、运行测试、启动服务器）
./start.sh
```

### 方式二：手动启动

```bash
# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 运行自测试
python test_rule_engine.py

# 4. 启动后端服务
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 访问应用

启动后访问：
- **前端界面**: http://localhost:8000/static/index.html
- **API 文档**: http://localhost:8000/docs
- **API 根路径**: http://localhost:8000

## 使用指南

### 1. 导入数据

1. 打开前端界面
2. 点击「导入数据」按钮
3. 依次导入以下文件（均在 `data/` 目录下）：
   - `sample_board.json` - PCB 板数据
   - `sample_bom.csv` - BOM 数据
   - `sample_rules.json` - 规则配置
   - 可选：`sample_pick_place.csv` - 贴片数据

### 2. 运行检查

1. 导入数据后，点击「运行检查」按钮
2. 系统会自动运行所有启用的规则检查
3. 检查完成后显示问题列表和统计

### 3. 查看和定位问题

1. 在右侧「问题列表」中查看发现的问题
2. 点击任意问题项，板图会自动定位并高亮该问题
3. 问题按严重程度分级显示（红色=严重，黄色=警告）

### 4. 调整规则

1. 点击「规则配置」标签
2. 可以开关个别规则或调整参数阈值
3. 修改后重新运行检查

### 5. 标记问题状态

1. 在问题列表中，每个问题右侧有状态按钮
2. 可标记为：
   - **已确认**: 问题存在，需要处理
   - **误报**: 检查有误，忽略此问题
   - **待修改**: 计划修改

### 6. 版本对比

1. 多次运行检查会保存不同版本
2. 点击「版本管理」标签
3. 选择两个版本进行对比，查看问题差异

### 7. 导出报告

1. 点击「导出报告」按钮
2. 选择导出格式：
   - **JSON**: 结构化数据，适合程序处理
   - **Markdown**: 文档格式，适合阅读
   - **HTML**: 网页格式，带样式和交互

## 数据格式说明

### board.json 结构

```json
{
  "name": "板名",
  "version": "版本",
  "units": "mm",
  "board_outline": {
    "width": 100.0,
    "height": 80.0,
    "origin_x": 0.0,
    "origin_y": 0.0
  },
  "components": [...],     // 器件列表
  "pads": [...],           // 独立焊盘
  "vias": [...],           // 过孔
  "tracks": [...],         // 走线
  "silk_screen": [...],    // 丝印
  "net_list": [...],       // 网络列表
  "critical_nets": [...]   // 关键网络
}
```

### bom.csv 格式

```csv
Reference,PartNumber,Description,Footprint,Quantity,Manufacturer,Value,Available
C1,CAP-001,100nF Ceramic Capacitor,0603,1,Yageo,100nF,True
R1,RES-001,10k Ohm Resistor,0603,1,Yageo,10k,True
```

### rules.json 结构

```json
{
  "name": "规则集名称",
  "version": "1.0",
  "rules": [
    {
      "id": "trace_width",
      "name": "走线宽度检查",
      "category": "electrical",
      "severity": "critical",
      "enabled": true,
      "parameters": {
        "min_width": 0.15
      }
    }
  ]
}
```

## 测试说明

### 运行自测试

```bash
./start.sh test
# 或手动运行
python test_rule_engine.py
```

### 测试内容

1. **Sample Board 测试**: 使用示例数据验证规则检查
2. **Error Board 测试**: 使用含错误的数据验证问题发现
3. **Report Generation 测试**: 验证三种报告格式生成
4. **Rule Toggle 测试**: 验证规则开关功能
5. **Data Validation 测试**: 验证 Pydantic 模型

### 异常样例测试

`data/error_board.json` 包含以下故意制造的错误，用于验证检查功能：

| 错误类型 | 位置 | 说明 |
|----------|------|------|
| 走线宽度不足 | TRK1, TRK2, TRK3, TRK4 | 宽度 0.10-0.12mm < 0.15mm 要求 |
| 焊盘间距过小 | GND-PAD1 与 GND-PAD2 | 间距 0mm < 0.2mm 要求 |
| 过孔钻孔过小 | VIA1 | 0.2mm < 0.3mm 要求 |
| 过孔环形焊盘不足 | VIA2 | 0.05mm < 0.15mm 要求 |
| 器件离板边过近 | C1 (x=2mm), J1 (x=97mm) | 小于 2mm 要求 |
| 丝印压焊盘 | SS-C1 与 C1-P1 | 重叠 |
| 封装不匹配 | C1: PCB=0603, BOM=0805 | |
| BOM 缺货 | R1 | Available=False |
| 极性器件方向异常 | R1 旋转 45° | 不在 [0,90,180,270] 中 |
| LED 方向可能错误 | D1 旋转 180° | |
| 连接器朝向错误 | J1 在右边缘但旋转 0° | 应旋转 180° |
| 高功耗散热问题 | IC1 (1.2W) | 距离近、过孔不足 |

## API 参考

### 数据导入

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/import/board` | 导入 board.json |
| POST | `/import/bom` | 导入 bom.csv |
| POST | `/import/pick-place` | 导入 pick-place.csv |
| POST | `/import/rules` | 导入 rules.json |

### 规则检查

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/check/run` | 运行所有检查 |
| GET | `/check/results` | 获取所有检查结果 |
| GET | `/check/results/{version_id}` | 获取指定版本结果 |
| PUT | `/check/results/{version_id}/issues/{issue_id}` | 更新问题状态 |

### 报告导出

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/export/{version_id}/json` | 导出 JSON |
| POST | `/export/{version_id}/markdown` | 导出 Markdown |
| POST | `/export/{version_id}/html` | 导出 HTML |

### 版本对比

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/compare/{version1}/{version2}` | 对比两个版本 |

## 技术栈

- **后端**: Python 3.8+, FastAPI, Pydantic
- **前端**: 原生 JavaScript, HTML5 Canvas
- **服务器**: Uvicorn

## 常见问题

### Q: 如何添加自定义规则？

修改 `backend/app/services/rule_engine.py`，添加新的检查方法，并在 `run_all_checks()` 中注册。同时在 `rules.json` 中添加规则配置。

### Q: 支持哪些 PCB 软件导出的数据？

当前支持自定义 JSON 格式。可以根据需要编写转换器，将 KiCad、Altium、Eagle 等软件的导出数据转换为目标格式。

### Q: 如何扩展可视化功能？

前端使用 Canvas 渲染，修改 `frontend/index.html` 中的 `renderBoard()` 相关函数。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

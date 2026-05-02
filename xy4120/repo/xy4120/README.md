# 刀路干运行守门员 (G-code Guardian)

> G-code干运行检查工具 - 数控加工前的安全守门员

## 项目简介

刀路干运行守门员是一个为小型数控加工店设计的本地G-code检查工具。师傅开机前只需简单几步，就能发现程序中的潜在危险：

- 🚨 **坐标系弄错** - 行程越界检测
- 🛠️ **刀具超长/缺失** - 刀具参数检查
- 💥 **快速移动撞夹具** - 夹具碰撞检测
- ⚠️ **换刀顺序漏掉** - 程序流程检查
- 🔧 **进给/主轴异常** - 切削参数检查

## 功能特性

- **G-code解析**: 支持Fanuc、Siemens等主流G-code格式，包括模态指令
- **运动模拟**: 逐段解析G0/G1/G2/G3移动轨迹
- **规则引擎**: 多维度安全检查
- **会话管理**: 保存每次检查的状态和结果
- **报告导出**: 生成Markdown、CSV、JSON三种格式的验收报告

## 安装

### 系统要求

- Python 3.9+
- pip 或 pipx

### 安装步骤

```bash
# 克隆项目
cd xy4120

# 以可编辑模式安装
pip install -e .

# 验证安装
gcode-guardian --version
```

### 依赖安装

```bash
pip install click rich
```

## 使用方法

完整的工作流程：

```
init (初始化机床配置) 
  -> import (导入G-code/刀具/夹具/毛坯)
    -> simulate (运动模拟 + 规则检查)
      -> review (人工审核放行)
        -> report (导出验收报告)
```

### 1. 初始化项目 (init)

首次使用需要初始化机床配置：

```bash
# 使用默认配置初始化
gcode-guardian init

# 自定义机床参数
gcode-guardian init \
  --name "FANUC VMC-850" \
  --x-min -500 --x-max 500 \
  --y-min -500 --y-max 500 \
  --z-min -100 --z-max 200 \
  --max-feed 5000 \
  --max-speed 10000 \
  --safe-height 50 \
  --tool-change-height 100

# 强制重新初始化
gcode-guardian init --force
```

初始化后会在当前目录创建 `.gcode-guardian/` 目录，包含机床配置和会话存储。

### 2. 导入数据 (import)

导入G-code程序和相关配置文件：

```bash
# 基本导入
gcode-guardian import --gcode program.nc

# 完整导入（推荐）
gcode-guardian import \
  --gcode examples/sample_good.nc \
  --tools examples/tools.csv \
  --fixtures examples/fixtures.json \
  --workpiece examples/workpiece.json \
  --name "面板加工_20240115" \
  --description "铝制面板轮廓加工"
```

**支持的文件格式：**

| 类型 | 格式 | 说明 |
|------|------|------|
| G-code | .nc, .gcode | G-code程序文件 |
| 刀具表 | .csv | 刀具参数表 |
| 夹具配置 | .json | 夹具位置和边界 |
| 毛坯尺寸 | .json/.csv | 工件尺寸和原点 |

### 3. 模拟检查 (simulate)

执行运动模拟和规则检查：

```bash
# 基本检查
gcode-guardian simulate

# 显示所有违规详情
gcode-guardian simulate --show-violations

# 详细模式（显示位置和代码）
gcode-guardian simulate --verbose

# 指定会话
gcode-guardian simulate --session abc12345
```

**检查规则清单：**

| 类别 | 检查项 | 严重程度 |
|------|--------|----------|
| 行程越界 | X/Y/Z轴超出机床行程 | CRITICAL |
| 进给速度 | 超过机床最大进给 | ERROR |
| 进给速度 | 切削时进给为零 | ERROR |
| 主轴转速 | 超过机床最大转速 | ERROR |
| 主轴转速 | 切削时主轴未启动 | ERROR |
| 刀具检查 | 使用未定义刀具 | ERROR |
| 刀具检查 | 刀具长度/直径未设置 | WARNING |
| 安全高度 | 快速移动低于安全高度 | WARNING |
| 安全高度 | 换刀前未到换刀高度 | CRITICAL |
| 夹具碰撞 | 快速移动穿过夹具区域 | CRITICAL |
| 程序流程 | 缺少M30结束指令 | WARNING |
| 程序流程 | 冷却开启但未关闭 | INFO |
| 程序流程 | 主轴开启但未关闭 | INFO |

### 4. 人工审核 (review)

检查完成后可以进行人工审核：

```bash
# 列出所有违规及其审核状态
gcode-guardian review --list

# 批准单个违规
gcode-guardian review --approve 1 --reason "已知安全区域" --reviewer "李师傅"

# 拒绝多个违规
gcode-guardian review --reject 2 --reject 3

# 豁免特定违规
gcode-guardian review --waive 4 --reason "坐标系特殊设置"

# 批量批准所有违规
gcode-guardian review --all-approve

# 批量拒绝所有违规
gcode-guardian review --all-reject
```

**审核决策类型：**

- `APPROVE (批准)` - 确认安全，可以放行
- `REJECT (拒绝)` - 存在风险，需要修改程序
- `WAIVED (豁免)` - 特定情况，不影响本次加工

### 5. 导出报告 (report)

生成验收报告：

```bash
# 导出所有格式（推荐）
gcode-guardian report

# 指定输出目录和前缀
gcode-guardian report \
  --output-dir ./reports \
  --prefix "面板加工_验收"

# 仅导出特定格式
gcode-guardian report --markdown     # 仅Markdown
gcode-guardian report --csv          # 仅CSV
gcode-guardian report --json         # 仅JSON

# 指定会话
gcode-guardian report --session abc12345
```

**报告内容：**

| 格式 | 内容 | 用途 |
|------|------|------|
| Markdown | 完整报告，含表格和详情 | 打印、存档、邮件发送 |
| CSV | 违规列表表格 | 数据处理、Excel导入 |
| JSON | 完整结构化数据 | 系统集成、二次开发 |

### 6. 列出会话 (list)

查看历史会话：

```bash
# 列出所有会话
gcode-guardian list
```

## 文件格式说明

### 刀具表 CSV 格式

```csv
number,name,type,diameter,length,radius,flute_count,material,max_feed,max_speed,description
1,10mm 立铣刀,endmill,10.0,75.0,0.0,4,硬质合金,5000.0,8000.0,粗加工用立铣刀
2,6mm 钻头,drill,6.0,100.0,0.0,2,高速钢,3000.0,10000.0,标准麻花钻
```

**字段说明：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| number | int | 是 | 刀具号 (T代码) |
| name | string | 否 | 刀具名称 |
| type | string | 否 | 刀具类型: endmill/drill/facemill等 |
| diameter | float | 否 | 刀具直径 (mm) |
| length | float | 否 | 刀具长度 (mm) |
| radius | float | 否 | 圆角半径 (mm) |
| flute_count | int | 否 | 刃数 |
| material | string | 否 | 刀具材料 |
| max_feed | float | 否 | 最大进给 (mm/min) |
| max_speed | float | 否 | 最大转速 (RPM) |
| description | string | 否 | 备注 |

### 夹具配置 JSON 格式

```json
[
  {
    "name": "虎钳左钳口",
    "offset_x": -100.0,
    "offset_y": 0.0,
    "offset_z": 0.0,
    "min_x": -120.0,
    "max_x": -80.0,
    "min_y": -50.0,
    "max_y": 50.0,
    "min_z": 0.0,
    "max_z": 150.0,
    "description": "左侧虎钳固定钳口"
  }
]
```

**字段说明：**

- `min_x/max_x/min_y/max_y/min_z/max_z`: 夹具的AABB包围盒，用于碰撞检测

### 毛坯尺寸 JSON 格式

```json
{
  "name": "铝制面板 100x100x50",
  "min_x": 0.0,
  "max_x": 100.0,
  "min_y": 0.0,
  "max_y": 100.0,
  "min_z": -50.0,
  "max_z": 0.0,
  "origin_x": 0.0,
  "origin_y": 0.0,
  "origin_z": 0.0,
  "material": "6061铝合金"
}
```

## 临时目录验证流程

### 快速测试

```bash
# 1. 进入临时目录
mkdir -p /tmp/gcode-test && cd /tmp/gcode-test

# 2. 初始化
gcode-guardian init \
  --name "测试机床" \
  --x-min -100 --x-max 200 \
  --y-min -100 --y-max 200 \
  --z-min -50 --z-max 150

# 3. 复制示例文件
cp /path/to/xy4120/examples/* .

# 4. 导入有问题的程序
gcode-guardian import \
  --gcode sample_with_issues.nc \
  --tools tools.csv \
  --fixtures fixtures.json \
  --name "问题程序测试"

# 5. 运行检查
gcode-guardian simulate --show-violations

# 6. 导入正常程序
gcode-guardian import \
  --gcode sample_good.nc \
  --tools tools.csv \
  --name "正常程序测试"

# 7. 运行检查
gcode-guardian simulate

# 8. 导出报告
gcode-guardian report
```

### 预期输出示例

**有问题的程序检查结果：**

```
┌──────────────────────────────────────────────────────────┐
│ 存在严重问题，不建议直接执行                              │
│ 请使用 'gcode-guardian review' 进行人工审核             │
└──────────────────────────────────────────────────────────┘

违规统计
┌───────────────────────┬──────────┐
│ 级别                  │     数量 │
├───────────────────────┼──────────┤
│ CRITICAL (严重)       │        3 │
│ ERROR (错误)          │        5 │
│ WARNING (警告)        │        2 │
│ INFO (信息)           │        1 │
│ 总计                  │       11 │
└───────────────────────┴──────────┘
```

**正常程序检查结果：**

```
┌──────────────────────────────────────────────────────────┐
│ 所有检查通过                                              │
│ 可以使用 'gcode-guardian report' 导出验收报告           │
└──────────────────────────────────────────────────────────┘

违规统计
┌───────────────────────┬──────────┐
│ 级别                  │     数量 │
├───────────────────────┼──────────┤
│ CRITICAL (严重)       │        0 │
│ ERROR (错误)          │        0 │
│ WARNING (警告)        │        0 │
│ INFO (信息)           │        0 │
│ 总计                  │        0 │
└───────────────────────┴──────────┘
```

## 目录结构

```
xy4120/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文档
├── gcode_guardian/             # 主包
│   ├── __init__.py
│   ├── cli.py                  # CLI命令入口
│   ├── config.py               # 机床配置
│   ├── parser.py               # 解析器 (G-code/CSV/JSON)
│   ├── simulator.py            # 运动模拟器
│   ├── rules.py                # 规则引擎
│   ├── session.py              # 会话存储
│   └── reporter.py             # 报告生成器
├── examples/                   # 示例数据
│   ├── sample_good.nc          # 正常G-code示例
│   ├── sample_with_issues.nc   # 含问题G-code示例
│   ├── tools.csv               # 刀具表示例
│   ├── fixtures.json           # 夹具配置示例
│   └── workpiece.json          # 毛坯尺寸示例
└── tests/                      # 测试用例
    ├── test_parser.py          # 解析器测试
    └── test_rules.py           # 规则引擎测试
```

## 运行测试

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行特定测试文件
pytest tests/test_parser.py -v
pytest tests/test_rules.py -v

# 生成覆盖率报告
pytest tests/ --cov=gcode_guardian
```

## 注意事项

1. **坐标系**: 本工具假设使用机床坐标系 (G54-G59)，不支持局部坐标系 (G52/G92) 的自动转换
2. **循环**: 目前支持基础G代码，不支持固定循环 (G81-G89)、子程序调用 (M98/M99) 的深度解析
3. **模态**: 支持G代码模态，但不支持所有Fanuc/Siemens专用模态
4. **碰撞检测**: 仅检查快速移动(G0)与夹具的AABB包围盒相交，不支持精确的刀具形状碰撞检测

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！

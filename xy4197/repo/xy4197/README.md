# 快捷键冲突搬家员

Shortcut Conflict Migrator - 帮助设计团队在换电脑前管理和迁移快捷键配置的本地桌面GUI工具。

## 功能特性

- **多格式导入**：支持导入 VS Code、Figma、Photoshop、浏览器插件的快捷键配置（JSON/CSV/TXT/KYS格式）
- **冲突检测**：自动检测以下问题：
  - 同一快捷键被多个软件冲突占用
  - 系统保留键被覆盖
  - Mac/Windows 平台快捷键差异
  - 物理上难以按下的"不可达组合"
  - 重复宏定义
- **智能改键建议**：基于易用性、平台适配、冲突避免的智能替代方案推荐
- **人工决策**：支持手动标记保留/改键/忽略
- **本地存储**：会话自动保存，支持导入/导出会话
- **多格式导出**：
  - Markdown 迁移单
  - CSV 冲突表
  - JSON 审计包（带校验和）

## 项目结构

```
shortcut-migrator/
├── main.py                 # 主入口
├── requirements.txt        # 依赖（仅标准库）
├── setup.py               # 安装配置
├── README.md              # 本文档
├── samples/               # 示例数据
│   ├── vscode_keybindings.json
│   ├── photoshop_shortcuts.csv
│   ├── figma_shortcuts.json
│   └── browser_extension_manifest.json
├── src/
│   ├── __init__.py
│   ├── models/           # 数据模型
│   │   ├── shortcut.py    # 快捷键模型
│   │   ├── application.py # 应用模型
│   │   ├── context.py     # 上下文模型
│   │   └── conflict.py    # 冲突模型
│   ├── parsers/          # 解析器
│   │   ├── parser_factory.py  # 解析器工厂
│   │   ├── base_parser.py     # 基类
│   │   ├── vscode_parser.py   # VS Code解析器
│   │   ├── figma_parser.py    # Figma解析器
│   │   ├── photoshop_parser.py # Photoshop解析器
│   │   ├── browser_plugin_parser.py # 浏览器插件解析器
│   │   ├── json_parser.py     # 通用JSON解析器
│   │   └── csv_parser.py      # 通用CSV解析器
│   ├── rules/            # 规则引擎
│   │   ├── rule_engine.py     # 规则引擎核心
│   │   ├── conflict_detector.py # 冲突检测器
│   │   ├── platform_checker.py # 平台差异检查器
│   │   ├── unreachable_checker.py # 不可达组合检查器
│   │   └── duplicate_macro_checker.py # 重复宏检查器
│   ├── suggestions/      # 改键建议
│   │   └── key_suggester.py   # 改键建议器
│   ├── storage/          # 状态存储
│   │   └── session_storage.py # 会话存储
│   ├── exporters/        # 导出模块
│   │   ├── markdown_exporter.py # Markdown导出
│   │   ├── csv_exporter.py      # CSV导出
│   │   └── json_exporter.py     # JSON导出
│   └── gui/              # GUI界面
│       └── main_window.py      # 主窗口
└── tests/                # 测试用例
    ├── test_models.py        # 模型测试
    ├── test_parsers.py       # 解析器测试
    └── test_integration.py   # 综合测试
```

## 安装和运行

### 环境要求

- Python 3.7+
- 仅使用 Python 标准库（无需额外安装依赖）

### 运行方式

#### 方式一：直接运行主程序

```bash
cd /path/to/shortcut-migrator
python main.py
```

#### 方式二：作为模块运行

```bash
python -m src.gui.main_window
```

### 安装（可选）

```bash
pip install -e .
```

安装后可以直接运行：

```bash
shortcut-migrator
```

## 使用流程

### 第一步：导入快捷键配置

1. 点击工具栏的 **"导入配置"** 按钮，或选择菜单 `文件 > 导入快捷键配置`
2. 选择要导入的快捷键配置文件（支持多选）：
   - **VS Code**：`keybindings.json`（通常在 `~/Library/Application Support/Code/User/` 或 `%APPDATA%\Code\User\`）
   - **Figma**：导出的快捷键列表 JSON 或文本文件
   - **Photoshop**：导出的 CSV、TXT 或 KYS 文件
   - **浏览器插件**：扩展的 `manifest.json` 文件
3. 导入后会自动列出所有应用和快捷键

### 第二步：运行冲突检测

1. 点击工具栏的 **"分析冲突"** 按钮，或选择菜单 `会话 > 分析所有快捷键`
2. 系统会自动检测以下问题：
   - **冲突检测**标签页：显示同一快捷键被多个应用占用的情况
   - **平台差异**标签页：显示 Mac/Windows 平台快捷键不一致的情况
   - **不可达组合**标签页：显示物理上难以按下的组合（如过多修饰键、同手冲突）
   - **重复宏**标签页：显示重复或相似的命令绑定

### 第三步：创建迁移方案

1. 点击工具栏的 **"生成方案"** 按钮，或选择菜单 `会话 > 创建迁移方案`
2. 在 **"迁移方案"** 标签页中：
   - 选择目标平台（`all`/`mac`/`windows`）
   - 点击 **"生成建议"** 按钮，系统会自动为有问题的快捷键生成改键建议
3. 可以在改键映射表格中查看和修改建议

### 第四步：导出结果

选择以下任意一种格式导出：

#### 导出 Markdown 迁移单

菜单：`文件 > 导出 Markdown 迁移单`

导出的内容包括：
- 基本信息和统计概览
- 应用列表
- 冲突详情
- 平台差异
- 不可达组合
- 重复宏
- 改键方案
- 用户决策
- 保留键

#### 导出 CSV 冲突表

菜单：`文件 > 导出 CSV 冲突表`

可选择导出：
- 冲突表
- 快捷键列表
- 迁移方案

#### 导出 JSON 审计包

菜单：`文件 > 导出 JSON 审计包`

导出完整的审计数据，包含：
- 元数据（导出时间、版本等）
- 所有应用、上下文、快捷键数据
- 分析结果
- 迁移方案
- MD5 校验和（用于验证完整性）

### 第五步：保存会话

1. 选择菜单 `文件 > 保存会话` 或 `会话另存为...`
2. 会话会自动保存在 `~/.shortcut-migrator/sessions/` 目录
3. 下次启动时会自动恢复上次会话

## 示例数据

`samples/` 目录提供了示例数据，可以用于测试：

```bash
# 运行程序
python main.py

# 然后导入 samples/ 目录下的文件进行测试
```

示例文件：
- `vscode_keybindings.json` - VS Code 快捷键示例
- `photoshop_shortcuts.csv` - Photoshop 快捷键示例
- `figma_shortcuts.json` - Figma 快捷键示例
- `browser_extension_manifest.json` - 浏览器插件 manifest 示例

**注意**：这些示例文件中包含故意制造的冲突（如多个应用都使用 `ctrl+c`、`ctrl+s` 等），用于演示冲突检测功能。

## 运行测试

### 运行所有测试

```bash
cd /path/to/shortcut-migrator
python -m pytest tests/ -v
```

或使用 unittest：

```bash
python -m unittest discover tests/ -v
```

### 运行单个测试文件

```bash
# 模型测试
python -m pytest tests/test_models.py -v

# 解析器测试
python -m pytest tests/test_parsers.py -v

# 综合测试
python -m pytest tests/test_integration.py -v
```

## 数据模型说明

### 快捷键模型 (ShortcutKey)

快捷键字符串解析为标准化格式：

```python
# 解析快捷键
key = ShortcutKey("ctrl+shift+p")

# 属性
key.modifiers       # ['ctrl', 'shift']
key.primary_key     # 'p'
key.key_str         # 'ctrl+shift+p'

# 方法
key.has_modifier('ctrl')  # True
str(key)                  # 'ctrl+shift+p'
```

### 冲突检测规则

#### 1. 同一键冲突 (Same Key Conflict)
- 多个快捷键使用完全相同的组合键
- 严重程度：高

#### 2. 系统保留键 (System Reserved Key)
- 使用了操作系统保留的快捷键
- 如：`Ctrl+Alt+Delete`、`Cmd+Tab`、`Win+D` 等
- 严重程度：致命/高

#### 3. 不可达组合 (Unreachable Combination)
检测以下情况：
- **修饰键过多**：同时按下 4 个或更多修饰键
- **同手冲突**：修饰键和主键都在同一只手（如 `Ctrl+A`）
- **无效组合**：某些修饰键组合无法同时按下
- **主键位置**：主键位置难以触及

#### 4. 平台差异 (Platform Difference)
检测以下情况：
- **平台特定绑定**：快捷键只绑定到特定平台
- **修饰键映射问题**：Mac 和 Windows 修饰键差异（Cmd vs Ctrl）
- **平台独有键**：使用了只有特定平台才有的键
- **跨平台绑定差异**：同一命令在不同平台绑定不同

#### 5. 重复宏 (Duplicate Macro)
检测以下情况：
- **完全相同宏**：多个快捷键绑定到完全相同的命令
- **相似宏**：命令名称相似（如 copy 和 copySelection）

### 改键建议评分规则

改键建议基于以下因素评分（满分 100）：

1. **修饰键数量**（权重 30）：
   - 2 个修饰键：30 分
   - 1 个修饰键：25 分
   - 3 个修饰键：15 分

2. **主键易用性**（权重 40）：
   - 主排键（ASDF JKL;）：40 分
   - 数字键区：30 分
   - 功能键：20 分
   - 其他键：10 分

3. **修饰键组合**（权重 20）：
   - 双手组合（如 Ctrl+Shift+J）：20 分
   - 单手组合：5 分

4. **平台适配**（权重 10）：
   - 符合目标平台惯例：10 分
   - 不符合：0 分

## 常见问题

### Q1: 支持哪些应用的快捷键格式？

目前支持：
- **VS Code**：`keybindings.json` 格式（支持带注释的 JSON）
- **Figma**：导出的快捷键列表（JSON 或文本格式）
- **Photoshop**：导出的 CSV、TXT、KYS 格式
- **浏览器插件**：Chrome/Edge 扩展的 `manifest.json` 中的 `commands` 字段
- **通用格式**：任意包含 `key` 和 `command` 字段的 JSON/CSV

### Q2: 会话保存在哪里？

默认保存位置：
- **macOS/Linux**：`~/.shortcut-migrator/sessions/`
- **Windows**：`%USERPROFILE%\.shortcut-migrator\sessions\`

可以通过 `SessionStorage` 类的 `storage_dir` 参数自定义位置。

### Q3: 如何添加新的解析器？

1. 继承 `BaseParser` 类
2. 实现 `parse()` 方法
3. 在 `ParserFactory` 中注册新解析器

示例：

```python
from src.parsers.base_parser import BaseParser, ParseResult

class MyAppParser(BaseParser):
    def parse(self, file_path: str) -> ParseResult:
        # 解析逻辑
        result = ParseResult()
        result.success = True
        result.application_name = "MyApp"
        result.application_type = "myapp"
        # 添加解析到的快捷键
        return result
```

### Q4: 如何自定义系统保留键？

在 `ConflictDetector` 中可以添加自定义的系统保留键：

```python
detector = ConflictDetector()
# 添加自定义保留键
detector.system_reserved_keys.add("ctrl+shift+esc")
```

## 技术栈

- **GUI 框架**：Tkinter（Python 标准库）
- **数据格式**：JSON、CSV
- **测试框架**：pytest / unittest
- **平台支持**：Windows、macOS、Linux

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**快捷键冲突搬家员** - 让换电脑不再丢失肌肉记忆 🎯

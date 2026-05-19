# 翻译记忆版本回滚一致性排查CLI

一个用于管理翻译记忆库词条版本管理、回滚操作和一致性检查的命令行工具。

## 功能特性

- ✅ **词条版本化管理** - 每个翻译词条的多版本追踪
- ✅ **幂等导入** - 防止重复导入相同词条
- ✅ **冲突检测** - 自动检测同一Key的多活跃版本冲突
- ✅ **回滚操作** - 支持按Key或按批次回滚词条
- ✅ **回滚原因记录** - 支持多种回滚原因分类
- ✅ **双重输出格式** - 机器可读(JSON)和人可读(表格)
- ✅ **历史记录查询** - 查看词条完整版本历史
- ✅ **搜索过滤** - 按关键词、状态、语言过滤词条

## 安装

```bash
cd tm_rollback_cli
pip install -e .
```

或

```bash
pip install click tabulate
cd tm_cli
```

## 快速开始

### 1. 查看帮助

```bash
tm-cli --help
```

### 2. 导入正常数据

```bash
tm-cli import-file samples/normal_data.json
```

### 3. 检查一致性

```bash
tm-cli check
```

### 4. 回滚词条

```bash
tm-cli rollback -k nav.home -s en -t zh -r wrong_translation
```

## 命令详解

### import-file - 导入翻译词条

```bash
tm-cli import-file <文件路径> [--format table|json
```

支持从JSON文件导入翻译词条，自动检测重复和无效数据。

### rollback - 回滚单个词条

```bash
tm-cli rollback --key <key> --source-lang <lang> --target-lang <lang> --reason <reason> [--note "说明"] [--rollback-batch <批次>]
```

回滚原因可选值:
- `wrong_translation` - 翻译错误
- `mistake_import` - 误导入
- `quality_issue` - 质量问题
- `source_text_changed` - 源文本变更
- `other` - 其他

### rollback-batch - 批量回滚

```bash
tm-cli rollback-batch --batch v2.0.0 --reason wrong_translation
```

### check - 一致性检查

```bash
tm-cli check [--format table|json] [--output report.txt]
```

### history - 词条历史记录

```bash
tm-cli history --key nav.home --source-lang en --target-lang zh
```

### search - 搜索词条

```bash
tm-cli search [--keyword nav] [--status active|rollbacked] [--source-lang en] [--target-lang zh]
```

### generate-test-data - 生成测试数据

```bash
tm-cli generate-test-data normal test_normal.json
tm-cli generate-test-data dirty test_dirty.json
tm-cli generate-test-data conflict test_conflict.json
tm-cli generate-test-data empty test_empty.json
```

## 数据格式

### 词条数据格式:

```json
{
  "key": "nav.home",
  "source_lang": "en",
  "target_lang": "zh",
  "source_text": "Home",
  "target_text": "首页",
  "version_batch": "v2.0.0"
}
```

## 样例数据

- `samples/normal_data.json` - 正常格式的词条数据
- `samples/dirty_data.json` - 包含各种错误格式的脏数据
- `samples/conflict_data.json` - 可能产生冲突的多版本数据
- `samples/empty_data.json` - 空数据

## 验收测试流程

1. 导入正常数据 → 验证成功导入
2. 导入脏数据 → 验证无效数据过滤
3. 导入冲突数据 → 验证冲突检测
4. 回滚操作 → 验证状态正确更新
5. 生成报告 → 验证JSON和表格输出一致

## 项目结构

```
tm_rollback_cli/
├── tm_cli/
│   ├── __init__.py
│   ├── models.py      # 数据模型
│   ├── engine.py    # 核心逻辑
│   ├── report.py    # 报告生成
│   └── main.py      # CLI入口
├── samples/           # 样例数据
├── setup.py
├── requirements.txt
└── README.md
```

# 公益书库入库管理系统

公益书库志愿者入库管理工具，解决手工对表、ISBN校验混乱等问题。支持扫码CSV和人工备注Markdown两种导入方式，自动保留错误记录并给出修改建议，所有操作都有完整审计跟踪。

## 功能特性

- ✅ **多格式导入**: 支持扫码CSV和人工备注Markdown
- 🔍 **智能校验**: ISBN格式校验、年级/品相规范检查
- ❌ **错误保留**: 保留原始数据、错误原因和修改建议
- 📝 **审计跟踪**: 记录操作人、角色、时间，全程可追溯
- 💾 **本地持久化**: SQLite数据库，重启不丢失数据
- 📊 **批量导出**: 支持CSV和Markdown格式报告导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 导入数据

#### 导入扫码CSV

```bash
# 基本用法
npm run import examples/sample_books.csv

# 指定操作人和角色
npm run import examples/sample_books.csv -- --operator 张小明 --role 志愿者
```

#### 导入人工备注Markdown

```bash
npm run import examples/manual_notes.md -- --operator 李小红 --role 志愿者
```

### 3. 复核数据

```bash
# 查看所有导入会话
npm run review -- --list

# 查看指定会话详情
npm run review 1

# 标记错误已解决
npm run review -- --resolve 1

# 批准/拒绝书籍
npm run review -- --approve 1
npm run review -- --reject 2
```

### 4. 导出数据

```bash
# 导出书籍列表CSV
npm run export 1

# 导出错误记录CSV
npm run export 1 -- --errors

# 导出完整报告Markdown
npm run export 1 -- --report

# 查看历史会话概览
npm run export -- --report
```

## 样例数据

项目包含3个样例文件，可直接用于测试：

| 文件 | 说明 | 预期结果 |
|------|------|----------|
| `examples/sample_books.csv` | 正常数据 | 全部导入成功 |
| `examples/sample_with_errors.csv` | 包含错误数据 | 成功1条，失败4条 |
| `examples/manual_notes.md` | Markdown格式备注 | 成功2条，失败1条 |

## 字段规范

### ISBN校验规则
- ISBN-10: 10位数字，最后一位可为X
- ISBN-13: 13位纯数字
- 自动校验校验位，格式错误会给出修改建议

### 有效年级列表
一年级、二年级、三年级、四年级、五年级、六年级、
初一、初二、初三、高一、高二、高三、大学、通用

### 有效品相列表
全新、九成新、七成新、五成新、破损

## 命令参考

### import 导入命令

```bash
npm run import <文件路径> [选项]

选项:
  -o, --operator <姓名>    操作人姓名 (默认: 系统默认)
  -r, --role <角色>        角色名称 (默认: 志愿者)
```

### review 复核命令

```bash
npm run review [会话ID] [选项]

选项:
  -l, --list               列出所有导入会话
  -a, --approve <ID>       批准指定书籍
  -r, --reject <ID>        拒绝指定书籍
  -s, --resolve <ID>       标记错误为已解决
```

### export 导出命令

```bash
npm run export <会话ID> [选项]

选项:
  -e, --errors             导出错误记录CSV
  -r, --report             导出完整报告Markdown
  -o, --output <路径>      指定输出文件路径
```

## 数据存储

所有数据存储在 `data/library.db` SQLite数据库中，包含4张表：

1. **import_sessions**: 导入会话记录
2. **book_records**: 书籍详细信息
3. **error_records**: 错误记录（含原始数据和修改建议）
4. **audit_logs**: 操作审计日志

## 典型工作流程

```bash
# 1. 安装依赖
npm install

# 2. 导入扫码数据
npm run import examples/sample_with_errors.csv -- --operator 张小明

# 3. 查看导入结果和错误详情
npm run review 1

# 4. 处理错误后标记为已解决
npm run review -- --resolve 1

# 5. 导出最终上架清单
npm run export 1
```

## 注意事项

- 不需要登录大系统，完全本地运行
- 所有操作都会记录操作人、角色和时间，便于审计
- 错误记录不会自动删除，需要手动标记解决
- 数据库文件可直接备份，重启服务数据不丢失

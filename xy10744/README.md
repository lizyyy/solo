# 代码片段运行沙箱 - 日志管理控制台

一个完整的全栈应用，用于管理代码片段运行沙箱的执行日志，支持查询、回滚、对账、重试等功能。

## 功能特性

### 🔍 查询功能
- 分页查看所有执行日志
- 按状态过滤（成功/失败/超时/已回滚）
- 按编程语言过滤
- 搜索代码片段和错误信息
- 实时统计面板展示

### 🔄 重试功能
- 一键重试任意执行记录
- 保留原始记录关联关系
- 创建新的执行任务

### ↩️ 回滚功能
- 版本回滚到历史语言版本
- 回滚状态标记
- 回滚来源追踪

### ⚖️ 对账检查
- 自动检测数据不一致问题
- 检查结果与处理结果是否一致
- 检查超时标记是否准确

### 📊 导出功能
- 导出为Excel格式
- 非研发友好的字段命名
- 包含完整的执行信息

### 🚨 拦截与超时处理
- 安全拦截记录展示
- 超时处理人工介入记录
- 拦截原因详细说明

## 技术栈

### 后端
- **Python 3.x**
- **Flask** - Web框架
- **Flask-CORS** - 跨域支持
- **SQLAlchemy** - ORM
- **SQLite** - 数据库
- **pandas + openpyxl** - Excel导出

### 前端
- 原生HTML5 + JavaScript
- CSS3 Grid布局
- 响应式设计

## 项目结构

```
├── app.py              # Flask应用主文件
├── models.py           # 数据库模型和初始化
├── requirements.txt    # Python依赖
├── templates/
│   └── index.html      # 前端控制台页面
└── sandbox.db          # SQLite数据库（运行后生成）
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动应用

```bash
python app.py
```

### 3. 访问控制台

在浏览器中打开: http://localhost:5000

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 前端控制台页面 |
| GET | `/api/logs` | 获取日志列表（支持分页、过滤、搜索） |
| GET | `/api/logs/<id>` | 获取单条日志详情 |
| POST | `/api/logs/<id>/retry` | 重试执行 |
| POST | `/api/logs/<id>/rollback` | 回滚版本 |
| GET | `/api/reconcile` | 对账检查 |
| GET | `/api/export` | 导出Excel |
| GET | `/api/languages` | 获取支持的语言版本 |

## 样例数据说明

系统预置了10条样例数据，包含各种场景：

1. ✅ **Python 3.9** - 成功执行（阶乘计算）
2. ⏱️ **Python 3.10** - 无限循环超时（被拦截）
3. 🔒 **JavaScript** - 危险文件操作被安全拦截
4. 🔒 **Python** - 危险系统命令被安全拦截
5. ✅ **JavaScript** - 成功执行（斐波那契）
6. 🚨 **Python 3.11** - 人工超时处理（sleep 45秒）
7. ✅ **Java 11** - 成功执行（Hello World）
8. ❌ **Python 3.9** - 除零错误
9. 🚨 **JavaScript** - 人工监控发现异常CPU占用
10. 🔄 **Python 3.10** - 从ID=1回滚的重试记录

## 核心字段说明

| 字段 | 说明 |
|------|------|
| `language` | 编程语言 |
| `language_version` | 语言版本 |
| `code_snippet` | 代码片段 |
| `input_params` | 输入参数 |
| `result` | 原始执行结果 |
| `processed_result` | 处理后结果 |
| `status` | 执行状态 |
| `was_timeout` | 是否超时 |
| `was_intercepted` | 是否被拦截 |
| `intercept_reason` | 拦截原因 |
| `rollback_from` | 回滚来源ID |
| `rollback_to` | 回滚到版本 |

## 导出Excel字段

导出文件包含以下中文字段，方便非研发人员阅读：

- 执行时间
- 编程语言
- 语言版本
- 执行状态
- 是否超时
- 是否被拦截
- 拦截原因
- 执行耗时(ms)
- 超时设置(秒)
- 输入参数
- 执行结果
- 错误信息
- 回滚来源ID
- 回滚到版本

## 特色功能展示

### 超时人工处理
系统特别展示了超时被人工处理的场景，在日志详情中可以看到：
- `processed_result` 记录了人工处理动作
- `intercept_reason` 说明人工介入原因
- `error_message` 记录处理结果

### 结果对比
详情页展示"原始结果"和"处理后结果"的对比，便于追踪从详情页到结果分享的完整链路。

### 权限提示
页面顶部显示当前用户权限说明，明确告知可执行的操作范围。

## 开发说明

### 数据库初始化
首次运行时自动创建数据库并导入样例数据。数据库文件为 `sandbox.db`。

### 添加新的样例数据
在 `models.py` 的 `init_db()` 函数中添加新的数据条目即可。

## License

MIT

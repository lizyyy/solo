# Nginx 路由冲突检测工具

一个工程实用的命令行工具，用于检测 Nginx 配置中的 location 规则冲突、路径覆盖问题，帮助运维和开发团队在部署前发现潜在的路由问题。

## ✨ 功能特性

- **🔍 配置解析**: 递归扫描 Nginx 配置目录，解析所有 server 和 location 块
- **⚡ 路径匹配模拟**: 精确模拟 Nginx 的 location 匹配逻辑
- **📊 规则排序**: 按优先级排序所有规则，清晰展示匹配顺序
- **⚠️ 冲突检测**: 智能检测以下类型的冲突：
  - 完全相同的路径规则 (identical)
  - 被覆盖的规则 (shadowed)
  - 路径子集冲突 (subset)
  - 正则表达式重叠 (regex_overlap)
- **📝 多格式输出**:
  - 终端彩色摘要报告
  - JSON 格式结果（便于 CI/CD 集成）
  - Markdown 报告（便于分享和存档）
  - HTML 可视化报告（适合发给同事和团队）
- **📍 精确定位**: 所有问题都能追溯到原文件的具体行号
- **🧪 路径测试**: 支持测试特定路径的匹配结果

## 🚀 安装

### 方式一：直接使用（推荐快速体验）

```bash
# 克隆或下载项目
cd nginx-route-checker

# 直接运行
chmod +x nginx-route-checker
./nginx-route-checker --help
```

### 方式二：安装为系统命令

```bash
# 安装为 Python 包
pip install -e .

# 然后就可以全局使用
nginx-route-checker --help
```

### 环境要求

- Python 3.7+
- 仅使用标准库，无需额外依赖！

## 💡 快速开始

### 1. 扫描单个配置文件

```bash
nginx-route-checker --config /etc/nginx/conf.d/example.conf
```

### 2. 扫描整个配置目录

```bash
nginx-route-checker --config /etc/nginx
```

### 3. 指定输出目录

```bash
nginx-route-checker --config /etc/nginx --output ./reports
```

### 4. 测试特定路径

```bash
nginx-route-checker --config /etc/nginx --test-path /api/v1/users --test-path /static/index.html
```

### 5. 指定输出格式

```bash
# 只输出 JSON 和 HTML
nginx-route-checker --config /etc/nginx --format json,html
```

### 6. 严格模式（将警告视为错误）

```bash
nginx-route-checker --config /etc/nginx --strict
```

### 7. 完整示例

```bash
nginx-route-checker \
  --config /etc/nginx/conf.d \
  --output ./nginx-reports \
  --test-path /health \
  --test-path /api/v2/users \
  --format terminal,json,markdown,html
```

## 📁 输入目录结构

工具支持标准的 Nginx 配置目录结构：

```
/etc/nginx/
├── nginx.conf          # 主配置文件
├── conf.d/             # 站点配置目录
│   ├── api.conf
│   ├── static.conf
│   └── admin.conf
├── sites-available/    # 可选的站点目录
│   └── example.com
└── includes/           # include 的配置片段
    └── headers.conf
```

工具会自动处理 `include` 指令，递归加载引用的配置文件。

## 📊 报告输出

运行后会在输出目录生成以下文件（根据指定的格式）：

```
nginx-route-reports/
├── nginx-route-report.json      # 机器可读的 JSON 结果
├── nginx-route-report.md        # 适合 Git 存档的 Markdown
└── nginx-route-report.html      # 漂亮的 HTML 报告（可直接发邮件）
```

### JSON 报告结构

```json
{
  "generated_at": "2024-01-15T10:30:00",
  "summary": {
    "total_servers": 3,
    "total_locations": 15,
    "total_conflicts": 2,
    "error_conflicts": 1,
    "warning_conflicts": 1
  },
  "servers": [...],
  "conflicts": [...]
}
```

## ❌ 错误处理和坏数据

工具对各种异常情况有完善的处理：

### 1. 配置文件不存在

```
错误: 配置路径不存在 - /invalid/path
```

**退出码: 1**

### 2. 配置解析错误

- 无效的配置语法：记录警告并继续解析其他文件
- 不完整的括号：尽可能解析有效部分
- 编码问题：使用容错模式读取

所有解析错误会在终端输出警告，并记录在 JSON 报告中。

### 3. 发现冲突

- 错误级冲突：检测到永远不会被匹配的规则
- 警告级冲突：可能导致意外行为的重叠

**退出码: 2**（当存在错误级冲突时）

### 4. 正则表达式错误

如果 location 中的正则表达式无效：
- 在报告中标记错误状态
- 提供错误原因
- 冲突检测时跳过该规则

## 🎯 冲突类型说明

### 🔴 错误级冲突 (Error)

**被覆盖的规则 (shadowed):**
- 一个 location 规则因为优先级或顺序问题，永远不会被匹配到
- 通常发生在：更一般的前缀写在前面，且没有使用 `^~` 修饰符
- **示例**: `/api/v2` 永远不会匹配，因为 `/api` 先匹配了

### 🟡 警告级冲突 (Warning)

**完全相同的路径 (identical):**
- 两个完全相同的 location 规则
- 只有第一个会生效，第二个永远不会匹配

**路径子集冲突 (subset):**
- 一个路径是另一个路径的子集
- 例如: `/api/v1/users` 是 `/api/v1` 的子集
- 虽然能工作，但可能导致意外的行为

**正则表达式重叠 (regex_overlap):**
- 两个正则表达式可能匹配相同的路径
- 按配置顺序，先出现的正则会优先匹配

## 📖 Nginx Location 优先级参考

| 修饰符 | 类型 | 优先级 | 说明 |
|--------|------|--------|------|
| `=` | 精确匹配 | 4 (最高) | 完全匹配后停止搜索 |
| `^~` | 前缀匹配(禁用正则) | 3 | 匹配成功后不再检查正则 |
| `~` / `~*` | 正则匹配 | 2 | 按配置顺序匹配 |
| (无) | 前缀匹配 | 1 (最低) | 最长前缀优先 |

## 🔧 最佳实践建议

1. **将精确匹配放在最前面**: 使用 `=` 修饰符匹配高频路径
2. **重要前缀使用 `^~`**: 防止被后续的正则覆盖
3. **正则表达式按从特殊到一般排序**: 更具体的正则写在前面
4. **避免重复配置**: 相同的路径只配置一次
5. **定期运行检测**: 加入 CI/CD 流程，部署前自动检查

## 🤝 团队协作

生成的 HTML 报告非常适合在团队中分享：

1. 运行检测工具生成报告
2. 将 `nginx-route-report.html` 发给运维和开发同事
3. 一起讨论冲突的修复方案
4. 将修复加入开发任务

## 📝 示例配置

这里有一个包含冲突的示例配置，用于测试工具：

```nginx
# test.conf
server {
    listen 80;
    server_name example.com;

    location /api {
        # 这个会覆盖 /api/v2
        proxy_pass http://backend;
    }

    location /api/v2 {
        # 冲突：永远不会被匹配！
        proxy_pass http://new-backend;
    }

    location ~ \.php$ {
        fastcgi_pass php:9000;
    }

    location ~* \.(jpg|png)$ {
        expires 30d;
    }
}
```

运行工具会立即检测到 `/api` 和 `/api/v2` 的冲突！

## 📄 许可证

MIT License - 自由使用和修改

---

**提示**: 遇到问题？请检查报告中的文件行号，定位到具体的配置位置进行修复。

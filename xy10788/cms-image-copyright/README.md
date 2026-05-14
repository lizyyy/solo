# CMS图片版权追踪系统

一个完整的全栈应用，用于追踪CMS中图片的版权授权情况，防止版权过期导致的法律风险。

## 功能特性

- ✅ **图片上传与授权登记** - 上传图片并登记版权信息
- ✅ **授权过期监控** - 自动识别正常、即将过期、已过期图片
- ✅ **反向页面查询** - 根据图片URL查询哪些页面在使用该图片
- ✅ **图片替换管理** - 发起图片替换并记录替换前后链接
- ✅ **授权延长流程** - 人工延长版权授权期
- ✅ **重复替换幂等** - 相同替换操作不会重复执行
- ✅ **风险导出功能** - 导出Excel/CSV格式的版权风险报告
- ✅ **替换失败样例** - 包含失败的替换记录示例

## 项目结构

```
cms-image-copyright/
├── backend/
│   ├── main.py           # FastAPI主应用
│   ├── models.py         # 数据库模型
│   ├── schemas.py        # Pydantic模式
│   ├── database.py       # 数据库配置
│   ├── seed_data.py      # 测试数据脚本
│   └── requirements.txt  # Python依赖
├── frontend/
│   └── index.html        # 前端界面
└── uploads/              # 图片上传目录
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 创建测试数据（可选）

```bash
python seed_data.py
```

测试数据包含：
- 🟢 正常授权图片 (180天后过期)
- 🟡 即将过期图片 (15天后过期)
- 🔴 已过期图片 (已过期30天)
- 🔄 替换用图片
- 📄 多页面引用图片（3个页面使用）
- ❌ 失败的替换记录示例
- ✅ 成功的替换记录示例

### 3. 启动后端服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 4. 访问前端界面

直接在浏览器中打开 `frontend/index.html` 文件，或使用任意HTTP服务器：

```bash
# 使用Python内置服务器
cd frontend
python -m http.server 8080
# 然后访问 http://localhost:8080
```

## 主要API接口

### 图片管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/upload` | 上传图片并登记授权 |
| GET | `/api/images` | 获取所有图片列表 |
| GET | `/api/images/{id}` | 获取单张图片详情 |

### 使用记录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/{id}/usages` | 登记图片使用记录 |
| GET | `/api/images/{id}/usages` | 获取图片使用页面列表 |
| GET | `/api/pages/by-image-url` | 根据图片URL反向查询使用页面 |

### 替换管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/replacements/initiate` | 发起图片替换 |
| GET | `/api/replacements` | 获取替换记录列表 |

### 版权管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/copyright/extend` | 延长版权授权期 |
| GET | `/api/risk/export?format=excel` | 导出风险Excel |
| GET | `/api/risk/export?format=csv` | 导出风险CSV |

### 仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/stats` | 获取统计数据 |

### API文档

启动后端后访问 `http://localhost:8000/docs` 查看完整的Swagger API文档

## 使用说明

### 1. 查看仪表盘
- 查看图片总数、已过期、即将过期等统计数据
- 快速预览风险图片列表

### 2. 上传图片
- 填写原始CMS URL、版权方、授权类型、到期日期
- 上传图片文件

### 3. 反向查询
- 在"反向查询"页面输入图片URL
- 可查看所有使用该图片的页面列表

### 4. 替换图片
- 在图片列表中点击"替换"
- 选择要替换的页面和新图片ID
- 系统自动记录替换前后的链接

### 5. 延长授权
- 对即将过期的图片点击"延长"
- 输入新的到期日期、操作人和原因

### 6. 导出风险
- 点击导航栏的"导出风险"
- 自动下载包含所有风险图片的Excel报告

## 核心规则

1. **授权过期拦截** - 系统自动计算图片状态（正常/即将过期/已过期）
2. **同一图片多页面引用** - 支持一张图片被多个页面使用，并可单独替换
3. **人工延长授权** - 支持操作人手动延长版权有效期并记录历史
4. **重复替换幂等** - 相同(旧图ID,新图ID,页面URL)的替换只会执行一次
5. **风险导出** - 一键导出所有风险图片的详细报告

## 技术栈

- **后端**: Python 3.8+, FastAPI, SQLAlchemy, Pandas
- **数据库**: SQLite（可轻松切换为PostgreSQL/MySQL）
- **前端**: 原生HTML/CSS/JavaScript（无框架依赖）

## 数据模型

### Image（图片）
- id, original_url, file_name, file_path
- copyright_holder, license_type, copyright_expiry_date
- status, notes, 创建/更新时间

### ImageUsage（使用记录）
- id, image_id, page_url, page_title
- usage_location, is_active, 添加时间

### ReplacementRecord（替换记录）
- id, old_image_id, new_image_id, page_url
- old_url, new_url, status, initiated_by
- initiated_at, completed_at, error_message
- replacement_key（幂等校验用）

### CopyrightExtension（授权延长）
- id, image_id, previous_expiry_date, new_expiry_date
- extended_by, reason, extended_at

## 注意事项

1. 生产环境请更换为正式数据库（PostgreSQL/MySQL）
2. 建议配置定时任务定期扫描即将过期的图片
3. 可集成实际CMS API实现自动替换功能
4. 建议添加用户认证和权限控制

## License

MIT

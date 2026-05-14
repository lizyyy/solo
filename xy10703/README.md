# API密钥轮换中心

为测试负责人打造的轻量级API密钥管理系统，支持批量导入、过期策略管理、使用日志追踪和回滚开关控制。

## 功能特性

### 📊 仪表盘
- 实时统计应用总数、活跃密钥
- 即将过期密钥预警
- 失败记录和活跃风险展示

### 📱 应用管理
- 单个应用添加
- **批量JSON导入**应用账号
- 应用负责人、环境分类管理

### 🔐 密钥管理
- 密钥版本管理
- 多过期策略支持（30天/90天/180天）
- 密钥轮换自动标记旧版本为deprecated

### 📝 使用日志
- 完整操作记录追踪
- **失败原因记录**
- **详情页支持查看处理人、处理时间、处理原因**
- 分页浏览和状态筛选

### ⚠️ 风险清单
- 自动检测即将过期密钥并标记风险
- 风险等级分类（高/中/低）
- **Excel导出功能，按负责人分组**

### 🔄 回滚开关
- 应用级回滚开关控制
- 操作记录和原因留存
- 实时状态展示

## 快速开始

### 1. 安装依赖

```bash
chmod +x start.sh
./start.sh
```

或者手动安装：

```bash
pip install -r requirements.txt
```

### 2. 启动后端

```bash
cd backend
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 打开前端

直接在浏览器中打开 `index.html` 文件即可使用。

## 使用说明

### 批量导入应用

1. 进入"应用管理"标签页
2. 点击"批量导入应用"按钮
3. 可以点击"加载示例数据"查看格式
4. 粘贴JSON格式的应用列表，点击确认导入

JSON格式示例：
```json
[
    {
        "app_name": "用户认证服务",
        "app_id": "auth-service-001",
        "owner": "张三",
        "owner_email": "zhangsan@example.com",
        "environment": "production"
    }
]
```

### 查看失败日志详情

1. 进入"使用日志"标签页
2. 筛选状态为"failed"
3. 点击"查看详情"按钮
4. 可以看到完整的失败原因、操作人、操作时间等信息
5. 未处理的失败记录可以标记为已处理，并填写处理备注

### 导出风险清单

1. 进入"风险清单"标签页
2. 点击"导出风险清单"按钮
3. 系统将自动下载Excel文件
4. Excel文件按负责人分Sheet展示

## 项目结构

```
.
├── backend/
│   ├── app.py          # Flask后端主程序
│   └── models.py       # 数据模型定义
├── static/
│   ├── css/
│   │   └── style.css   # 前端样式
│   └── js/
│       └── app.js      # 前端交互逻辑
├── data/               # SQLite数据库文件目录
├── index.html          # 前端入口页面
├── requirements.txt    # Python依赖
├── start.sh           # 一键启动脚本
└── README.md
```

## API接口

### 应用管理
- `GET /api/apps` - 获取所有应用
- `POST /api/apps` - 创建新应用
- `POST /api/apps/batch` - 批量导入应用

### 密钥管理
- `GET /api/apps/<app_id>/keys` - 获取应用密钥列表
- `POST /api/apps/<app_id>/keys` - 创建新密钥版本

### 策略管理
- `GET /api/policies` - 获取所有过期策略

### 日志管理
- `GET /api/logs` - 获取操作日志（支持分页和状态筛选）
- `GET /api/logs/<log_id>` - 获取日志详情
- `POST /api/logs/<log_id>/resolve` - 标记问题已处理

### 风险管理
- `GET /api/risks` - 获取风险清单
- `GET /api/risks/export` - 导出风险Excel

### 回滚开关
- `GET /api/rollback` - 获取所有回滚开关状态
- `POST /api/rollback/<app_id>` - 设置回滚开关

### 仪表盘
- `GET /api/dashboard/stats` - 获取统计数据
- `POST /api/check-expiring` - 检查即将过期的密钥

## 技术栈

- **后端**: Flask + SQLAlchemy + SQLite
- **前端**: 原生HTML/CSS/JavaScript
- **导出**: Pandas + OpenPyXL (Excel导出)

## 注意事项

- 系统默认预置3种过期策略：90天标准、30天高安全、180天低风险
- 数据库文件自动创建在 `data/api_rotation.db`
- 首次启动会自动创建数据库表和默认策略
- 前端使用CORS跨域访问后端API

# API 发布暗门检测

## 项目简介
API 发布暗门检测系统，用于检测 API 发布过程中的安全风险，防止未授权的 API 暗门暴露。

## 核心功能
- 路由扫描：检测 API 路由暴露情况
- 认证检查：验证 API 认证策略配置
- 风险分级：根据检测结果进行风险分级
- 关闭确认：确认风险 API 是否已关闭
- 巡检报告：生成巡检报告

## 技术栈
- Python 3.10+
- FastAPI
- SQLAlchemy
- SQLite (默认，可扩展)

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```

### 访问 API 文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

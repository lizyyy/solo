# 错误码知识库维护系统

## 功能概述

这是一个完整的错误码知识库管理系统，用于替代临时脚本，提供规范化的错误码管理流程。

### 核心功能

1. **错误码录入** - 支持录入错误码、原始输入、触发接口、用户提示、处理步骤
2. **状态流转** - 待处理 → 已处理 → (已生效/已拒绝)
3. **版本管理** - 每次处理生成新版本，版本生效留痕
4. **复核流程** - 侧边抽屉式复核界面
5. **详情页面**
   - 版本列表 - 显示谁处理、何时处理、为什么处理
   - 复核记录 - 时间线展示复核历史
   - 命中统计 - 支持从列表失败徽章直接跳转到失败记录
   - 修正记录 - 处理步骤失败后的修正路径，版本生效后可修正
6. **原始输入保留** - 始终保留错误码的原始输入和处理后结果

## 项目结构

```
.
├── backend/
│   ├── main.py          # FastAPI 后端服务
│   ├── requirements.txt # Python 依赖
│   └── init_demo.py     # 演示数据初始化脚本
└── frontend/
    └── index.html       # 前端页面 (Vue + Element Plus)
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (端口 8000)
python main.py
```

后端服务启动后，可以访问 http://localhost:8000/docs 查看 API 文档

### 2. 初始化演示数据（可选）

```bash
# 在另一个终端执行
cd backend
pip install requests
python init_demo.py
```

### 3. 打开前端页面

直接用浏览器打开 `frontend/index.html` 文件即可

## 使用流程

### 标准流程

1. **录入错误码** → 点击"录入错误码"按钮，填写相关信息
2. **处理** → 点击"处理"按钮，填写处理人、处理理由，完善内容
3. **复核** → 点击"复核"按钮，复核人填写复核意见，选择通过生效或拒绝
4. **修正（可选）** → 版本生效后，如发现问题，可点击"修正此版本"进行修正

### 查看命中统计

- 在列表页，点击红色的失败次数徽章，可以直接跳转到该错误码的失败命中记录
- 在详情页的"命中统计"标签页，可以筛选查看全部/成功/失败的命中记录

## API 接口

- `POST /api/error-codes` - 创建错误码
- `GET /api/error-codes` - 获取错误码列表
- `GET /api/error-codes/{id}` - 获取错误码详情
- `PUT /api/error-codes/{id}/process` - 处理错误码
- `POST /api/error-codes/{id}/review` - 复核错误码
- `POST /api/error-codes/{id}/correct/{version_id}` - 修正生效版本
- `GET /api/error-codes/{id}/hit-stats` - 获取命中统计
- `POST /api/error-codes/{id}/hit` - 添加命中记录
- `GET /api/corrections/{id}` - 获取修正记录

## 技术栈

- **后端**: FastAPI + SQLAlchemy + SQLite
- **前端**: Vue 3 + Element Plus (CDN 方式，无需构建)

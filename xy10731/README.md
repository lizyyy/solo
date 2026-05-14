# 环境变量漂移检测系统

一个可本地运行的环境变量漂移检测API项目，支持项目环境管理、漂移检测、敏感值遮罩、修复申请等功能。

## 功能特性

- 📁 **项目环境管理**: 创建项目，添加多个环境（生产、测试、开发等）
- 🔬 **漂移检测**: 对比实际环境变量与基线，检测漂移
- 🎭 **敏感值遮罩**: 自动识别并遮罩敏感字段（password、secret、token等）
- 🔧 **修复申请**: 敏感值遮罩失败时可提交修复申请，支持复盘
- 📊 **统计卡片**: 展示总记录数、待处理、已批准、已拒绝等统计
- 📅 **时间线**: 完整记录每条检测记录的处理历史
- 🔄 **基线变更追溯**: 记录基线变更历史，相关记录自动重新计算

## 技术栈

- **后端**: Python + Flask
- **前端**: 原生 HTML + JavaScript + CSS
- **数据存储**: JSON文件（本地文件系统）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 访问页面

打开浏览器访问：`http://localhost:5000`

## 使用流程

### 步骤1: 创建项目和环境

1. 在"项目环境"标签页创建项目
2. 为项目添加环境（如：生产环境），设置环境变量基线

### 步骤2: 进行漂移检测

1. 切换到"漂移检测"标签页
2. 选择项目和环境
3. 输入实际环境变量（JSON格式）
4. 点击"开始检测"

### 步骤3: 处理检测记录

1. 在"检测记录"标签页查看所有检测结果
2. 对漂移记录进行批准或拒绝操作
3. 如有敏感值遮罩失败，可提交修复申请
4. 点击"查看详情"查看完整信息和时间线

### 步骤4: 查看基线变更

在"基线变更"标签页查看所有基线修改历史

## API接口文档

### 项目管理

- `GET /api/projects` - 获取所有项目
- `POST /api/projects` - 创建新项目
  ```json
  {
    "name": "项目名称",
    "description": "项目描述"
  }
  ```

### 环境管理

- `POST /api/projects/<project_id>/envs` - 添加环境
  ```json
  {
    "name": "环境名称",
    "variables": {
      "DB_HOST": "localhost",
      "API_KEY": "secret"
    }
  }
  ```
- `PUT /api/projects/<project_id>/envs/<env_id>/baseline` - 更新基线
  ```json
  {
    "variables": {
      "DB_HOST": "new-host",
      "API_KEY": "new-secret"
    }
  }
  ```

### 漂移检测

- `POST /api/detect` - 执行漂移检测
  ```json
  {
    "project_id": "项目ID",
    "env_id": "环境ID",
    "actual_variables": {
      "DB_HOST": "actual-host",
      "API_KEY": "actual-secret"
    }
  }
  ```

### 记录管理

- `GET /api/drifts` - 获取所有检测记录
- `GET /api/drifts/<record_id>` - 获取单条记录详情
- `POST /api/drifts/<record_id>/approve` - 批准漂移
- `POST /api/drifts/<record_id>/reject` - 拒绝漂移
  ```json
  {
    "reason": "拒绝理由"
  }
  ```

### 修复申请

- `POST /api/drifts/<record_id>/repair-request` - 提交修复申请
  ```json
  {
    "reason": "修复理由"
  }
  ```
- `POST /api/drifts/<record_id>/repair-request/handle` - 处理修复申请
  ```json
  {
    "status": "approved/rejected",
    "handling_reason": "处理理由"
  }
  ```

### 统计和变更

- `GET /api/statistics` - 获取统计数据
- `GET /api/baseline-changes` - 获取基线变更历史

## 数据存储

所有数据存储在 `data/` 目录下的JSON文件中：

- `projects.json` - 项目和环境数据
- `drift_records.json` - 漂移检测记录
- `baseline_changes.json` - 基线变更历史

## 注意事项

1. 重复点击操作按钮时会有防重复提交保护
2. 刷新页面后状态保持不变（数据持久化）
3. 基线更新后，相关历史记录会自动重新计算漂移状态
4. 修复申请的处理理由会被完整记录用于复盘

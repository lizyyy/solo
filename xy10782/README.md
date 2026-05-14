# 音频质检标注后台系统

基于 FastAPI + Vue3 的全栈音频质检标注管理系统

## 功能特性

### 核心功能
- 📊 **质检流程管理**: 支持成功、拦截、补偿、人工复核四种处理路径
- 🏷️ **噪声标签**: 标签变化后自动触发质检重新计算
- 📝 **转写文本**: 支持编辑和查看转写内容
- 📈 **抽检比例**: 可配置每条记录的抽检比例

### 页面功能
- **质检列表**: 查看所有音频记录，支持按状态筛选
- **详情页面**: 查看完整信息，包含时间线和审批记录
- **导出面板**: 按条件导出Excel，支持历史记录下载
- **统计分析**: 查看质检统计数据

### 数据持久化
- SQLite 数据库存储所有记录
- 重启服务后历史记录完整保留
- 导出文件保存在后端 exports 目录

## 项目结构

```
.
├── backend/                 # FastAPI 后端
│   ├── main.py             # 主应用入口
│   ├── database.py         # 数据库模型
│   ├── schemas.py          # Pydantic 模型
│   ├── requirements.txt    # Python 依赖
│   └── .env               # 环境变量
├── frontend/               # Vue3 前端
│   ├── src/
│   │   ├── views/         # 页面组件
│   │   ├── router/        # 路由配置
│   │   ├── api/           # API 封装
│   │   ├── App.vue        # 根组件
│   │   └── main.js        # 入口文件
│   ├── package.json       # Node 依赖
│   └── vite.config.js     # Vite 配置
└── README.md
```

## 快速开始

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 启动服务 (端口 8000)
python main.py
```

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器 (端口 3000)
npm run dev
```

### 访问应用

打开浏览器访问: http://localhost:3000

## API 接口文档

启动后端后访问: http://localhost:8000/docs

## 质检流程说明

1. **创建记录**: 添加音频文件信息
2. **更新噪声标签**: 修改标签后自动重新计算
3. **质检处理**:
   - ✅ 质检通过: 标记为成功
   - ❌ 质检拦截: 标记问题并记录原因
   - 🔄 补偿处理: 需要特殊补偿的情况
   - 👀 人工复核: 需要人工再次检查
4. **查看时间线**: 完整追踪所有操作记录
5. **导出数据**: 按条件导出汇总报表

## 技术栈

### 后端
- FastAPI - 高性能 Web 框架
- SQLAlchemy - ORM 框架
- SQLite - 数据库
- Pandas + OpenPyXL - Excel 导出

### 前端
- Vue 3 - 渐进式 JavaScript 框架
- Vue Router - 路由管理
- Pinia - 状态管理
- Element Plus - UI 组件库
- Axios - HTTP 客户端
- Vite - 构建工具

# ♿ 无障碍检查修复台

面向平台工程师的无障碍问题管理系统，替代临时脚本，支持问题录入、复核留痕、报告生成。

## ✨ 功能特性

### 核心功能
- **筛选表格**: 按页面路径、状态、规则类别多维度筛选问题
- **复核抽屉**: 快捷进行复核操作，记录处理人、处理理由
- **详情页面**: 从列表跳转至详情，完整展示问题信息
- **复核留痕**: 时间线展示所有复核记录，状态变更可追溯
- **修正路径**: 修复失败时，可重新指派并记录修正方案

### 数据字段
- **页面路径**: 保存原始输入和处理后结果，便于追踪
- **规则项**: WCAG 标准规则，支持分类管理
- **截图定位**: 问题截图 + CSS 选择器定位
- **修复建议**: 针对性修复指导
- **处理信息**: 处理人、处理时间、处理理由
- **复核记录**: 复核人、复核时间、状态变更、复核意见

## 🚀 快速启动

### 方式一：一键启动
```bash
chmod +x start.sh
./start.sh
```

### 方式二：手动启动

#### 启动后端
```bash
cd backend
pip install -r ../requirements.txt
python main.py
```
- 后端地址: http://localhost:8000
- API文档: http://localhost:8000/docs

#### 启动前端
```bash
cd frontend
npm install
npm run dev
```
- 前端地址: http://localhost:5173

## 📁 项目结构

```
.
├── backend/                 # 后端 FastAPI
│   └── main.py             # API 服务
├── frontend/               # 前端 Vue3
│   ├── src/
│   │   ├── views/
│   │   │   ├── IssueList.vue    # 列表页
│   │   │   └── IssueDetail.vue  # 详情页
│   │   ├── App.vue
│   │   ├── main.js
│   │   └── router.js
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── requirements.txt        # Python 依赖
├── start.sh               # 一键启动脚本
└── README.md
```

## 🔄 状态流转

```
待处理 → 处理中 → 已修复 ←→ 已复核
                  ↓
             修复失败（可重新回到处理中）
```

## 📊 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/issues | 获取问题列表（支持筛选） |
| GET | /api/issues/{id} | 获取问题详情 |
| POST | /api/issues | 创建新问题 |
| PUT | /api/issues/{id} | 更新问题（含复核） |
| GET | /api/stats | 获取统计数据 |
| GET | /api/report/{page_path} | 生成页面报告 |

## 🎯 使用说明

1. **列表筛选**: 在顶部筛选条件输入页面路径或选择状态，点击查询
2. **查看详情**: 点击列表中的"查看详情"，进入详情页
3. **复核操作**: 
   - 列表页点击"复核"打开侧抽屉
   - 或在详情页点击"进行复核操作"
4. **修复失败处理**: 在详情页右侧填写修正方案，重新指派处理人
5. **生成报告**: 在详情页点击"查看该页面无障碍报告"

## 🛠️ 技术栈

- **后端**: FastAPI + Pydantic
- **前端**: Vue 3 + Ant Design Vue + Vite
- **路由**: Vue Router
- **HTTP**: Axios

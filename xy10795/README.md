# 项目风险周报生成器

## 项目结构

```
.
├── backend/          # Python FastAPI 后端
├── frontend/         # Vue 3 前端
└── README.md
```

## 快速开始

### 后端启动

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

## 功能特性

- 项目里程碑录入与管理
- 风险条目跟踪与负责人反馈
- 周报版本留痕与发送记录
- 复核抽屉功能
- 状态幂等性控制
- 延期原因修正路径

# 幕墙节点碰撞预审系统

前后端一体化的幕墙节点碰撞预审平台。前端 React + Vite，后端 FastAPI + SQLite。

## 快速启动

### 方式一：分别启动（推荐开发用）

```bash
# 1. 启动后端（新终端）
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
# 启动后自动创建数据库并初始化 12 条样例数据
```

```bash
# 2. 启动前端（新终端）
npm install
npm run dev
# 浏览器访问 http://localhost:5173
```

### 方式二：一条命令全启动（需 tmux）

```bash
./scripts/start-all.sh
```

## 功能一览

| 功能 | 说明 |
|------|------|
| 碰撞列表 | 分页展示、状态筛选、项目/楼层筛选、关键词搜索 |
| 汇总卡片 | 总碰撞数、已放行、待补证据、人工改过、坐标偏移异常 |
| 详情页 | 四视角截图、线索链、基本信息、初判结论 |
| 改判 | 改判写入数据库、记录历史（原结论/新结论/原因/操作人/时间） |
| 历史记录 | 时间线展示所有改判历史，可追溯 |
| CSV 导出 | 后端生成、UTF-8 BOM 兼容中文、包含坐标偏移和历史摘要 |
| 坐标偏移标记 | 列表特殊样式、详情独立区块、CSV 专门列 |
| 样例标记 | 可标记为样例供新人参考 |

## 技术栈

**前端**：React 18 + TypeScript + Vite 5 + Zustand + TailwindCSS 3 + Lucide React

**后端**：FastAPI 0.115 + SQLAlchemy 2 + SQLite + Pydantic 2

## 数据库

- 位置：`backend/data/curtain_wall.db`
- 首次启动自动初始化 12 条样例数据（3 项目 × 4 楼层）
- 包含 3 条坐标偏移样本、2 条样例标记、多条历史改判记录

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/collisions/summary` | 汇总统计 |
| GET | `/api/collisions` | 列表（支持 status/coordinateOffsetOnly/keyword/project/floor） |
| GET | `/api/collisions/projects` | 项目列表 |
| GET | `/api/collisions/floors` | 楼层列表 |
| GET | `/api/collisions/{id}` | 详情 |
| GET | `/api/collisions/{id}/history` | 历史记录 |
| POST | `/api/collisions/{id}/rejudge` | 改判（写历史） |
| PATCH | `/api/collisions/{id}/sample` | 切换样例标记 |
| GET | `/api/collisions/export/csv` | CSV 明细导出 |

## 代码检查

```bash
npm run lint    # ESLint 检查
npm run check   # TypeScript 类型检查
```

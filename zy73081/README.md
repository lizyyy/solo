# 幕墙节点碰撞预审系统

前后端一体化的幕墙节点碰撞预审平台。前端 React + Vite，后端 FastAPI + SQLite。

## 快速启动

### 方式一：一键启动（推荐）

```bash
./scripts/start-all.sh
```

自动完成：安装依赖 → 初始化数据库 → 启动后端 → 启动前端 → 打印访问地址。
按 `Ctrl+C` 同时停止所有服务。

### 方式二：分别启动

```bash
# 1. 启动后端（新终端）
cd backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --port 8000
# 首次启动自动创建数据库并初始化 12 条样例数据
```

```bash
# 2. 启动前端（新终端）
npm install   # postinstall 自动修复 Node v24 rollup 签名问题
npm run dev   # 浏览器访问 http://localhost:5173
```

## 功能一览

| 功能 | 说明 |
|------|------|
| 碰撞列表 | 状态筛选、项目/楼层筛选、关键词搜索 |
| 汇总卡片 | 总碰撞数、已放行、待补证据、人工改过、坐标偏移异常 |
| 详情页 | 四视角截图、线索链、基本信息、初判结论 |
| 坐标偏移标记 | 列表特殊样式、详情独立区块、CSV 专门列 |
| 改判 | 写入数据库、记录历史（原状态/新状态/原因/操作人/时间） |
| 历史记录 | 时间线展示所有改判历史，可追溯 |
| CSV 导出 | 后端生成、UTF-8 BOM 兼容中文、包含原始结论/最近改判/历史摘要 |
| 样例标记 | 可标记为样例供新人参考 |

> **关于"人工改过"**：统一按**改判次数 > 0**判断，即只要发生过人工改判就算。
> 当前状态仍保留原值（已放行/待补证据/驳回等），不会被覆盖。

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

## CSV 导出字段（20 列）

1. 碰撞编号
2. 是否样例
3. 项目
4. 楼层
5. 节点编号
6. 碰撞类型
7. 构件A
8. 构件B
9. 当前状态
10. 改判次数
11. 坐标偏移异常
12. 异常说明
13. 负责人
14. 初判结论（原始结论）
15. 最近改判原因
16. 最近改判人
17. 最近改判时间
18. 创建时间
19. 修改时间
20. 历史操作摘要

## 代码检查

```bash
npm run lint    # ESLint 检查
npm run check   # TypeScript 类型检查
```

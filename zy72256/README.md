# 校园建筑日照阴影 - 坐标原点说明审计追踪系统

## 启动命令

```bash
npm install          # 安装依赖
npm run dev          # 同时启动前端(Vite :5173)和后端(Express :3001)
npm run build        # 构建前端
npm run check        # TypeScript 类型检查
```

## 测试数据导入

```bash
# 创建测试 CSV
printf 'building_name,coordinate_origin_description\n教学楼A,东经116.4°北纬39.9°\n实验楼B,X=35000m Y=21000m\n图书馆C,东经116.4° X=35000m\n体育馆D,坐标原点位于操场东南角' > test.csv

# 通过 API 导入
curl -F "file=@test.csv" -F "operator=老梁" http://localhost:3001/api/import

# 教官复核（保留混合坐标）
curl -X POST http://localhost:3001/api/review \
  -H 'Content-Type: application/json' \
  -d '{"record_id":"<RECORD_ID>","operator":"老梁","inspection_photo_id":"XC-2024-003","retention_reason":"巡检照片显示该建筑同时标注经纬度和米制坐标","action":"retain"}'

# 巡检组确认
curl -X POST http://localhost:3001/api/confirm \
  -H 'Content-Type: application/json' \
  -d '{"record_id":"<RECORD_ID>","operator":"巡检组张工"}'
```

## 三步工作流

1. **首次导入** → 系统自动检测坐标类型，混合坐标标记为"待复核"
2. **教官复核** → 老梁补看巡检照片编号，对混合坐标填写保留理由（不自动归正常）
3. **班组查阅** → 现场班组查看说明总览，点开混合坐标可看到老梁保留理由

## 边界规则

以下规则在代码、数据库和本 README 三处同源，修改时须同步更新。

### 判断规则（detection）

| 规则名 | 描述 | 代码位置 |
|--------|------|----------|
| MIXED_COORDINATE_DETECTION | 当同一记录中同时出现经纬度标识（E/W/N/S、东经/西经/北纬/南纬、度数符号°）和米制坐标标识（m/米、大数值无度符号）时，判定为混合坐标类型 | `api/services/coordinateDetector.ts` → `detectCoordinateType` |
| DEFAULT_COORDINATE_TYPE | 无法识别坐标类型时默认为米制坐标，但保留原描述供人工复核 | `api/services/coordinateDetector.ts` → `detectCoordinateType` |

### 修改规则（correction）

| 规则名 | 描述 | 代码位置 |
|--------|------|----------|
| MIXED_RETAIN_REQUIRE_REASON | 混合坐标记录不可自动归为正常，必须由教官填写保留理由后才可推进状态 | `api/routes/review.ts` → `postReview` |
| CORRECTION_MUST_LOG | 任何坐标类型修正操作必须在审计日志中记录修正前后的值 | `api/services/auditService.ts` → `createAuditLog` |

### 回滚规则（rollback）

| 规则名 | 描述 | 代码位置 |
|--------|------|----------|
| ROLLBACK_RESTORE_SNAPSHOT | 回滚操作将记录恢复到目标审计日志的快照状态，回滚本身也记入审计日志 | `api/services/auditService.ts` → `rollbackToSnapshot` |
| ROLLBACK_INSPECTOR_ONLY | 只有巡检组(inspector)角色可以执行回滚操作 | `api/routes/audit.ts` → `postRollback` |

### 经纬度与米制坐标混合——判断/修改/回滚流程

**判断**：`detectCoordinateType()` 检测描述文本，同时命中经纬度特征和米制坐标特征则标记为 `mixed`。

**修改**：
- 教官复核时，`mixed` 类型记录必须填写 `retention_reason`，否则 400 拒绝
- 教官可选择 `retain`（保留，状态→待巡检组复核）或 `correct`（修正类型，状态→已修正）
- 修正操作通过 `createAuditLog` 记录前后值快照

**回滚**：
- 仅 `inspector` 角色可执行回滚
- 回滚从 `audit_logs.snapshot` 恢复记录到目标历史状态
- 回滚操作本身也写入审计日志

## 数据存储

- SQLite 数据库文件：`data/shadow.db`（首次启动自动创建）
- 删除此文件即可重置所有数据

## 项目结构

```
api/                     # 后端
  routes/                # API 路由
    records.ts           # 记录 CRUD + CSV 导入 + 统计
    review.ts            # 复核工作流
    audit.ts             # 审计日志 + 回滚
    rules.ts             # 边界规则查询
    photos.ts            # 巡检照片关联
  services/
    coordinateDetector.ts # 坐标类型检测引擎
    auditService.ts      # 审计日志服务
    boundaryRules.ts     # 边界规则常量
  database.ts            # 数据库初始化 + 种子数据
  app.ts                 # Express 主文件
  server.ts              # 本地开发入口

src/                     # 前端
  pages/                 # 页面组件
    Dashboard.tsx         # 首页仪表盘
    ImportPage.tsx        # 数据导入页
    ReviewPage.tsx        # 教官复核页
    BriefingPage.tsx      # 班组说明页
    AuditPage.tsx         # 审计追踪页
    RulesPage.tsx         # 边界规则页
  components/
    Layout.tsx            # 主布局（侧边栏+内容区）
    StatusBadge.tsx       # 状态徽章
    TypeBadge.tsx         # 坐标类型徽章
    DetailPanel.tsx       # 侧滑详情面板
  store.ts               # Zustand 状态管理

shared/
  types.ts               # 共享类型定义 + 标签映射
```

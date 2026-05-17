# 数据标注平台任务包拆分返工 API

## 项目结构

```
.
├── src/
│   ├── app.js          # 应用入口
│   ├── database.js     # 数据库初始化
│   ├── constants.js    # 状态、原因等常量定义
│   ├── services.js     # 业务逻辑
│   └── routes.js       # API 路由
├── scripts/
│   └── seed.js         # 造数脚本
├── tests/
│   └── run.js          # 测试脚本
├── data/               # SQLite 数据库文件目录
├── package.json
└── README.md
```

## 核心数据模型

- **项目 (Project)**: 标注项目
- **任务包 (TaskPackage)**: 待标注的任务包，包含原始标注员信息
- **标注员 (Annotator)**: 进行标注的人员
- **返工记录 (ReworkRecord)**: 任务包拆分后的返工分配记录
- **状态历史 (StatusHistory)**: 记录所有状态变更

## 状态定义

| 状态值 | 中文名称 | 说明 |
|--------|----------|------|
| pending_assign | 待分配 | 记录已创建，等待分配标注员 |
| annotating | 标注中 | 标注员正在进行标注 |
| reworking | 返工中 | 发现问题，正在返工修改 |
| accepted | 已验收 | 返工完成，验收通过 |
| pending_manual | 待人工处理 | 检测到冲突，需要人工干预 |

## 冲突规则

**同一任务包拆分后重复发给原标注员时：**
1. 返回可解释的冲突原因
2. 记录自动进入 `待人工处理` 状态
3. 冲突信息保存在 `conflict_info` 字段中

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动，API 前缀为 `/api`

### 3. 造数

```bash
npm run seed
```

此命令会创建测试用的项目、标注员和任务包，并输出各实体的 ID，方便后续测试。

### 4. 运行测试

```bash
npm test
```

测试包含以下场景：
- ✅ 完整状态流转：待分配 → 标注中 → 返工中 → 已验收
- ✅ 冲突检测：原标注员重新分配时自动进入待人工处理
- ✅ 导入坏行：必填项检查、状态流转校验
- ✅ 数据一致性：列表、详情、历史、导出数据互相对应

---

## API 调用示例 (curl)

### 健康检查

```bash
curl http://localhost:3000/api/health
```

### 获取常量定义

```bash
curl http://localhost:3000/api/constants
```

### 创建项目

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "图像标注项目"}'
```

### 创建标注员

```bash
curl -X POST http://localhost:3000/api/annotators \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "email": "zhangsan@example.com"}'
```

### 创建任务包

```bash
curl -X POST http://localhost:3000/api/task-packages \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "YOUR_PROJECT_ID",
    "name": "任务包 A-001",
    "original_annotator_id": "YOUR_ANNOTATOR_ID",
    "status": "annotating"
  }'
```

### 创建返工记录

```bash
curl -X POST http://localhost:3000/api/rework-records \
  -H "Content-Type: application/json" \
  -d '{
    "task_package_id": "YOUR_TASK_PACKAGE_ID",
    "project_id": "YOUR_PROJECT_ID",
    "annotator_id": "YOUR_ANNOTATOR_ID",
    "reason": "quality_issue"
  }'
```

### 查询返工记录列表

```bash
curl http://localhost:3000/api/rework-records

# 按状态筛选
curl http://localhost:3000/api/rework-records?status=pending_manual

# 按项目筛选
curl http://localhost:3000/api/rework-records?project_id=YOUR_PROJECT_ID
```

### 查询返工记录详情

```bash
curl http://localhost:3000/api/rework-records/YOUR_RECORD_ID
```

### 查询状态历史

```bash
curl http://localhost:3000/api/rework-records/YOUR_RECORD_ID/history
```

### 更新状态

```bash
curl -X PATCH http://localhost:3000/api/rework-records/YOUR_RECORD_ID/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "annotating",
    "operator": "admin",
    "remark": "开始标注工作"
  }'
```

### 导出 CSV

```bash
curl -o rework-records.csv http://localhost:3000/api/rework-records/export/csv
```

---

## 验收流程

按照以下顺序进行验收，确保数据一致性：

### 场景 1: 完整状态流转

1. 创建项目、标注员、任务包
2. 创建返工记录（状态为待分配）
3. 更新状态到「标注中」
4. 更新状态到「返工中」
5. 更新状态到「已验收」
6. 验证：列表、详情、历史记录数据一致

### 场景 2: 冲突记录

1. 创建任务包时指定原标注员 A
2. 创建返工记录时再次分配给标注员 A
3. 验证：记录状态自动变为「待人工处理」
4. 验证：返回结果包含冲突原因和详情

### 场景 3: 导入坏行

1. 缺少必填字段创建记录 → 应该失败
2. 从「已验收」流转到「待分配」→ 应该失败
3. 验证：错误信息清晰可理解

### 数据一致性验证

- 列表查询 → 检查记录数正确
- 详情查询 → 检查字段完整性
- 历史查询 → 检查状态变更记录完整
- 导出 CSV → 检查导出数据与列表数据一致

---

## 注意事项

1. 数据库文件存放在 `data/app.db`，删除该文件可重置数据
2. 状态流转严格按照状态机定义，不允许非法跳转
3. 冲突检测在创建记录时自动触发，无需额外调用
4. 导出的 CSV 文件包含 BOM，确保 Excel 打开时中文正常显示

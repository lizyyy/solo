# 赛事检录资格 API

一个用于赛事检录资格校验的本地后端 API 服务，支持证件校验、分组管理、替补递补、重复检录拦截和报告导出。

## 功能特性

- **材料校验**: 验证身份证、参赛证明、健康证明是否齐全且有效
- **组别限制**: 检查组别人数是否已满
- **替补递补**: 自动将替补选手递补到正式名单
- **重复检录拦截**: 防止同一选手重复检录
- **异常处理**: 保存原始输入(raw_input)和处理结论(processing_result)
- **人工修正**: 支持人工干预修正检录状态
- **状态历史**: 完整记录每次状态变更
- **报告导出**: 支持 CSV 格式导出

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 导入样例数据
```bash
node src/scripts/seedData.js
```

### 3. 启动服务
```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 运行验收测试
```bash
node src/scripts/testAPI.js
```

## API 接口

### 健康检查
- `GET /api/health` - 服务健康状态

### 组别管理
- `POST /api/groups` - 创建组别
- `GET /api/groups` - 获取所有组别
- `GET /api/groups/:id` - 获取组别详情

### 选手管理
- `POST /api/athletes` - 创建选手
- `GET /api/athletes` - 获取所有选手
- `GET /api/athletes/:id` - 获取选手详情（含证件、检录记录）
- `POST /api/athletes/:id/documents` - 上传/更新证件

### 检录管理
- `POST /api/checkin` - 执行检录
- `GET /api/checkin` - 获取所有检录记录
- `GET /api/checkin/athlete/:athleteId` - 获取选手检录记录
- `POST /api/checkin/manual` - 人工修正状态
- `GET /api/checkin/status-history/:athleteId` - 获取状态历史

### 替补管理
- `POST /api/substitutes` - 添加替补选手
- `GET /api/substitutes` - 获取所有替补
- `POST /api/substitutes/promote/:groupId` - 替补递补

### 报告管理
- `POST /api/reports/:athleteId` - 生成资格报告
- `GET /api/reports` - 获取所有报告
- `GET /api/reports/athlete/:athleteId` - 获取选手报告
- `GET /api/reports/export/csv` - 导出 CSV 报告

## 数据模型

### groups (组别)
- id, name, max_participants, description, created_at

### athletes (选手)
- id, name, id_card, phone, email, group_id, registration_time

### documents (证件)
- id, athlete_id, doc_type, doc_number, is_valid, upload_time, verified_at, verified_by

### substitutes (替补)
- id, athlete_id, group_id, priority, is_promoted, promoted_at, created_at

### checkin_events (检录事件)
- id, athlete_id, status, checkin_time, operator, notes, raw_input, processing_result

### status_history (状态历史)
- id, athlete_id, old_status, new_status, changed_at, changed_by, reason

### qualification_reports (资格报告)
- id, athlete_id, report_data, generated_at, generated_by

## 样例数据说明

导入后包含以下测试数据：

| 选手 | 证件状态 | 组别 | 说明 |
|------|----------|------|------|
| 张三 | 齐全且有效 | 男子甲组 | 可正常检录 |
| 李四 | 参赛证明未验证 | 男子甲组 | 会触发异常拦截 |
| 王五 | 齐全且有效 | (替补) | 替补选手，会自动递补 |
| 赵六 | 齐全且有效 | 女子甲组 | 可正常检录 |

## 验收测试流程

1. **正常创建**: 张三检录 - 状态: 已检录 ✓
2. **重复提交**: 张三再次检录 - 拦截成功 ✓
3. **异常拦截**: 李四检录 - 检测到证件问题 ✓
4. **人工修正**: 李四状态改为"已通过" ✓
5. **状态历史**: 查看完整变更记录 ✓
6. **导出报告**: CSV 导出成功 ✓

## 项目结构

```
event-checkin-api/
├── package.json
├── README.md
└── src/
    ├── server.js              # 服务入口
    ├── database/
    │   ├── db.js              # 数据库连接
    │   └── schema.sql         # 数据库 schema
    ├── services/
    │   └── qualificationService.js  # 核心业务逻辑
    ├── routes/
    │   ├── groups.js          # 组别路由
    │   ├── athletes.js        # 选手路由
    │   ├── checkin.js         # 检录路由
    │   ├── substitutes.js     # 替补路由
    │   └── reports.js         # 报告路由
    └── scripts/
        ├── seedData.js        # 样例数据导入
        └── testAPI.js         # 验收测试脚本
```

## 数据持久化

数据库文件位于 `data/checkin.db` (SQLite)，重启服务数据不会丢失。

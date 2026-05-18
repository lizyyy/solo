# 花卉温室病害预警系统 API

基于 Node.js + Express + SQLite 构建的花卉温室病害预警管理系统，支持完整的 CRUD 操作、数据导入导出、变更历史追踪和业务规则校验。

## 核心特性

### 业务规则校验
- **同一区域连续预警未升级检测**：防止同一温室区域的同一种病害在已有预警的情况下，新预警级别不升反降
- **预警清单一致性检查**：确保预警数据版本号和状态的一致性
- **静默覆盖保护**：基于版本号防止并发修改导致的数据丢失
- **预警编号重复检测**：确保预警编号唯一性

### 流程管理
- **撤回后重新进入流程**：已撤回的预警不能直接修改，必须通过 `/reapply` 接口创建新的预警记录，关联原预警ID，状态为 `reapplied`
- **禁止直接删除**：所有预警记录不允许物理删除，只能通过撤回流程标记为 `withdrawn`
- **完整变更历史**：记录每一次字段变更，包括操作人和时间

### 数据导入导出
- 支持 CSV 格式导入导出
- 导入时自动校验坏行并给出详细错误信息
- 支持导出模板下载

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库和样例数据

```bash
npm run init
```

初始化数据包含：
- 4个温室（玫瑰、月季、兰花、康乃馨）
- 3条预警记录（含不同状态和严重级别）
- 变更历史记录

### 3. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 4. 运行验收测试

```bash
npm test
```

测试覆盖以下场景：
- ✅ 创建正常预警记录
- ✅ 冲突预警（同一区域连续预警未升级）被正确拒绝
- ✅ 导出CSV数据
- ✅ 导入CSV（包含坏行处理）
- ✅ 静默覆盖保护
- ✅ 撤回后重新进入流程（单独路径）
- ✅ 预警清单一致性检查
- ✅ 查询预警变更历史
- ✅ 禁止直接删除预警
- ✅ 查询所有预警记录

## API 接口文档

### 温室管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/greenhouses | 获取所有温室列表 |
| GET | /api/greenhouses/:id | 获取单个温室详情 |
| POST | /api/greenhouses | 创建新温室 |

### 预警管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/warnings | 获取所有预警列表（支持筛选：greenhouse_id, status, disease_type） |
| GET | /api/warnings/:id | 获取单个预警详情 |
| POST | /api/warnings | 创建新预警（自动校验连续预警升级规则） |
| PUT | /api/warnings/:id | 更新预警（需要提供 version 和 operator） |
| POST | /api/warnings/:id/withdraw | 撤预警 |
| POST | /api/warnings/:id/reapply | 撤回后重新申请（单独路径，创建新记录） |
| GET | /api/warnings/:id/history | 获取预警变更历史 |
| GET | /api/warnings/consistency/:greenhouseId | 检查温室预警清单一致性 |

### 数据导入导出

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/import-export/export | 导出所有预警为CSV |
| POST | /api/import-export/import | 导入CSV格式预警数据 |
| GET | /api/import-export/template | 下载导入模板 |

## 数据模型

### 温室 (greenhouses)
```
- id: 温室ID（主键）
- name: 温室名称
- location: 位置
- area: 面积（平方米）
- flower_types: 种植花卉类型
- created_at: 创建时间
```

### 病害预警 (disease_warnings)
```
- id: 预警ID（主键）
- greenhouse_id: 温室ID（外键）
- warning_no: 预警编号（唯一）
- disease_type: 病害类型
- severity_level: 严重级别 [low, medium, high, critical]
- affected_area: 受影响面积
- detected_date: 发现时间
- reporter: 上报人
- status: 状态 [pending, confirmed, resolved, withdrawn, reapplied]
- description: 描述
- temperature: 温度
- humidity: 湿度
- ph_value: pH值
- fertilizer_used: 使用肥料
- pesticide_applied: 施用农药
- previous_warning_id: 关联原预警ID（重新申请时使用）
- version: 版本号（乐观锁）
- created_at: 创建时间
- updated_at: 更新时间
```

### 变更历史 (warning_history)
```
- id: 记录ID（主键）
- warning_id: 预警ID（外键）
- field_changed: 变更字段
- old_value: 原值
- new_value: 新值
- changed_by: 操作人
- changed_at: 变更时间
```

## 错误码说明

| 错误码 | 描述 |
|--------|------|
| CONSECUTIVE_WARNING_NOT_UPGRADED | 同一区域连续预警未升级 |
| WARNING_INCONSISTENCY | 预警清单一致性检查失败 |
| DUPLICATE_WARNING_NO | 预警编号重复 |
| SILENT_OVERWRITE_ATTEMPT | 静默覆盖检测（版本不匹配） |
| GREENHOUSE_NOT_FOUND | 温室不存在 |
| WARNING_NOT_FOUND | 预警不存在 |
| INVALID_SEVERITY_LEVEL | 无效的严重级别 |
| INVALID_STATUS | 无效的状态 |
| WITHDRAWN_REAPPLY_PATH_ERROR | 撤回后重新申请路径错误 |

## 目录结构

```
.
├── src/
│   ├── app.js                    # 主应用入口
│   ├── database/
│   │   └── db.js                 # 数据库配置和模型
│   ├── routes/
│   │   ├── warnings.js           # 预警管理路由
│   │   ├── greenhouses.js        # 温室管理路由
│   │   └── importExport.js       # 导入导出路由
│   ├── middleware/
│   │   └── errorHandler.js       # 错误处理中间件
│   ├── utils/
│   │   └── validation.js         # 业务校验工具
│   └── scripts/
│       ├── initData.js           # 初始化数据脚本
│       └── test.js               # 验收测试脚本
├── data/
│   └── database.db               # SQLite数据库文件（自动生成）
├── package.json
└── README.md
```

## 验收测试样例数据

### 正常记录示例
```json
{
  "greenhouse_id": "GH-002",
  "warning_no": "2024-GH002-DIS-TEST-001",
  "disease_type": "锈病",
  "severity_level": "medium",
  "affected_area": 120.0,
  "detected_date": "2024-05-15 10:00:00",
  "reporter": "测试员A",
  "description": "叶片出现黄褐色锈状斑点，初期阶段"
}
```

### 冲突记录示例（会被拒绝）
```json
{
  "greenhouse_id": "GH-001",
  "warning_no": "2024-GH001-DIS-TEST-002",
  "disease_type": "白粉病",
  "severity_level": "low",  // 已存在medium级别预警，low不满足升级要求
  "affected_area": 100.0,
  "detected_date": "2024-05-15 11:00:00",
  "reporter": "测试员B"
}
```

### 导入坏行示例
- 预警编号重复
- 必填字段缺失
- 无效的严重级别

## 注意事项

1. **版本控制**：所有更新操作必须提供当前版本号，防止静默覆盖
2. **删除策略**：禁止物理删除预警，只能通过撤回功能标记为 withdrawn 状态
3. **重新申请**：已撤回的预警不能直接修改，必须调用 /reapply 接口创建新记录
4. **升级规则**：同一区域同一种病害的后续预警必须比已有预警级别更高或相等
5. **操作人追踪**：所有修改操作必须提供操作人信息，用于历史追踪
# 酒店PMS接口房态手工锁房 API

## 项目说明

提供完整的酒店房态手工锁房API，支持从创建到导出的全流程验收，不依赖前端页面。

## 核心功能

- ✅ 创建锁房（房间、锁房原因、销售渠道、解锁时间）
- ✅ 状态流转：available（可售）→ locking（锁房中）→ pending_unlock（待解锁）→ unlocked（已解锁）
- ✅ 批量导入：行级错误处理，失败不中断整批
- ✅ 历史记录：完整的状态变更轨迹
- ✅ CSV导出：锁房记录和历史记录导出

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务将在 http://localhost:3000 启动

### 4. 运行验收测试

```bash
chmod +x test/acceptance.sh
bash test/acceptance.sh
```

## API接口说明

### 基础信息

- 健康检查: `GET /health`
- API前缀: `/api/locks`

### 锁房管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/locks` | 创建锁房 |
| GET | `/api/locks` | 查询锁房列表 |
| GET | `/api/locks/:id` | 查询锁房详情 |
| GET | `/api/locks/:id/history` | 查询锁房历史 |
| POST | `/api/locks/:id/status` | 更新锁房状态 |

### 批量导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/locks/import` | 批量导入锁房记录 |
| GET | `/api/locks/import/:batchId` | 查询导入批次详情 |

### 导出功能

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/locks/export` | 导出全部锁房记录CSV |
| POST | `/api/locks/:id/export-history` | 导出单条锁房历史CSV |
| GET | `/api/locks/export/download/:filename` | 下载导出文件 |

## 数据字典

### 状态枚举

| 状态值 | 中文说明 | 说明 |
|--------|----------|------|
| available | 可售 | 房间可售，未锁定 |
| locking | 锁房中 | 房间已被锁定 |
| pending_unlock | 待解锁 | 等待确认解锁 |
| unlocked | 已解锁 | 已完成解锁 |

### 锁房原因

| 编码 | 名称 | 说明 |
|------|------|------|
| MAINTENANCE | 维修保养 | 房间需要维修保养 |
| INTERNAL_USE | 内部使用 | 酒店内部使用 |
| COMPLAINT_HANDLE | 投诉处理 | 客人投诉处理预留 |
| VIP_RESERVE | VIP预留 | 重要客人预留 |
| OVERBOOKING | 超售预留 | 超售情况预留 |
| CHANNEL_LOCK | 渠道锁定 | 销售渠道已售出 |

### 销售渠道

| 编码 | 名称 | 说明 |
|------|------|------|
| OTA_CTRIP | 携程 | 携程渠道 |
| OTA_FLIGGY | 飞猪 | 飞猪渠道 |
| OTA_MEITUAN | 美团 | 美团渠道 |
| DIRECT | 前台直销 | 前台直接销售 |
| WALKIN | 散客 | 上门散客 |

## 验收场景说明

### 场景一：完整流转

1. 创建1001房间锁房（locking状态）
2. 设置待解锁（pending_unlock状态）
3. 完成解锁（unlocked状态）
4. 查看详情和历史记录

### 场景二：冲突记录

1. 创建1002房间锁房
2. 尝试重复锁房（预期失败）

### 场景三：批量导入

5条记录，包含：
- 3条成功：1003、1101、1102
- 2条失败：1002（冲突）、9999（不存在的房间）

## curl使用示例

```bash
# 创建锁房
curl -X POST http://localhost:3000/api/locks \
  -H "Content-Type: application/json" \
  -d '{
    "room_number": "1001",
    "reason_code": "MAINTENANCE",
    "channel_code": "OTA_CTRIP",
    "operator": "张三",
    "remark": "空调维修"
  }'

# 查询列表
curl http://localhost:3000/api/locks

# 按状态筛选
curl "http://localhost:3000/api/locks?status=locking"

# 查看历史
curl http://localhost:3000/api/locks/{id}/history

# 批量导入
curl -X POST http://localhost:3000/api/locks/import \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "系统管理员",
    "records": [
      {"room_number": "1003", "reason_code": "CHANNEL_LOCK", "channel_code": "OTA_MEITUAN"}
    ]
  }'

# 导出CSV
curl -X POST http://localhost:3000/api/locks/export
```

## 项目结构

```
.
├── src/
│   ├── config/
│   │   └── database.js      # 数据库配置
│   ├── routes/
│   │   └── locks.js         # 路由定义
│   ├── services/
│   │   ├── lockService.js   # 锁房业务逻辑
│   │   ├── importService.js # 批量导入逻辑
│   │   └── exportService.js # 导出业务逻辑
│   ├── scripts/
│   │   └── init-db.js       # 数据库初始化脚本
│   └── server.js            # 服务入口
├── test/
│   └── acceptance.sh        # 验收测试脚本
├── exports/                 # 导出文件目录
├── package.json
└── README.md
```

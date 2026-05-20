# 设备固件灰度管理系统

一个基于 Python Flask 的设备固件全量/灰度升级管理平台，支持失败自动暂停、回滚策略、升级报告导出等核心功能。

## 功能特性

### 🎯 核心规则实现
- **失败自动暂停**: 当升级失败率达到设定阈值时，自动暂停批次，避免故障扩大
- **回滚策略**: 支持手动回滚，将所有设备标记为回滚状态
- **批次灰度**: 创建、启动、暂停、恢复、完成、回滚完整生命周期管理
- **回执收集**: 记录每台设备的升级状态、开始/结束时间、错误信息

### 📊 管理功能
- **设备型号管理**: 维护不同型号的设备信息
- **固件版本管理**: 管理不同版本的固件文件
- **灰度批次管理**: 创建和管理升级批次，支持按状态/型号筛选
- **批量导入设备**: 支持批量导入设备序列号
- **升级时间线**: 可视化展示批次内所有设备的升级事件
- **报告导出**: 导出CSV格式的升级报告

## 技术栈

- **后端**: Python 3.x + Flask + SQLite
- **前端**: 原生 HTML5 + CSS3 + JavaScript
- **跨域**: Flask-CORS

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py     # Flask应用工厂
│   │   ├── models.py       # 数据模型和数据库操作
│   │   ├── routes.py       # API路由
│   │   └── services.py     # 业务逻辑服务
│   ├── run.py              # 启动脚本
│   └── test_gray_logic.py  # 核心逻辑自检脚本
├── frontend/
│   ├── templates/
│   │   └── index.html      # 主页面
│   └── static/
│       ├── style.css       # 样式文件
│       └── app.js          # 前端逻辑
├── requirements.txt        # Python依赖
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行核心逻辑自检

```bash
cd backend
python test_gray_logic.py
```

这个脚本会验证所有核心功能：
- ✅ 设备型号管理
- ✅ 固件版本管理  
- ✅ 创建灰度批次
- ✅ 启动批次
- ✅ 创建设备回执
- ✅ 升级流程模拟
- ✅ **自动暂停触发** (失败率达到阈值时自动暂停)
- ✅ 手动暂停/恢复
- ✅ 批次回滚功能
- ✅ 报告生成
- ✅ 批量导入设备

### 3. 启动Web服务

```bash
cd backend
python run.py
```

服务将在 `http://localhost:5000` 启动。

## API 接口文档

### 设备型号
- `GET /api/device-models` - 获取所有设备型号
- `POST /api/device-models` - 创建设备型号

### 固件版本
- `GET /api/firmware` - 获取所有固件版本
- `POST /api/firmware` - 创建固件版本

### 灰度批次
- `GET /api/batches` - 获取批次列表（支持?status= & ?model_id= 筛选）
- `POST /api/batches` - 创建批次
- `GET /api/batches/{id}` - 获取批次详情
- `POST /api/batches/{id}/start` - 启动批次
- `POST /api/batches/{id}/pause` - 暂停批次
- `POST /api/batches/{id}/resume` - 恢复批次
- `POST /api/batches/{id}/rollback` - 回滚批次
- `POST /api/batches/{id}/complete` - 完成批次

### 升级回执
- `POST /api/receipts` - 创建设备回执
- `POST /api/receipts/bulk` - 批量创建设备回执
- `POST /api/receipts/{id}/start` - 开始升级
- `POST /api/receipts/{id}/complete` - 完成升级（成功/失败）

### 报告
- `GET /api/batches/{id}/report` - 获取升级报告
- `GET /api/batches/{id}/report/download` - 下载CSV报告

## 核心业务逻辑说明

### 失败自动暂停机制

当批次处于 `running` 状态时，每完成一次升级，系统会自动检查：

```python
失败率 = 失败设备数 / 已升级设备总数

if 失败率 >= 暂停阈值:
    自动将批次状态改为 paused
    记录暂停原因: "失败率达到阈值: X% >= Y%"
```

### 升级状态流转

```
回执状态: pending → in_progress → success / failed → rolled_back

批次状态: created → running ⇄ paused → completed / rolled_back
```

### 回滚策略

执行回滚操作时：
1. 将批次状态改为 `rolled_back`
2. 将该批次下所有回执的状态改为 `rolled_back`

## 使用示例

### 典型操作流程

1. **创建设备型号** → 2. **创建固件版本** → 3. **创建灰度批次** → 4. **批量导入设备** → 5. **启动批次** → 6. **设备上报升级状态** → 7. **(失败达到阈值自动暂停)** → 8. **下载升级报告**

### 通过API模拟升级失败

```bash
# 完成升级（失败）
curl -X POST http://localhost:5000/api/receipts/1/complete \
  -H "Content-Type: application/json" \
  -d '{"success": false, "error_code": "ERR_DOWNLOAD", "error_message": "固件校验失败"}'
```

## 数据库表结构

- **device_models**: 设备型号 (id, model_name, model_code, description, created_at)
- **firmware_versions**: 固件版本 (id, model_id, version, file_path, md5, size, release_notes, created_at)
- **gray_batches**: 灰度批次 (id, name, model_id, firmware_id, status, pause_threshold, pause_reason, created_at, started_at, completed_at)
- **upgrade_receipts**: 升级回执 (id, batch_id, device_sn, status, error_code, error_message, started_at, completed_at, created_at)
- **pause_rules**: 暂停规则 (id, batch_id, rule_type, threshold, enabled, created_at)

## 注意事项

1. SQLite 数据库文件会自动创建在 `backend/firmware_gray.db`
2. 自检脚本每次运行会清除旧数据库，生成全新测试数据
3. 前端页面支持响应式布局，建议使用现代浏览器访问

# 图书馆活动组讲座候补入场系统

基于 Flask + SQLite 的 RESTful API 系统，用于管理图书馆讲座候补入场，重点解决主办方手工放人导致候补顺序错乱和入场名单一致性问题。

## 功能特性

### 核心功能
- ✅ 候补记录 CRUD 操作
- ✅ 候补序号冲突检测（防止顺序错乱）
- ✅ 主办方手工放人功能
- ✅ 版本号乐观锁（防止并发冲突）
- ✅ 批量导入（支持表格、截图、口头等来源）
- ✅ 数据导出
- ✅ 入场名单一致性检查

### 异常处理
- 🚫 重复读者检测
- 🚫 候补序号冲突
- 🚫 版本不匹配
- 🚫 不能静默覆盖原记录
- 🚫 数据格式校验
- 🚫 记录不存在提示

## 数据模型

### LectureWaitlist 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| lecture_id | String | 讲座编号 |
| lecture_title | String | 讲座标题 |
| lecture_date | DateTime | 讲座时间 |
| lecture_venue | String | 讲座地点 |
| reader_id | String | 读者编号 |
| reader_name | String | 读者姓名 |
| reader_phone | String | 读者电话 |
| reader_department | String | 读者部门 |
| waitlist_number | Integer | 候补序号 |
| waitlist_time | DateTime | 候补登记时间 |
| status | Enum | 状态: waiting/confirmed/admitted/cancelled/no_show |
| admission_type | Enum | 入场类型: normal_waitlist/manual_admission/special_arrangement |
| admission_time | DateTime | 入场时间 |
| admission_operator | String | 入场操作人 |
| admission_remark | Text | 入场备注 |
| data_source | Enum | 数据来源: spreadsheet/screenshot/verbal/system |
| source_note | String | 来源备注 |
| version | Integer | 版本号（乐观锁） |
| created_at | DateTime | 创建时间 |
| updated_at | DateTime | 更新时间 |

## API 接口

### 候补管理
- `GET /api/waitlist` - 查询候补列表
- `GET /api/waitlist/{id}` - 查询单个候补记录
- `POST /api/waitlist` - 创建候补记录
- `PUT /api/waitlist/{id}` - 更新候补记录
- `DELETE /api/waitlist/{id}` - 删除候补记录

### 特殊操作
- `POST /api/waitlist/{id}/admit` - 主办方手工放人
- `POST /api/waitlist/import` - 批量导入
- `GET /api/waitlist/export` - 数据导出
- `GET /api/lectures/{lecture_id}/waitlist/consistency-check` - 一致性检查

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 初始化数据
```bash
python init_data.py
```
这将创建：
- 3个讲座的 8 条初始候补记录
- 包含真实的图书馆业务场景数据
- 用于冲突测试的场景数据

### 3. 启动服务
```bash
python app.py
```
服务将在 http://localhost:5000 启动

### 4. 运行验收测试
```bash
python acceptance_test.py
```

## 验收测试说明

### 测试数据准备
- **正常记录**: LIB-2024-001 讲座的张明（候补序号1）
- **冲突记录**: LIB-2024-003 讲座可用于测试序号冲突
- **坏行样例**: 见 test_import_data.json 文件

### 测试场景
1. ✅ 创建正常候补记录
2. ✅ 重复读者冲突检测
3. ✅ 候补序号冲突检测（防止顺序错乱）
4. ✅ 主办方手工放人功能
5. ✅ 版本号乐观锁冲突检测
6. ✅ 批量导入（含正常、冲突、坏行）
7. ✅ 数据导出与导入校验
8. ✅ 入场名单一致性检查
9. ✅ 不存在记录的错误返回
10. ✅ 不能静默覆盖原记录验证

## 使用示例

### 创建候补记录
```bash
curl -X POST http://localhost:5000/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{
    "lecture_id": "LIB-2024-001",
    "lecture_title": "人工智能在图书馆资源管理中的应用",
    "lecture_date": "2024-01-15T14:00:00",
    "lecture_venue": "图书馆三楼多功能厅",
    "reader_id": "R20240099",
    "reader_name": "测试用户",
    "reader_phone": "13800000099",
    "waitlist_number": 99
  }'
```

### 主办方手工放人
```bash
curl -X POST http://localhost:5000/api/waitlist/1/admit \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王管理员",
    "remark": "特殊情况优先入场"
  }'
```

### 一致性检查
```bash
curl http://localhost:5000/api/lectures/LIB-2024-001/waitlist/consistency-check
```

## 错误返回格式

所有错误统一返回格式：
```json
{
  "success": false,
  "error": {
    "code": "WAITLIST_ORDER_CONFLICT",
    "message": "讲座 LIB-2024-001 中候补序号 1 已被占用",
    "details": {
      "lecture_id": "LIB-2024-001",
      "conflicting_waitlist_number": 1,
      "readers_at_this_position": [...]
    }
  }
}
```

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| DUPLICATE_READER | 同一讲座读者重复报名 |
| WAITLIST_ORDER_CONFLICT | 候补序号冲突 |
| VERSION_MISMATCH | 版本号不匹配 |
| MANUAL_ADMISSION_CONFLICT | 入场状态冲突 |
| RECORD_NOT_FOUND | 记录不存在 |
| INVALID_DATA | 数据格式无效 |
| RECORD_CONFLICT | 导入记录冲突 |

## 项目文件

```
.
├── app.py              # Flask 应用主文件
├── models.py           # 数据模型
├── database.py         # 数据库配置
├── exceptions.py       # 自定义异常类
├── init_data.py        # 初始化数据脚本
├── acceptance_test.py  # 验收测试脚本
├── test_import_data.json # 测试导入数据
├── requirements.txt    # 依赖列表
└── README.md          # 项目说明
```

## 注意事项

1. **不能静默覆盖**: 系统严格禁止静默覆盖已有记录，所有冲突都会抛出明确的错误提示
2. **候补顺序保护**: 同一讲座内候补序号唯一，防止顺序错乱
3. **乐观锁机制**: 使用版本号防止并发修改冲突
4. **数据来源追踪**: 所有记录都有数据来源标记（表格/截图/口头/系统）
5. **入场审计**: 所有入场操作都记录操作人、时间、备注

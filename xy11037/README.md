# 母婴护理站护理员夜班交接 API

专为母婴护理站设计的护理员夜班交接班管理系统，支持完整的交接流程、修改历史追踪、人工处理和数据导出。

## 功能特点

- ✅ **完整的交接流程**: 创建 → 修改 → 提交 → 签字 → 撤回 → 重新提交
- ✅ **修改历史追踪**: 每一次操作都有完整记录，可追溯
- ✅ **人工处理流程**: 异常情况可标记人工处理，保留处理备注
- ✅ **真实业务字段**: 包含产妇情况、新生儿情况、设备状态等专业字段
- ✅ **业务语言导出**: JSON导出使用中文业务字段名，便于理解和使用
- ✅ **完善的错误处理**: 清晰的错误提示，便于调试
- ✅ **自动API文档**: Swagger UI，交互式API测试

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用入口
│   ├── models/
│   │   ├── __init__.py
│   │   ├── models.py        # 数据模型定义
│   │   └── database.py      # 数据存储和业务逻辑
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── handover.py      # 请求/响应 schema
│   ├── api/
│   │   ├── __init__.py
│   │   └── handover.py      # API路由定义
│   └── tests/
│       └── test_handover.py # 测试用例
├── data/                    # 数据存储目录
├── requirements.txt         # 依赖包
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

或手动安装：

```bash
pip3 install fastapi uvicorn pydantic pytest httpx python-multipart
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

服务启动后，在浏览器中访问：

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API接口说明

### 基础信息

- **Base URL**: `http://localhost:8000/api/handover`
- **根路径**: `http://localhost:8000/` （查看API概览）

### 1. 创建交接记录

```bash
POST /api/handover/
```

请求体示例：

```json
{
  "shift_date": "2026-05-18",
  "shift_type": "夜班",
  "on_duty_nurse": "张小红",
  "off_duty_nurse": "李秀英",
  "baby_count": 5,
  "maternal_conditions": [
    {
      "room_number": "VIP01",
      "mother_name": "王美丽",
      "temperature": "36.5",
      "lochia": "正常",
      "uterine_contraction": "良好",
      "wound_condition": "干燥无渗血",
      "breastfeeding": "顺利",
      "special_care": "一级护理",
      "notes": "产后第三天，恢复良好"
    }
  ],
  "baby_conditions": [
    {
      "room_number": "VIP01",
      "baby_name": "小宝A",
      "gender": "男",
      "temperature": "36.7",
      "feeding": "母乳 30ml",
      "defecation": "胎便已排",
      "skin_condition": "正常",
      "jaundice": "生理性黄疸，轻微",
      "status": "正常",
      "notes": "体重下降在正常范围内"
    }
  ],
  "special_notes": "VIP02产妇血压略高，需密切监测",
  "equipment_status": "监护仪正常，吸奶器2台可用",
  "emergency_supplies": "急救物品齐全，在有效期内",
  "next_shift_tasks": "1. VIP02产妇伤口换药\n2. 小宝B皮肤情况观察"
}
```

### 2. 获取交接记录列表

```bash
GET /api/handover/
```

可选查询参数：

- `status`: 按状态筛选（草稿/已提交/已签字/待人工处理/人工处理完成/已撤回）
- `shift_date`: 按日期筛选，格式：YYYY-MM-DD
- `nurse_name`: 按护士姓名筛选

示例：

```bash
# 获取所有已提交的记录
curl "http://localhost:8000/api/handover/?status=已提交"

# 获取张小红相关的夜班记录
curl "http://localhost:8000/api/handover/?nurse_name=张小红&shift_date=2026-05-18"
```

### 3. 获取交接记录详情

```bash
GET /api/handover/{record_id}
```

示例：

```bash
curl "http://localhost:8000/api/handover/abc12345"
```

### 4. 更新交接记录

```bash
PUT /api/handover/{record_id}
```

请求体：

```json
{
  "special_notes": "VIP02产妇血压已恢复正常",
  "baby_count": 6,
  "remarks": "夜班期间新入院一名新生儿"
}
```

**注意**: 只有需要修改的字段才需要传入，`remarks`用于记录修改原因。

### 5. 提交交接记录

```bash
POST /api/handover/{record_id}/submit?submitted_by=李秀英
```

- 只有草稿或已撤回状态的记录可以提交
- 提交后状态变为"已提交"

### 6. 撤回交接记录

```bash
POST /api/handover/{record_id}/withdraw
```

请求体：

```json
{
  "withdrawn_by": "李秀英",
  "reason": "发现新生儿记录有误，需要修正后重新提交"
}
```

- 只有已提交或待人工处理状态的记录可以撤回
- 撤回后状态变为"已撤回"，可以修改后重新提交

### 7. 签字确认

```bash
POST /api/handover/{record_id}/sign
```

请求体：

```json
{
  "signer": "李秀英",
  "signature": "李秀英20260518"
}
```

- 交班护士和接班护士都需要签字
- 双方都签字后状态变为"已签字"

### 8. 查看修改历史

```bash
GET /api/handover/{record_id}/history
```

返回完整的修改历史，包含：
- 操作类型（创建/更新/提交/撤回/签字/人工处理等）
- 操作人
- 操作时间
- 修改前后的值
- 备注说明

### 9. 标记人工处理

```bash
POST /api/handover/{record_id}/manual-process
```

请求体：

```json
{
  "flagged_by": "护士长王芳",
  "reason": "交接记录有矛盾之处，需要人工核查"
}
```

### 10. 完成人工处理

```bash
POST /api/handover/{record_id}/manual-complete
```

请求体：

```json
{
  "processed_by": "护士长王芳",
  "notes": "经核查，系录入笔误，新生儿数量应为3而非5。已修正数据，责任护士已重新确认。",
  "new_status": "人工处理完成"
}
```

### 11. 导出单条记录

```bash
GET /api/handover/{record_id}/export?format=json
```

- `format`: 导出格式，可选 `json` 或 `table`
- 导出的字段使用中文业务语言，便于理解

### 12. 批量导出所有记录

```bash
GET /api/handover/export/all
```

## 业务流程说明

### 标准交接流程

```
创建记录(草稿)
    ↓
填写产妇和新生儿信息
    ↓
提交记录(已提交)
    ↓
交班护士签字
    ↓
接班护士签字
    ↓
交接完成(已签字)
```

### 发现错误后的处理流程

```
已提交记录
    ↓
发现有误 → 撤回记录(已撤回)
    ↓
修改内容
    ↓
重新提交
    ↓
签字确认
```

### 异常人工处理流程

```
已提交记录
    ↓
发现矛盾/异常 → 标记人工处理(待人工处理)
    ↓
护士长核查
    ↓
完成处理，填写处理备注(人工处理完成)
    ↓
如需要可撤回后修正
```

## 状态说明

| 状态 | 说明 | 可执行操作 |
|------|------|-----------|
| 草稿 | 新创建的记录，未提交 | 更新、提交 |
| 已提交 | 已提交待签字 | 签字、撤回、标记人工处理 |
| 已签字 | 双方已签字确认 | 查看历史 |
| 待人工处理 | 标记需要人工核查 | 撤回、完成人工处理 |
| 人工处理完成 | 人工处理已完成 | 查看 |
| 已撤回 | 已撤回，可修改 | 更新、重新提交 |

## 运行测试

项目包含完整的测试用例，覆盖所有业务场景：

```bash
# 运行所有测试
python3 -m pytest app/tests/test_handover.py -v

# 运行测试并显示输出
python3 -m pytest app/tests/test_handover.py -v -s
```

测试覆盖的场景：

1. ✅ 基础CRUD操作
2. ✅ 从列表进入详情页
3. ✅ 查看修改历史
4. ✅ 上一班未签字，下一班录入结果
5. ✅ 下一班录入后，上一班补签字
6. ✅ 新生儿数量与记录一致性检查
7. ✅ 历史记录版本号一致性
8. ✅ 提交后撤回
9. ✅ 撤回后修改再提交
10. ✅ 完整流程：创建-修改-提交-撤回-再修改-再提交-签字
11. ✅ 标记人工处理
12. ✅ 人工处理备注留痕
13. ✅ 人工处理后完整流程
14. ✅ JSON导出使用业务语言字段名
15. ✅ 批量导出
16. ✅ 不存在记录的错误处理
17. ✅ 错误状态下提交的处理

## 数据持久化

所有数据保存在 `data/` 目录下：

- `handover_records.json`: 交接记录数据
- `handover_history.json`: 修改历史数据

数据文件会自动创建，无需手动初始化。

## 常见问题

### Q: 服务启动失败怎么办？

A: 检查端口8000是否被占用，可以使用其他端口：

```bash
uvicorn app.main:app --reload --port 8080
```

### Q: 如何重置数据？

A: 删除 `data/` 目录下的JSON文件，重启服务即可：

```bash
rm -rf data/
```

### Q: 如何添加新的业务字段？

A: 

1. 在 `app/models/models.py` 的 `HandoverRecord` 中添加字段
2. 在 `app/schemas/handover.py` 的 `HandoverCreate` 和 `HandoverUpdate` 中添加对应字段
3. 在导出接口中添加业务字段名映射

### Q: 错误响应是什么格式？

A: 统一的错误响应格式：

```json
{
  "detail": {
    "error": "错误类型",
    "detail": "详细错误说明",
    "timestamp": "2026-05-18T12:34:56.789012"
  }
}
```

## 技术栈

- **FastAPI**: 现代、快速的Web框架
- **Pydantic**: 数据验证和设置管理
- **Uvicorn**: ASGI服务器
- **Pytest**: 测试框架

## 注意事项

1. 本项目使用文件存储数据，适合中小型护理站使用
2. 生产环境建议使用数据库（如SQLite、PostgreSQL）替换文件存储
3. 建议添加身份认证和权限控制
4. 定期备份 `data/` 目录下的数据文件

## 许可证

仅供内部使用

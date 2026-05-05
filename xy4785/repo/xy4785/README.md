# 物业工单权限边界演练 API

这是一个用于演练权限边界的物业工单管理系统后端API。系统实现了严格的对象级权限控制，不同角色的用户只能访问和操作其权限范围内的数据。

## 系统架构

### 角色定义

| 角色 | 英文标识 | 权限范围 |
|------|----------|----------|
| 管理员 | admin | 全局权限，可查看所有工单、改派、查看审计日志 |
| 楼栋管家 | butler | 只能处理所属楼栋的工单 |
| 维修师傅 | technician | 只能查看和处理派给自己的工单 |
| 住户 | resident | 只能查看和补充自己提交的工单备注 |

### 数据模型

- **User**: 用户表，包含登录信息、角色和所属楼栋
- **Role**: 角色定义表
- **Building**: 楼栋信息表
- **Ticket**: 工单表，包含工单详情、状态、提交人等
- **Dispatch**: 派单记录表，记录工单分配给哪位维修师傅
- **AuditLog**: 审计日志表，记录所有操作和越权尝试

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动，首次运行会自动初始化数据库和测试数据。

### 预置测试账号

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 全局权限 |
| butler1 | butler123 | 楼栋管家 | 负责1号楼 |
| butler2 | butler123 | 楼栋管家 | 负责2号楼 |
| tech1 | tech123 | 维修师傅 | 王师傅 |
| tech2 | tech123 | 维修师傅 | 赵师傅 |
| resident1 | resident123 | 住户 | 陈住户 |
| resident2 | resident123 | 住户 | 刘住户 |

### 预置测试数据

- 1号楼、2号楼、3号楼
- 工单1: "客厅灯具损坏" (1号楼，陈住户提交)
- 工单2: "卫生间漏水" (2号楼，刘住户提交，已派给王师傅)

---

## API 接口文档

所有需要认证的接口都需要在请求头中携带 `Authorization: Bearer <token>`

### 1. 用户登录

**POST** `/api/auth/login`

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

**响应:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1Qi...",
  "user": {
    "id": 1,
    "username": "admin",
    "name": "系统管理员",
    "role": "admin"
  }
}
```

---

### 2. 获取当前用户信息

**GET** `/api/auth/me`

```bash
# 保存token到环境变量（方便后续调用）
ADMIN_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 使用token
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### 3. 获取工单列表

**GET** `/api/tickets`

**权限说明：**
- 管理员: 看到所有工单
- 楼栋管家: 只看到所属楼栋的工单
- 维修师傅: 只看到派给自己的工单
- 住户: 只看到自己提交的工单

```bash
# 管理员查看所有工单
curl http://localhost:5000/api/tickets \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 楼栋管家张管家（负责1号楼）查看自己的工单
BUTLER1_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"butler1","password":"butler123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl http://localhost:5000/api/tickets \
  -H "Authorization: Bearer $BUTLER1_TOKEN"

# 维修师傅王师傅查看派给自己的工单
TECH1_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tech1","password":"tech123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl http://localhost:5000/api/tickets \
  -H "Authorization: Bearer $TECH1_TOKEN"

# 住户陈住户查看自己的工单
RESIDENT1_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"resident1","password":"resident123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl http://localhost:5000/api/tickets \
  -H "Authorization: Bearer $RESIDENT1_TOKEN"
```

---

### 4. 获取工单详情

**GET** `/api/tickets/<ticket_id>`

```bash
# 管理员查看工单1
curl http://localhost:5000/api/tickets/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 陈住户查看自己提交的工单1（应该成功）
curl http://localhost:5000/api/tickets/1 \
  -H "Authorization: Bearer $RESIDENT1_TOKEN"
```

---

### 5. 创建工单

**POST** `/api/tickets`

```bash
# 陈住户创建新工单
curl -X POST http://localhost:5000/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RESIDENT1_TOKEN" \
  -d '{
    "title": "门锁故障",
    "description": "家门门锁无法正常打开",
    "building_id": 1,
    "unit_number": "101"
  }'
```

---

### 6. 补充工单备注

**PUT** `/api/tickets/<ticket_id>/notes`

```bash
# 陈住户给自己的工单补充备注
curl -X PUT http://localhost:5000/api/tickets/1/notes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $RESIDENT1_TOKEN" \
  -d '{"notes": "补充：晚上7点后家中有人，可以上门维修"}'
```

---

### 7. 改派工单（仅管理员）

**POST** `/api/tickets/<ticket_id>/assign`

```bash
# 先获取维修师傅列表
curl http://localhost:5000/api/users/technicians \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 管理员将工单1改派给赵师傅(tech2)
curl -X POST http://localhost:5000/api/tickets/1/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"technician_id": 6}'
```

---

### 8. 关闭工单

**POST** `/api/tickets/<ticket_id>/close`

```bash
# 管理员关闭工单
curl -X POST http://localhost:5000/api/tickets/1/close \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 或住户关闭自己的工单
curl -X POST http://localhost:5000/api/tickets/1/close \
  -H "Authorization: Bearer $RESIDENT1_TOKEN"
```

---

### 9. 查看审计日志（仅管理员）

**GET** `/api/audit`

```bash
curl http://localhost:5000/api/audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### 10. 获取楼栋列表

**GET** `/api/buildings`

```bash
curl http://localhost:5000/api/buildings \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 权限边界测试演练

以下是一些越权访问测试场景，系统会拒绝访问并记录审计日志。

### 场景1: 住户尝试查看其他住户的工单

```bash
# 刘住户(resident2)尝试查看陈住户(resident1)的工单1
RESIDENT2_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"resident2","password":"resident123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 尝试越权访问（应该返回403）
curl http://localhost:5000/api/tickets/1 \
  -H "Authorization: Bearer $RESIDENT2_TOKEN"
```

**预期响应:**
```json
{"error": "不能查看其他住户的工单"}
```

---

### 场景2: 楼栋管家尝试处理其他楼栋的工单

```bash
# 张管家(butler1, 负责1号楼)尝试查看2号楼的工单2
curl http://localhost:5000/api/tickets/2 \
  -H "Authorization: Bearer $BUTLER1_TOKEN"
```

**预期响应:**
```json
{"error": "楼栋管家只能处理所属楼栋的工单"}
```

---

### 场景3: 维修师傅尝试查看未派给自己的工单

```bash
# 赵师傅(tech2)尝试查看派给王师傅(tech1)的工单2
TECH2_TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"tech2","password":"tech123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl http://localhost:5000/api/tickets/2 \
  -H "Authorization: Bearer $TECH2_TOKEN"
```

**预期响应:**
```json
{"error": "维修师傅只能查看派给自己的工单"}
```

---

### 场景4: 非管理员尝试改派工单

```bash
# 楼栋管家尝试改派工单
curl -X POST http://localhost:5000/api/tickets/1/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUTLER1_TOKEN" \
  -d '{"technician_id": 5}'
```

**预期响应:**
```json
{"error": "只有管理员才能改派工单"}
```

---

### 场景5: 非管理员尝试查看审计日志

```bash
# 住户尝试查看审计日志
curl http://localhost:5000/api/audit \
  -H "Authorization: Bearer $RESIDENT1_TOKEN"
```

**预期响应:**
```json
{"error": "只有管理员才能查看审计日志"}
```

---

## 验证审计日志

执行完上述越权测试后，用管理员账号查看审计日志，应该能看到所有越权尝试的记录：

```bash
curl http://localhost:5000/api/audit \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

审计日志会记录：
- 操作人、角色
- 操作类型（`unauthorized` 表示越权尝试）
- 资源类型和ID
- 详细描述
- 是否成功（越权尝试会标记为 `success: false`）
- IP地址、时间戳

---

## 完整测试脚本

创建一个 `test_permissions.sh` 脚本快速测试所有权限边界：

```bash
#!/bin/bash

BASE_URL="http://localhost:5000"

echo "=== 权限边界演练测试 ==="
echo ""

# 登录所有测试用户
echo "1. 登录所有测试用户..."

ADMIN_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token','ERROR'))")
echo "   管理员登录: $([[ $ADMIN_TOKEN != "ERROR" ]] && echo "成功" || echo "失败")"

BUTLER1_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"butler1","password":"butler123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token','ERROR'))")
echo "   张管家(1号楼)登录: $([[ $BUTLER1_TOKEN != "ERROR" ]] && echo "成功" || echo "失败")"

RESIDENT1_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"resident1","password":"resident123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token','ERROR'))")
echo "   陈住户登录: $([[ $RESIDENT1_TOKEN != "ERROR" ]] && echo "成功" || echo "失败")"

RESIDENT2_TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"resident2","password":"resident123"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token','ERROR'))")
echo "   刘住户登录: $([[ $RESIDENT2_TOKEN != "ERROR" ]] && echo "成功" || echo "失败")"

echo ""
echo "2. 测试合法访问..."

# 管理员查看所有工单
echo "   管理员查看所有工单:"
response=$(curl -s $BASE_URL/api/tickets -H "Authorization: Bearer $ADMIN_TOKEN")
ticket_count=$(echo $response | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('tickets',[])))")
echo "      返回工单数量: $ticket_count (预期: 2+)"

# 陈住户查看自己的工单1
echo "   陈住户查看自己的工单1:"
response=$(curl -s $BASE_URL/api/tickets/1 -H "Authorization: Bearer $RESIDENT1_TOKEN")
echo $response | python3 -c "import sys,json; d=json.load(sys.stdin); print('      结果:', '成功' if d.get('id') else '失败: ' + str(d.get('error','unknown')))"

echo ""
echo "3. 测试越权访问（应该被拒绝）..."

# 刘住户查看陈住户的工单
echo "   刘住户尝试查看陈住户的工单1:"
response=$(curl -s $BASE_URL/api/tickets/1 -H "Authorization: Bearer $RESIDENT2_TOKEN")
echo $response | python3 -c "import sys,json; d=json.load(sys.stdin); print('      结果:', '正确拒绝' if '不能查看其他住户' in str(d.get('error','')) else '错误: ' + str(d))"

# 张管家查看2号楼的工单
echo "   张管家(1号楼)尝试查看2号楼的工单2:"
response=$(curl -s $BASE_URL/api/tickets/2 -H "Authorization: Bearer $BUTLER1_TOKEN")
echo $response | python3 -c "import sys,json; d=json.load(sys.stdin); print('      结果:', '正确拒绝' if '只能处理所属楼栋' in str(d.get('error','')) else '错误: ' + str(d))"

# 陈住户尝试查看审计日志
echo "   陈住户尝试查看审计日志:"
response=$(curl -s $BASE_URL/api/audit -H "Authorization: Bearer $RESIDENT1_TOKEN")
echo $response | python3 -c "import sys,json; d=json.load(sys.stdin); print('      结果:', '正确拒绝' if '只有管理员' in str(d.get('error','')) else '错误: ' + str(d))"

echo ""
echo "4. 查看审计日志（所有越权尝试应被记录）..."
response=$(curl -s $BASE_URL/api/audit -H "Authorization: Bearer $ADMIN_TOKEN")
unauthorized_count=$(echo $response | python3 -c "import sys,json; d=json.load(sys.stdin); logs=[l for l in d.get('audit_logs',[]) if l.get('action')=='unauthorized']; print(len(logs))")
echo "   审计日志中越权记录数: $unauthorized_count"

echo ""
echo "=== 测试完成 ==="
```

运行测试：
```bash
chmod +x test_permissions.sh
./test_permissions.sh
```

---

## 关键权限逻辑说明

### 工单访问权限 (`can_access_ticket`)

```python
def can_access_ticket(ticket_id, action='read'):
    # 管理员：全权限
    if user.is_admin():
        return True, None
    
    # 住户：只能访问自己提交的工单
    if user.is_resident():
        if ticket.submitter_id == user.id:
            return True, None
        return False, "不能查看其他住户的工单"
    
    # 楼栋管家：只能访问所属楼栋的工单
    if user.is_butler():
        if user.assigned_building_id == ticket.building_id:
            return True, None
        return False, "楼栋管家只能处理所属楼栋的工单"
    
    # 维修师傅：只能访问派给自己的工单
    if user.is_technician():
        dispatch = Dispatch.query.filter_by(
            ticket_id=ticket.id, 
            technician_id=user.id
        ).first()
        if dispatch:
            return True, None
        return False, "维修师傅只能查看派给自己的工单"
```

### 审计日志记录

所有操作（包括越权尝试）都会被记录到 `audit_logs` 表，包含：
- 操作人ID、用户名、角色
- 操作类型
- 资源类型和ID
- 详细描述
- 时间戳
- IP地址
- 是否成功

---

## 安全特性

1. **对象级权限控制**: 每一条数据访问都经过权限校验
2. **最小权限原则**: 每个角色只拥有完成工作所需的最小权限
3. **审计追踪**: 所有操作和越权尝试都被记录
4. **清晰的错误信息**: 越权访问时返回明确的拒绝原因
5. **JWT认证**: 无状态的Token认证机制

---

## 项目文件结构

```
.
├── app.py              # 主应用入口，包含所有API路由和权限逻辑
├── models.py           # 数据库模型定义
├── config.py           # 配置文件
├── requirements.txt    # Python依赖
├── property.db         # SQLite数据库（首次运行生成）
└── README.md           # 本文档
```

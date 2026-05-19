# 社区食堂管理系统 API 文档

## 基础信息
- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`

---

## 1. 老人管理

### 获取老人列表
```
GET /api/elderly
```

**查询参数**:
- `name`: 姓名（模糊搜索）
- `chronic_disease`: 慢性病（模糊搜索）
- `dietary_restriction`: 饮食忌口（模糊搜索）

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "张爷爷",
      "id_card": "110101194501011234",
      "phone": "13800138001",
      "address": "幸福小区1号楼1单元101",
      "dietary_restrictions": "低盐低油",
      "chronic_diseases": "高血压糖尿病",
      "notes": "需要软食",
      "created_at": "2024-01-15T10:00:00.000Z",
      "updated_at": "2024-01-15T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

### 获取单个老人
```
GET /api/elderly/:id
```

### 创建老人
```
POST /api/elderly
```

**请求体**:
```json
{
  "name": "王爷爷",
  "id_card": "110101194703031236",
  "phone": "13800138003",
  "address": "幸福小区2号楼1单元301",
  "dietary_restrictions": "不吃辣",
  "chronic_diseases": "痛风",
  "notes": "忌口豆制品",
  "operator": "管理员"
}
```

### 更新老人
```
PUT /api/elderly/:id
```

### 删除老人
```
DELETE /api/elderly/:id?operator=管理员
```

---

## 2. 菜单管理

### 获取菜品列表
```
GET /api/menu/items
```

**查询参数**:
- `type`: 类型
- `allergen`: 过敏原

### 创建菜品
```
POST /api/menu/items
```

**请求体**:
```json
{
  "name": "清蒸鲈鱼",
  "type": "午餐",
  "ingredients": "鲈鱼,姜,葱,盐",
  "allergens": "鱼类",
  "nutrition_info": "高蛋白低脂",
  "price": 25,
  "operator": "管理员"
}
```

### 获取每日菜单
```
GET /api/menu/daily
```

**查询参数**:
- `start_date`: 开始日期
- `end_date`: 结束日期

### 创建每日菜单
```
POST /api/menu/daily
```

**请求体**:
```json
{
  "date": "2024-01-16",
  "breakfast_items": "小米粥,馒头",
  "lunch_items": "清蒸鲈鱼,炒青菜,白米饭",
  "dinner_items": "南瓜粥,包子",
  "notes": "周一菜单",
  "created_by": "管理员"
}
```

---

## 3. 配送管理

### 获取配送列表
```
GET /api/deliveries
```

**查询参数**:
- `start_date`: 开始日期
- `end_date`: 结束日期
- `status`: 状态 (pending/delivering/completed/cancelled)
- `delivered_by`: 配送员（模糊搜索）
- `meal_type`: 餐次 (breakfast/lunch/dinner)

### 获取单个配送记录
```
GET /api/deliveries/:id
```

### 创建配送记录
```
POST /api/deliveries
```

**请求体**:
```json
{
  "elderly_id": 1,
  "delivery_date": "2024-01-16",
  "meal_type": "lunch",
  "menu_items": "清蒸鲈鱼,炒青菜",
  "route_id": 1,
  "status": "pending",
  "delivered_by": "张师傅",
  "notes": "",
  "operator": "管理员"
}
```

### 更新配送记录
```
PUT /api/deliveries/:id
```

### 删除配送记录
```
DELETE /api/deliveries/:id?operator=管理员
```

### 获取配送路线
```
GET /api/routes
```

### 创建配送路线
```
POST /api/routes
```

**请求体**:
```json
{
  "name": "1号线",
  "description": "幸福小区1-3号楼",
  "sequence": "1号楼,2号楼,3号楼",
  "operator": "管理员"
}
```

---

## 4. 数据导入

### 导入老人CSV
```
POST /api/import/elderly
Content-Type: multipart/form-data
```

**表单参数**:
- `file`: CSV文件
- `operator`: 操作人

**CSV格式**（参考 examples/elderly-sample.csv）:
```csv
name,id_card,phone,address,dietary_restrictions,chronic_diseases,notes
张爷爷,110101194501011234,13800138001,幸福小区1号楼1单元101,低盐低油,高血压糖尿病,需要软食
```

### 导入菜单JSON
```
POST /api/import/menu
Content-Type: multipart/form-data
```

**表单参数**:
- `file`: JSON文件
- `operator`: 操作人

**JSON格式**（参考 examples/menu-sample.json）:
```json
[
  {
    "name": "小米粥",
    "type": "早餐",
    "ingredients": "小米,水",
    "price": 2
  }
]
```

### 导入配送CSV
```
POST /api/import/delivery
Content-Type: multipart/form-data
```

**表单参数**:
- `file`: CSV文件
- `operator`: 操作人

### 获取导入错误记录
```
GET /api/import/errors
```

**查询参数**:
- `import_type`: 导入类型 (elderly/menu/delivery)
- `resolved`: 是否已解决 (true/false)

---

## 5. 报告导出

### 导出配送报告
```
GET /api/report/delivery/export
```

**查询参数**:
- `start_date`: 开始日期
- `end_date`: 结束日期
- `status`: 状态
- `delivered_by`: 配送员
- `format`: 格式 (csv/json)，默认 csv

**响应**: 文件下载

### 导出老人报告
```
GET /api/report/elderly/export
```

**查询参数**:
- `name`: 姓名
- `chronic_disease`: 慢性病
- `dietary_restriction`: 饮食忌口
- `format`: 格式 (csv/json)

### 获取配送统计
```
GET /api/report/delivery/statistics
```

**查询参数**:
- `start_date`: 开始日期
- `end_date`: 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total": 100,
    "by_status": [
      { "status": "completed", "count": 85 },
      { "status": "pending", "count": 10 },
      { "status": "cancelled", "count": 5 }
    ],
    "by_meal_type": [
      { "meal_type": "lunch", "count": 50 },
      { "meal_type": "breakfast", "count": 25 },
      { "meal_type": "dinner", "count": 25 }
    ],
    "daily_stats": [...]
  }
}
```

---

## 6. 操作历史

### 获取操作历史
```
GET /api/history
```

**查询参数**:
- `operation_type`: 操作类型 (create/update/delete/import)
- `entity_type`: 实体类型 (elderly/menu_item/delivery等)
- `operator`: 操作人
- `start_date`: 开始日期
- `end_date`: 结束日期

### 获取单条历史记录
```
GET /api/history/:id
```

---

## 错误处理

所有接口遵循统一的错误响应格式:

```json
{
  "success": false,
  "error": "错误信息"
}
```

**HTTP状态码**:
- `200`: 成功
- `201`: 创建成功
- `400`: 请求参数错误
- `404`: 资源不存在
- `500`: 服务器内部错误

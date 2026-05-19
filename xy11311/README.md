# 社区食堂配餐管理系统

专为社区食堂负责人设计的后端工具，解决老人忌口、慢病标签和配送路线的人工记忆问题，避免换菜单时配错餐。

## ✨ 功能特性

- **糖尿病禁忌校验**：自动识别高糖食物并拦截
- **过敏优先检测**：检测菜单中是否含有过敏源
- **改餐历史留存**：每次改餐都保留完整历史记录
- **多维度筛选**：按负责人、时间、状态、异常类型筛选
- **Excel导出**：导出与查询结果一致的配餐报告
- **原因可追溯**：每条记录都有明确的拦截/放行原因

## 🚀 快速开始

### 环境要求

- Python 3.8+
- pip 包管理器

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档

打开浏览器访问：`http://localhost:8000/docs`

可以看到完整的API接口文档，并直接在浏览器中测试接口。

## 📋 完整操作流程

### 一、导入老人信息

#### 方式1：使用curl命令

```bash
curl -X POST "http://localhost:8000/elderly/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张爷爷",
    "room_number": "101室",
    "delivery_route": "A线-1号楼",
    "phone": "13800138001",
    "chronic_conditions": "糖尿病,高血压",
    "allergies": "海鲜",
    "dietary_restrictions": "辛辣",
    "notes": "需要软食"
  }'
```

#### 方式2：查看所有老人信息

```bash
curl "http://localhost:8000/elderly/"
```

### 二、配餐录入与自动校验

系统会自动校验菜单是否符合老人的饮食禁忌。

#### 1. 正常配餐示例（会通过）

```bash
curl -X POST "http://localhost:8000/meals/" \
  -H "Content-Type: application/json" \
  -d '{
    "elderly_id": 1,
    "meal_date": "2024-01-15T12:00:00",
    "meal_type": "午餐",
    "menu_items": "米饭,清蒸鱼,炒青菜,冬瓜汤",
    "handled_by": "张管理员"
  }'
```

预期返回：
```json
{
  "status": "通过",
  "exception_type": "无异常",
  "reason": "配餐符合所有饮食要求"
}
```

#### 2. 糖尿病禁忌示例（会被拦截）

```bash
curl -X POST "http://localhost:8000/meals/" \
  -H "Content-Type: application/json" \
  -d '{
    "elderly_id": 1,
    "meal_date": "2024-01-15T12:00:00",
    "meal_type": "午餐",
    "menu_items": "米饭,红烧肉,炒青菜,水果蛋糕",
    "handled_by": "张管理员"
  }'
```

预期返回：
```json
{
  "status": "拦截",
  "exception_type": "糖尿病禁忌",
  "reason": "菜单包含糖尿病禁忌食物：蛋糕"
}
```

#### 3. 过敏风险示例（会被拦截）

```bash
curl -X POST "http://localhost:8000/meals/" \
  -H "Content-Type: application/json" \
  -d '{
    "elderly_id": 2,
    "meal_date": "2024-01-15T12:00:00",
    "meal_type": "午餐",
    "menu_items": "馒头,宫保鸡丁,花生粥",
    "handled_by": "张管理员"
  }'
```

预期返回：
```json
{
  "status": "拦截",
  "exception_type": "过敏风险",
  "reason": "菜单包含过敏食材：花生"
}
```

### 三、改餐操作（自动保留历史）

如果需要修改已录入的配餐：

```bash
curl -X PUT "http://localhost:8000/meals/2" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_items": "米饭,红烧肉,炒青菜,苹果",
    "changed_by": "李管理员",
    "change_reason": "家属要求更换蛋糕为水果"
  }'
```

查看改餐历史：
```bash
curl "http://localhost:8000/meals/2/history"
```

### 四、复核与筛选查询

#### 1. 查询所有拦截记录

```bash
curl "http://localhost:8000/meals/?status=拦截"
```

#### 2. 按负责人筛选

```bash
curl "http://localhost:8000/meals/?handled_by=张管理员"
```

#### 3. 按异常类型筛选

```bash
# 糖尿病禁忌
curl "http://localhost:8000/meals/?exception_type=糖尿病禁忌"

# 过敏风险
curl "http://localhost:8000/meals/?exception_type=过敏风险"
```

#### 4. 按时间范围筛选

```bash
curl "http://localhost:8000/meals/?start_date=2024-01-01T00:00:00&end_date=2024-01-31T23:59:59"
```

#### 5. 组合筛选示例

```bash
curl "http://localhost:8000/meals/?status=拦截&handled_by=张管理员"
```

### 五、导出Excel报告

#### 1. 导出全部配餐记录

在浏览器中访问：
```
http://localhost:8000/export/meals
```

或使用curl下载：
```bash
curl -O "http://localhost:8000/export/meals"
```

#### 2. 导出筛选后的记录

```bash
# 只导出拦截记录
curl -O "http://localhost:8000/export/meals?status=拦截"

# 导出某负责人的所有记录
curl -O "http://localhost:8000/export/meals?handled_by=张管理员"

# 导出糖尿病禁忌相关记录
curl -O "http://localhost:8000/export/meals?exception_type=糖尿病禁忌"
```

## 🧪 一键运行完整演示

我们提供了测试脚本，可以一键运行所有流程：

```bash
# 先启动服务（在另一个终端窗口）
python main.py

# 然后运行演示脚本
python test_flow.py
```

演示脚本会自动完成：
1. 添加3位老人的信息（包含各种慢病和过敏）
2. 测试5种不同配餐场景（正常、糖尿病禁忌、过敏等）
3. 演示改餐流程并查看历史记录
4. 展示各种筛选查询方式
5. 导出Excel报告
6. 展示如何向老人/家属解释拦截原因

## 📊 糖尿病禁忌食物清单

系统自动识别以下高糖食物：
- 糖、红糖、白糖、冰糖、糖浆
- 蜂蜜、蛋糕、巧克力、糖果
- 冰淇淋、奶茶、可乐、雪碧、果汁
- 甜点、月饼、汤圆、粽子、蜜饯、果酱
- 甜甜圈、马卡龙、曲奇、饼干

## 💡 使用技巧

### 如何向老人/家属解释拦截原因？

查询单条记录详情：
```bash
curl "http://localhost:8000/meals/2"
```

根据返回的`reason`字段，可以这样解释：

> "您好，张爷爷的这餐饭因为菜单包含糖尿病禁忌食物：蛋糕，所以被系统拦截了。我们已经安排重新调配适合的餐食，请放心。"

### 批量录入建议

1. 先统一录入所有老人信息
2. 每天集中录入配餐
3. 录入后立即筛选"拦截"状态的记录进行复核
4. 需要改餐时记录明确的改餐原因
5. 每天下班前导出当天的配餐报告存档

## 🔧 项目结构

```
.
├── main.py              # FastAPI主应用，包含所有API接口
├── models.py            # 数据模型定义
├── schemas.py           # Pydantic请求/响应模型
├── validator.py         # 配餐校验逻辑
├── database.py          # 数据库配置
├── test_flow.py         # 流程演示脚本
├── requirements.txt     # 依赖包列表
├── README.md           # 本文档
└── canteen.db          # SQLite数据库（运行后自动生成）
```

## 📝 API接口概览

### 老人信息管理
- `POST /elderly/` - 添加老人信息
- `GET /elderly/` - 获取老人列表
- `GET /elderly/{id}` - 获取单个老人信息
- `PUT /elderly/{id}` - 更新老人信息

### 配餐管理
- `POST /meals/validate` - 校验配餐（不保存）
- `POST /meals/` - 创建配餐记录（自动校验）
- `GET /meals/` - 查询配餐记录（支持筛选）
- `GET /meals/{id}` - 获取单条配餐详情
- `PUT /meals/{id}` - 修改配餐（保留历史）
- `GET /meals/{id}/history` - 查看改餐历史

### 导出报告
- `GET /export/meals` - 导出Excel报告（支持筛选参数）

## 🤔 常见问题

**Q: 如何添加新的禁忌食物？**
A: 编辑 `validator.py` 中的 `DIABETES_FORBIDDEN` 集合，添加新的食物关键词。

**Q: 数据库在哪里？**
A: 数据保存在 `canteen.db` 文件中，这是一个SQLite数据库，可以使用SQLite工具查看。

**Q: 如何备份数据？**
A: 直接复制 `canteen.db` 文件即可完成备份。

**Q: 可以部署到服务器吗？**
A: 可以！使用 `uvicorn main:app --host 0.0.0.0 --port 8000` 启动即可。

## 📞 技术支持

如有问题，请查看API文档：`http://localhost:8000/docs`

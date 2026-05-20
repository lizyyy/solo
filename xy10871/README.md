# API 教程进度服务

让开发者边看教程边真实调用接口的交互式学习平台。

## ✨ 功能特性

- 🎯 **关卡式学习**: 循序渐进的 API 练习关卡
- 🔑 **凭证管理**: 每个开发者独立的 API Key/Secret
- 📊 **实时反馈**: 错误参数即时指出原因
- 📝 **请求历史**: 记录所有练习请求和结果
- 👨‍💼 **管理后台**: 查看开发者卡住情况统计
- 🏆 **完成证明**: 全部通关后可导出完成证明

## 🚀 快速启动

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. (可选) 初始化演示数据

在新终端中运行：
```bash
cd backend
python3 init_demo_data.py
```

将预置以下演示场景：
- dev1: 全部通关
- dev2: 凭证已禁用（过期演示）
- dev3: 第一关重复提交6次后通过
- dev4: 卡在第二关

### 4. 访问前端

直接在浏览器中打开 `frontend/index.html` 文件即可

## 🎮 使用指南

### 默认测试账号

系统启动时会自动创建测试开发者。运行 `init_demo_data.py` 后将有完整演示数据：

| 账号 | API Key | 状态 | 说明 |
|------|---------|------|------|
| dev1 | `ak_test_001` | ✅ 活跃 | 全部通关，可导出证明 |
| dev2 | `ak_test_002` | ❌ 禁用 | 演示凭证过期场景 |
| dev3 | `ak_test_003` | ✅ 活跃 | 第一关重复提交6次后通过 |
| dev4 | `ak_test_004` | ✅ 活跃 | 卡在第二关 |

**默认凭证：**
- API Key: `ak_test_001`
- API Secret: `sk_test_001_secret`

### 模拟一次练习调用

#### 第一关：获取访问令牌

1. 在"练习控制台"填写请求体：

```json
{
  "client_id": "ak_test_001",
  "client_secret": "sk_test_001_secret",
  "grant_type": "client_credentials"
}
```

2. 点击"提交练习"

#### 第二关：获取用户信息

1. 请求头填写：

```json
{
  "Authorization": "Bearer mock_token_ak_test_001"
}
```

2. 请求体留空，点击提交

#### 第三关：创建订单

1. 请求体填写：

```json
{
  "user_id": "user_ak_test_001",
  "product_id": "prod_001",
  "quantity": 1
}
```

### 常见错误场景演示

| 场景 | 操作 | 预期结果 |
|------|------|----------|
| ✅ 成功调用 | 使用正确的参数 | 返回成功响应 |
| ❌ 参数错误 | 缺少必填字段或格式错误 | 具体指出哪个参数有问题 |
| 🔑 凭证过期 | 使用 `ak_test_002` | 返回凭证禁用错误 |
| 🔄 重复提交 | 同一关卡多次尝试 | 记录尝试次数，不影响进度 |

## 👨‍💼 管理功能

### 查看卡点统计

在前端页面右侧切换到"⚙️ 管理后台"标签，点击"刷新统计数据"即可查看：
- 每个关卡的完成率
- 每个关卡卡住的开发者数量

### 导出完成证明

1. 在管理后台输入开发者 ID（默认为 1）
2. 点击"生成证明"
3. 如果该开发者已完成全部关卡，将显示完成证书

## 🔌 API 接口文档

### 公共接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/lessons` | 获取所有关卡列表 |
| GET | `/api/progress` | 获取当前开发者进度 |
| POST | `/api/practice` | 提交练习请求 |
| GET | `/api/requests` | 获取请求历史 |

### 管理接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/stuck-points` | 获取卡点统计 |
| GET | `/api/admin/certificate/{dev_id}` | 生成完成证明 |

## 📁 项目结构

```
.
├── backend/
│   ├── main.py           # 主应用入口
│   ├── database.py       # 数据库模型
│   ├── requirements.txt  # Python 依赖
│   └── api_tutorial.db  # SQLite 数据库（自动创建）
├── frontend/
│   └── index.html        # 前端页面
└── README.md             # 使用说明
```

## 💡 设计说明

### 数据模型

- **Developer**: 开发者信息，包含 API 凭证
- **Lesson**: 教程关卡定义
- **Progress**: 开发者进度记录
- **PracticeRequest**: 练习请求历史记录

### 验证逻辑

每个关卡都有独立的验证逻辑：
1. 检查必填参数
2. 验证参数格式
3. 业务逻辑校验
4. 返回成功/失败结果

### 错误处理

系统会针对常见错误给出友好的提示和下一步建议，帮助开发者快速定位问题。

## 🎯 扩展开发

如需添加新关卡，修改 `backend/main.py` 中 `startup_event` 函数内的 lessons 数组即可。

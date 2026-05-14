# 优惠规则试算器

一个全栈应用，用于管理和试算优惠规则，支持互斥规则检查、人工修正和历史回滚。

## 功能特性

### 后端功能 (Python Flask)
- **优惠试算接口：支持多优惠券组合试算
- **互斥规则检查：
  - R001: 满减与折扣互斥
  - R002: 同类型优惠券互斥
- **状态区分**：成功(success)、待复核(pending_review)、已拦截(blocked)、可重试(retryable)
- **修正接口**：支持人工强制通过互斥规则
- **回滚接口**：支持回滚到历史版本
- **批量导入接口**：支持批量试算
- **查询接口**：试算明细、价格解释、购物车快照

### 前端功能 (HTML/JS)
- **试算列表**：查看所有试算记录，支持按状态筛选
- **新建试算**：选择购物车和优惠券进行试算
- **批量导入**：通过JSON批量导入试算数据
- **互斥规则**：查看当前生效的互斥规则配置
- **详情弹窗**：
  - 错误明细展示
  - 价格计算明细
  - 购物车原始数据
  - 历史版本回滚入口
  - 修正/强制通过按钮

## 预置样例数据

### 购物车
- **CART001**：iPhone 15 (¥6999) + AirPods Pro ×2 (¥3798) = 总计 ¥10797

### 优惠券
- **CP001**：满5000减500 (fixed_amount)
- **CP002**：9折优惠券 (percentage)
- **CP003**：满3000减300 (fixed_amount)
- **CP004**：85折优惠券 (percentage)
- **CP005**：脏数据-无效类型 (invalid_type)

### 测试场景
1. **成功场景**：使用单个优惠券（如 CP001 或 CP002）
2. **互斥拦截场景**：同时使用 CP001 + CP002（满减+折扣互斥）
3. **同类型互斥场景**：同时使用 CP001 + CP003（两个满减互斥）
4. **脏数据场景**：使用 CP005（类型无效，被拦截）

## 启动方式

```bash
# 方式1：使用启动脚本
./start.sh

# 方式2：手动启动
cd backend
pip install -r requirements.txt
python app.py

# 然后用浏览器打开 frontend/index.html
```

## API接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/trial` | POST | 创建试算 |
| `/api/trial/<id>` | GET | 查询试算明细 |
| `/api/trials` | GET | 列出所有试算 |
| `/api/trial/<id>/correct` | POST | 修正/强制通过 |
| `/api/trial/<id>/rollback` | POST | 回滚版本 |
| `/api/batch/import` | POST | 批量导入 |
| `/api/rules` | GET | 查询互斥规则 |
| `/api/stats` | GET | 统计数据 |

## 目录结构

```
.
├── backend/
│   ├── app.py              # Flask后端主程序
│   └── requirements.txt    # Python依赖
├── frontend/
│   ├── index.html          # 主页面
│   └── static/
│       ├── style.css       # 样式文件
│       └── app.js          # 前端逻辑
└── start.sh                # 启动脚本
```

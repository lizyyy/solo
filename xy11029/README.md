# 骑行俱乐部骑行保险报案 API

## 项目简介

这是一个专为骑行俱乐部设计的骑行保险报案管理系统 API，支持报案记录的创建、查询、修改、删除，以及批量导入和导出功能。系统特别处理了同一事故多人报案的场景，支持不同照片来源的记录管理，并提供理赔包一致性检查。

## 技术栈

- Node.js + Express
- SQLite3 数据库
- CSV 导入/导出支持

## 安装与启动

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库并导入样例数据

```bash
npm run init-db
npm run import-sample
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

---

## 验收流程

### 一、创建报案记录

#### 1. 创建单个报案

**请求方式:** POST `/api/reports`

**请求示例:**

```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "report_no": "BXBA20240510001",
    "report_date": "2024-05-10",
    "reporter_name": "测试用户",
    "reporter_phone": "13800138000",
    "reporter_id_card": "110101199001011234",
    "accident_time": "2024-05-10 09:30:00",
    "accident_location": "北京市朝阳区奥林匹克公园",
    "accident_type": "摔车",
    "accident_description": "转弯时不慎摔倒，膝盖擦伤",
    "cycling_route": "奥森南园环线",
    "cycling_distance": 15.5,
    "cycling_duration": 65,
    "policy_no": "PA202401001234",
    "insurance_company": "平安保险",
    "insurance_amount": 50000.00,
    "injured_count": 1,
    "death_count": 0,
    "vehicle_type": "公路车",
    "frame_no": "GNT20231200456",
    "vehicle_brand": "捷安特",
    "photo_source": "手机现场拍摄",
    "photo_count": 5,
    "photo_urls": "https://example.com/photo1.jpg,https://example.com/photo2.jpg",
    "claim_amount": 1200.00,
    "claim_package_no": "LB202405001",
    "status": "pending",
    "responsible_person": "李明",
    "store_name": "朝阳骑行俱乐部",
    "store_address": "北京市朝阳区建国路88号",
    "store_phone": "010-12345678",
    "remarks": "材料待审核"
  }'
```

**预期响应:**

- 状态码: 201
- 返回成功创建的报案记录

---

### 二、查询报案记录

#### 1. 查询所有报案（分页）

**请求方式:** GET `/api/reports`

**请求示例:**

```bash
curl "http://localhost:3000/api/reports?page=1&page_size=10"
```

**预期响应:**

```json
{
  "success": true,
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 5,
      "total_pages": 1
    }
  }
}
```

#### 2. 按日期范围筛选

**请求示例:**

```bash
curl "http://localhost:3000/api/reports?start_date=2024-05-01&end_date=2024-05-05"
```

#### 3. 按状态筛选

**有效状态值:** `pending`(待审核), `reviewing`(审核中), `approved`(已通过), `rejected`(已拒绝), `paid`(已赔付)

**请求示例:**

```bash
curl "http://localhost:3000/api/reports?status=approved"
```

#### 4. 按负责人筛选

**请求示例:**

```bash
curl "http://localhost:3000/api/reports?responsible_person=李明"
```

#### 5. 按门店筛选

**请求示例:**

```bash
curl "http://localhost:3000/api/reports?store_name=朝阳骑行俱乐部"
```

#### 6. 按理赔包编号筛选

**请求示例:**

```bash
curl "http://localhost:3000/api/reports?claim_package_no=LB202405001"
```

**预期结果:** 可以看到同一事故下、照片来源不同的多条报案记录。

#### 7. 查询单个报案详情

**请求方式:** GET `/api/reports/:id`

**请求示例:**

```bash
curl "http://localhost:3000/api/reports/1"
```

---

### 三、修改报案记录

**请求方式:** PUT `/api/reports/:id`

**请求示例:**

```bash
curl -X PUT http://localhost:3000/api/reports/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "claim_amount": 1500.00,
    "remarks": "审核通过，已安排赔付"
  }'
```

**预期响应:**

- 返回更新后的完整报案记录
- `updated_at` 字段自动更新

---

### 四、批量导入报案记录

批量导入时，系统会:

1. **检查理赔包一致性**: 同一理赔包下的事故时间、地点必须一致，不一致时给出警告但不中断导入
2. **支持同一事故不同照片来源**: 多人报案但照片来源不同是允许的，系统会记录每张报案的照片来源
3. **返回行级结果**: 每条记录单独处理，分别返回成功/失败状态和详细信息

**请求方式:** POST `/api/import/batch`

**请求示例:**

```bash
curl -X POST http://localhost:3000/api/import/batch \
  -H "Content-Type: application/json" \
  -d '{
    "skip_on_error": true,
    "items": [
      {
        "report_no": "BXBA20240520001",
        "report_date": "2024-05-20",
        "reporter_name": "张三",
        "reporter_phone": "13900139001",
        "accident_time": "2024-05-20 14:00:00",
        "accident_location": "上海市浦东新区世纪公园",
        "accident_type": "碰撞",
        "policy_no": "SH2024050001",
        "insurance_company": "太保财险",
        "photo_source": "手机拍摄",
        "claim_package_no": "LB2024052001",
        "status": "pending",
        "responsible_person": "王芳",
        "store_name": "浦东骑行之家"
      },
      {
        "report_no": "BXBA20240520002",
        "report_date": "2024-05-20",
        "reporter_name": "李四",
        "reporter_phone": "13900139002",
        "accident_time": "2024-05-20 14:00:00",
        "accident_location": "上海市浦东新区世纪公园",
        "accident_type": "碰撞",
        "policy_no": "SH2024050002",
        "insurance_company": "太保财险",
        "photo_source": "路人拍摄",
        "claim_package_no": "LB2024052001",
        "status": "pending",
        "responsible_person": "王芳",
        "store_name": "浦东骑行之家"
      },
      {
        "report_no": "BXBA20240520003",
        "report_date": "2024-05-20",
        "reporter_name": "王五",
        "reporter_phone": "13900139003",
        "accident_time": "2024-05-20 14:30:00",
        "accident_location": "上海市静安区",
        "accident_type": "摔车",
        "policy_no": "SH2024050003",
        "insurance_company": "太保财险",
        "photo_source": "行车记录仪",
        "claim_package_no": "LB2024052001",
        "status": "pending",
        "responsible_person": "王芳",
        "store_name": "浦东骑行之家"
      }
    ]
  }'
```

**预期响应说明:**

- 第 1、2 条导入成功（同一事故、不同照片来源，符合预期）
- 第 3 条也会成功导入，但会在 `consistency_warnings` 中给出理赔包不一致警告
- 返回每条记录的处理结果，包含成功/失败状态和详细错误/警告信息

---

### 五、导出报案记录

#### 1. 导出为 CSV 文件

**请求方式:** GET `/api/export/csv`

**请求示例:**

```bash
# 导出所有记录
curl -o reports.csv "http://localhost:3000/api/export/csv"

# 按条件筛选导出
curl -o approved_reports.csv "http://localhost:3000/api/export/csv?status=approved&start_date=2024-05-01"
```

**支持的筛选参数:**
- `start_date` - 开始日期
- `end_date` - 结束日期
- `status` - 状态
- `responsible_person` - 负责人
- `store_name` - 门店名称
- `accident_type` - 事故类型
- `insurance_company` - 保险公司
- `claim_package_no` - 理赔包编号

#### 2. 导出为 JSON 文件

**请求方式:** GET `/api/export/json`

**请求示例:**

```bash
curl -o reports.json "http://localhost:3000/api/export/json?store_name=朝阳骑行俱乐部"
```

---

### 六、删除报案记录

**请求方式:** DELETE `/api/reports/:id`

**请求示例:**

```bash
curl -X DELETE "http://localhost:3000/api/reports/1"
```

---

## API 端点汇总

| 方法   | 端点                | 说明                       |
|--------|---------------------|----------------------------|
| GET    | /api/health         | 健康检查                   |
| GET    | /api/reports        | 查询报案列表（支持筛选）   |
| GET    | /api/reports/:id    | 查询单个报案详情           |
| POST   | /api/reports        | 创建报案                   |
| PUT    | /api/reports/:id    | 更新报案                   |
| DELETE | /api/reports/:id    | 删除报案                   |
| POST   | /api/import/batch   | 批量导入（JSON）           |
| POST   | /api/import/csv     | 批量导入（CSV 文件上传）   |
| GET    | /api/export/csv     | 导出 CSV                   |
| GET    | /api/export/json    | 导出 JSON                  |

## 状态定义

| 状态值     | 说明     |
|------------|----------|
| pending    | 待审核   |
| reviewing  | 审核中   |
| approved   | 已通过   |
| rejected   | 已拒绝   |
| paid       | 已赔付   |

## 目录结构

```
.
├── data/                  # 数据目录
│   ├── insurance.db       # SQLite 数据库文件
│   └── sample-data.json   # 样例数据
├── src/
│   ├── database/
│   │   ├── db.js          # 数据库连接封装
│   │   └── schema.sql     # 数据库表结构
│   ├── routes/
│   │   ├── reports.js     # 报案 CRUD 路由
│   │   ├── import.js      # 批量导入路由
│   │   └── export.js      # 导出路由
│   ├── scripts/
│   │   ├── init-db.js     # 数据库初始化脚本
│   │   └── import-sample.js # 导入样例数据脚本
│   └── server.js          # 服务入口
├── package.json
└── README.md
```

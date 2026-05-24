# 屋顶热成像漏水 API

基于 FastAPI + SQLite 的屋顶热成像巡检漏水管理系统，解决点位分散、维修追踪、复测留痕等问题。

## 核心特性

### 1. 点位自动归并
- 基于经纬度（5米范围内自动合并）
- 基于位置描述哈希匹配
- 支持人工手动合并
- 合并历史全程留痕

### 2. 维修状态机
```
待判定 → 已确认待维修 → 维修中 → 待复测 → 验收通过 → 已结案
                ↓                    ↑
              驳回需补证 ←───────────┘
```

### 3. 等级变更审计
- 每次等级变更记录前后值
- 记录操作人、时间、原因
- 审计日志永久保存

### 4. 复测留痕
- 独立复测记录表
- 复测照片、温湿度、结果
- 自动触发状态变更

### 5. 报告导出
- Excel格式导出
- 包含来源材料、处理过程
- 等级变更历史、复测记录

## 快速开始

### 安装依赖
```bash
pip install -r requirements.txt
```

### 启动服务
```bash
python main.py
```

服务启动后访问：
- API文档: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 运行演示
```bash
python test_demo.py
```

## 数据库结构

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| roof_areas | 屋顶区域 | name, building, floor |
| inspection_points | 巡检点位 | point_code, cluster_key, merge_count |
| raw_materials | 原始材料 | thermal_image, leak_level, inspector |
| work_orders | 维修工单 | order_no, status, current_level |
| judgment_records | 判定记录 | judged_level, previous_level, judge |
| retest_records | 复测记录 | retest_no, is_passed, retester |
| status_transitions | 状态流转 | from_status, to_status, operator |
| audit_logs | 审计日志 | old_value, new_value, action_type |
| handlers | 处理人员 | username, role, department |

## API 接口列表

### 基础数据
- `POST /roof-areas/` - 创建屋顶区域
- `GET /roof-areas/` - 屋顶区域列表

### 原始材料
- `POST /raw-materials/` - 上传原始材料（触发点位归并）
- `POST /raw-materials/upload-image` - 上传热成像/可见光图片
- `GET /raw-materials/` - 材料列表

### 巡检点位
- `GET /inspection-points/` - 点位列表
- `POST /inspection-points/merge` - 手动合并点位

### 维修工单
- `POST /work-orders/` - 创建工单
- `GET /work-orders/` - 工单列表
- `GET /work-orders/{id}` - 工单完整详情
- `POST /work-orders/judgment` - 等级判定
- `POST /work-orders/status` - 状态更新
- `POST /work-orders/supplement` - 材料补证
- `POST /work-orders/retest` - 提交复测

### 审计追踪
- `GET /audit-logs/` - 审计日志

### 报告导出
- `POST /reports/export` - 导出Excel报告

### 统计分析
- `GET /statistics/summary` - 统计概览

## 核心业务流程

### 标准流程
1. 上传热成像原始材料 → 自动归并点位
2. 创建维修工单 → 自动关联材料
3. 工程师判定等级 → 生成审计日志
4. 状态流转：确认→维修→待复测
5. 提交复测结果 → 自动通过/继续
6. 导出完整报告

### 驳回补证流程
1. 审核发现证据不足
2. 状态改为「驳回需补证」
3. 上传补充材料关联工单
4. 重新判定后继续流程

## 配置说明

- 数据库文件: `roof_inspection.db`
- 上传目录: `uploads/`
  - `uploads/thermal/` - 热成像图
  - `uploads/visible/` - 可见光图

## 枚举定义

### 漏水等级
- 无渗漏 / 轻微 / 中度 / 严重 / 危急

### 工单状态
- 待判定 / 已确认待维修 / 维修中 / 待复测 / 验收通过 / 驳回需补证 / 已结案

### 人员角色
- 巡检员 / 工程师 / 维修员 / 审核员 / 管理员

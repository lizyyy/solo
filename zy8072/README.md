# 商场用电分摊复核看板

商场招商同事用电分摊复核工具，支持导入电表读数、铺位映射、计费规则和节假日数据，自动检测异常并生成调整建议。

## 功能特性

- **数据导入**: 支持 CSV、JSON、YAML 格式
- **异常检测**:
  - 跨月抄表识别
  - 倍率错误检测
  - 空铺仍计费检测
  - 共享区域分摊异常
  - 缺失读数检测
  - 同一电表挂多铺位
  - 日均用电异常/长期零用电
- **交互筛选**: 按铺位、月份、异常类型筛选
- **可视化对比**: 分摊前后金额/用电量对比图
- **报告导出**: bill_adjustments.csv + review_report.md

## 项目结构

```
.
├── app.py                      # Streamlit 主应用
├── billing_logic.py            # 计费解析核心逻辑
├── anomaly_detection.py        # 异常检测模块
├── test_billing.py             # 单元测试
├── requirements.txt            # 依赖
├── README.md
└── sample_data/
    ├── meter_readings.csv      # 电表读数示例
    ├── shop_meter_mapping.json # 铺位-电表映射
    ├── billing_rules.yaml      # 计费规则
    └── holiday_traffic.csv     # 节假日客流
```

## 本地启动

```bash
# 1. 创建虚拟环境 (推荐)
python -m venv venv
source venv/bin/activate  # macOS/Linux
# 或 venv\Scripts\activate  # Windows

# 2. 安装依赖
pip install -r requirements.txt

# 3. 启动应用
streamlit run app.py

# 4. 浏览器打开 http://localhost:8501
```

## 使用方式

### 方式一：使用示例数据
勾选侧边栏"使用示例数据"，直接加载内置演示数据

### 方式二：导入自己的数据
上传以下文件：
1. **电表读数 CSV** - 必填
   ```csv
   meter_id,meter_name,shop_no,reading_date,reading_value,reading_type
   M001,A区总表,A001,2025-01-01,12000,start
   M001,A区总表,A001,2025-01-31,12500,end
   ```

2. **铺位-电表映射 JSON** - 必填
   ```json
   {
     "meter_shop_mapping": {
       "M001": {
         "shop_no": ["A001"],
         "area_type": "retail",
         "shared_ratio": 0
       }
     },
     "shop_info": {
       "A001": {"shop_name": "服装店", "area": 50, "status": "active"}
     }
   }
   ```

3. **租约计费规则 YAML** - 必填
   ```yaml
   billing_rules:
     default:
       price_per_kwh: 1.2
       service_fee_ratio: 0.1
     anomaly_detection:
       max_monthly_increase_ratio: 2.0
   ```

4. **节假日客流 CSV** - 可选
   ```csv
   date,holiday_name,visitor_count,is_holiday,is_weekend
   2025-01-01,元旦,15000,true,false
   ```

## 运行测试

```bash
# 运行所有测试
pytest test_billing.py -v

# 运行特定测试类
pytest test_billing.py::TestMeterDataParser -v

# 查看测试覆盖
pytest test_billing.py --cov=. --cov-report=term-missing
```

## 数据格式说明

### 电表读数 CSV

| 字段 | 类型 | 说明 |
|------|------|------|
| meter_id | string | 电表唯一标识 |
| meter_name | string | 电表名称 |
| shop_no | string | 铺位编号，共享区域用 SHARED_AREA |
| reading_date | date | 读数日期 YYYY-MM-DD |
| reading_value | number | 读数值 |
| reading_type | string | start(月初)/end(月末) |

### 铺位-电表映射 JSON

- `meter_shop_mapping`: 电表到铺位的映射
  - `shop_no`: 关联铺位列表
  - `area_type`: retail/food_court/shared
  - `shared_ratio`: 共享分摊比例
  - `multiplier`: 倍率(默认1)
- `shop_info`: 铺位信息
  - `status`: active/vacant

### 计费规则 YAML

- `default`: 默认计费参数
- `area_type_multipliers`: 区域类型系数
- `shop_billing_rules`: 单铺位特殊规则
- `anomaly_detection`: 异常检测阈值

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 缺失读数(2月无记录) | 跳过该月，检测为异常 |
| 同一电表挂多铺位 | 分摊检测，警告提示 |
| 空铺仍计费 | 检测为异常，建议免收 |
| 跨月抄表 | 检测间隔天数，标记异常 |
| 倍率异常 | 环比增长超阈值标记 |
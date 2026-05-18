# 公益助餐点助餐券资格核验API

支持批量补录和单条人工处理的助餐券资格核验系统。

## 功能特性

### 核心功能
- ✅ 单条助餐券资格核验
- ✅ 批量Excel导入补录
- ✅ 助餐券撤回功能
- ✅ 补贴等级调整（旧券仍可核销）
- ✅ 月报一致性检查
- ✅ 材料缺失提示（告诉调用方需要补什么材料）

### 核验规则（5条）
| 规则ID | 规则名称 | 说明 |
|--------|----------|------|
| R001 | 身份证格式校验 | 检查身份证号格式是否正确 |
| R002 | 有效期校验 | 检查助餐券是否在有效期内 |
| R003 | 补贴等级匹配校验 | A级需80岁以上或低保，B级需70岁以上或残疾 |
| R004 | 必备材料校验 | 检查户口本、收入证明、对应人群证件是否齐全 |
| R005 | 助餐点有效性校验 | 检查助餐点编号是否在有效列表内 |

### 业务字段
- 助餐券编号、身份证号、姓名、电话、地址、社区
- 补贴等级（A/B/C）、补贴金额、发放日期、有效期
- 助餐点名称、助餐点编号
- 申请人类型（老年人/残疾人/低保户）
- 家庭状况、收入水平
- 残疾类型/等级、老年人年龄
- 各类证明文件及编号（低保证、残疾证、老年证等）
- 核验状态、券状态、核验时间、核验人、操作人

## 快速开始

### 安装依赖
```bash
pip3 install -r requirements.txt
```

### 运行测试（一条命令）
```bash
python3 -m pytest -v
```

测试失败时会明确显示是哪条规则没通过，例如：
```
R001[身份证格式校验]: 身份证号长度应为18位
```

### 启动API服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档

## API接口

### 单条处理入口
- `POST /api/v1/vouchers` - 单条创建助餐券
- `POST /api/v1/vouchers/verify` - 单条核验资格
- `POST /api/v1/vouchers/{voucher_no}/subsidy-level` - 调整补贴等级
- `DELETE /api/v1/vouchers/{voucher_no}` - 撤回助餐券

### 批量补录入口
- `POST /api/v1/vouchers/batch-import` - Excel批量导入补录

### 查询导出
- `GET /api/v1/vouchers` - 查询所有助餐券
- `GET /api/v1/vouchers/{voucher_no}` - 查询单条助餐券
- `POST /api/v1/vouchers/export` - 导出Excel（保留关键业务列，便于台账核对）

## 项目结构

```
.
├── app/
│   ├── main.py              # 应用入口
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1.py            # API路由
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py       # 数据模型
│   ├── services/
│   │   ├── __init__.py
│   │   ├── database.py      # 内存数据库
│   │   ├── verification.py  # 核验核心逻辑
│   │   └── import_export.py # 导入导出服务
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       └── test_verification.py  # 测试用例
├── requirements.txt
├── pytest.ini
└── README.md
```

## 核验结果说明

### 核验状态
- `待核验` - 刚创建未核验
- `已通过` - 所有规则校验通过
- `已驳回` - 关键规则校验不通过
- `需补材料` - 缺少必备材料
- `已撤回` - 人工撤回

### 结果字段
- `status` - 核验状态
- `failed_rules` - 失败的规则列表（含规则ID、名称、原因）
- `required_materials` - 需要补充的材料列表
- `monthly_report_consistent` - 月报是否一致
- `old_voucher_usable` - 补贴等级调整后旧券是否仍可核销

## 示例数据

测试中包含5条真实场景的样例数据：
- 李大爷（85岁，A级补贴）
- 王阿姨（72岁，B级补贴）
- 赵叔叔（残疾人，B级补贴）
- 刘奶奶（78岁+低保，A级补贴）
- 陈叔叔（低保户，B级补贴）

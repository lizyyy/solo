import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from schemas import InquiryFormCreate, BatchCreate

SUPPLIERS = [
    "北京华腾科技有限公司", "上海精密仪器仪表厂", "深圳电子元器件集团",
    "广州机械制造有限公司", "成都工业材料供应站", "杭州精密零部件厂",
    "武汉重型机械配件公司", "南京化工原料有限公司", "天津金属材料集团",
    "重庆工业设备供应商", "西安电子科技有限公司", "苏州精密机械厂"
]

MATERIALS = [
    {"code": "MAT-001", "name": "不锈钢螺栓", "spec": "M12×50mm, 304材质", "unit": "个"},
    {"code": "MAT-002", "name": "高密度聚乙烯板", "spec": "1000×2000×10mm", "unit": "张"},
    {"code": "MAT-003", "name": "精密轴承", "spec": "6205-2RS, SKF品牌", "unit": "套"},
    {"code": "MAT-004", "name": "工业润滑油", "spec": "ISO VG46, 200L桶装", "unit": "桶"},
    {"code": "MAT-005", "name": "PVC电线管", "spec": "DN25, 4米/根", "unit": "根"},
    {"code": "MAT-006", "name": "三相异步电机", "spec": "Y132M-4, 7.5kW", "unit": "台"},
    {"code": "MAT-007", "name": "不锈钢无缝管", "spec": "Φ57×3.5mm, 316L", "unit": "米"},
    {"code": "MAT-008", "name": "工业橡胶密封圈", "spec": "Φ100×10mm, NBR材质", "unit": "个"},
    {"code": "MAT-009", "name": "铜芯电力电缆", "spec": "VV-3×16+1×10mm²", "unit": "米"},
    {"code": "MAT-010", "name": "铝合金型材", "spec": "6061-T6, 40×40方管", "unit": "米"},
    {"code": "MAT-011", "name": "碳化钨合金刀具", "spec": "DNMG150608-PM", "unit": "片"},
    {"code": "MAT-012", "name": "工业用活性炭", "spec": "柱状, 碘值1000mg/g", "unit": "kg"}
]

DEPARTMENTS = [
    "生产一部", "生产二部", "设备维修部", "质量控制部",
    "采购部", "技术研发部", "仓储物流部", "安全环保部"
]

APPLICANTS = [
    "张三", "李四", "王五", "赵六", "钱七", "孙八",
    "周九", "吴十", "郑十一", "王十二", "李十三", "张十四"
]

OPERATORS = ["审核员_A", "审核员_B", "审核员_C", "审核员_D", "系统管理员"]

def generate_form_no() -> str:
    date_str = datetime.now().strftime("%Y%m%d")
    seq = random.randint(1000, 9999)
    return f"XJ-{date_str}-{seq}"

def generate_inquiry_form(dirty: bool = False, swallow: bool = False) -> Dict[str, Any]:
    material = random.choice(MATERIALS)
    base_quantity = random.randint(10, 500)
    base_price = random.uniform(10, 5000)
    
    form_data = {
        "form_no": generate_form_no(),
        "supplier_name": random.choice(SUPPLIERS),
        "material_code": material["code"],
        "material_name": material["name"],
        "specification": material["spec"],
        "quantity": base_quantity,
        "unit": material["unit"],
        "quoted_price": round(base_price * (1 + random.uniform(-0.1, 0.1)), 2),
        "currency": "CNY",
        "delivery_period": f"{random.randint(3, 30)}天",
        "payment_terms": random.choice(["货到付款", "预付30%", "月结60天", "款到发货"]),
        "contact_person": random.choice(["刘经理", "陈主管", "杨专员", "黄组长"]),
        "contact_phone": f"1{random.randint(3,9)}{random.randint(100000000, 999999999)}",
        "department": random.choice(DEPARTMENTS),
        "applicant": random.choice(APPLICANTS),
        "application_date": datetime.now() - timedelta(days=random.randint(0, 30)),
        "remark": ""
    }
    
    if dirty:
        dirty_type = random.randint(1, 5)
        if dirty_type == 1:
            form_data["quoted_price"] = -abs(form_data["quoted_price"])
            form_data["remark"] = "价格异常"
        elif dirty_type == 2:
            form_data["quantity"] = -abs(form_data["quantity"])
            form_data["remark"] = "数量异常"
        elif dirty_type == 3:
            form_data["supplier_name"] = ""
            form_data["remark"] = "供应商缺失"
        elif dirty_type == 4:
            form_data["material_code"] = "INVALID-CODE-999"
            form_data["remark"] = "物料编码错误"
        elif dirty_type == 5:
            form_data["contact_phone"] = "无效电话"
            form_data["remark"] = "联系方式无效"
    
    if swallow:
        form_data["remark"] = "脏行记录 - 此记录将被吞掉"
        form_data["material_code"] = "SWALLOW-" + form_data["material_code"]
    
    return form_data

def generate_batch_data(batch_size: int = 20, dirty_count: int = 3, swallow_count: int = 1) -> Dict[str, Any]:
    batch_no = f"PC-{datetime.now().strftime('%Y%m%d')}-{random.randint(100, 999)}"
    
    forms = []
    
    for i in range(batch_size - dirty_count - swallow_count):
        forms.append(generate_inquiry_form(dirty=False, swallow=False))
    
    for i in range(dirty_count):
        forms.append(generate_inquiry_form(dirty=True, swallow=False))
    
    for i in range(swallow_count):
        forms.append(generate_inquiry_form(dirty=True, swallow=True))
    
    random.shuffle(forms)
    
    return {
        "batch_info": {
            "batch_no": batch_no,
            "operator": random.choice(OPERATORS),
            "department": random.choice(DEPARTMENTS)
        },
        "forms": forms
    }

def generate_multiple_batches(count: int = 3) -> List[Dict[str, Any]]:
    batches = []
    sizes = [15, 20, 25, 30]
    
    for i in range(count):
        size = random.choice(sizes)
        batch_data = generate_batch_data(
            batch_size=size,
            dirty_count=random.randint(2, 5),
            swallow_count=1
        )
        batches.append(batch_data)
    
    return batches

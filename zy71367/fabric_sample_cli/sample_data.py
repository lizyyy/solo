from datetime import date, timedelta
from .models import Supplier, FabricSample, Garment, InspectionStatus
from .color_validator import ColorValidator
from .storage import StorageManager


def create_sample_data(store, color_validator, today=None):
    if today is None:
        today = date.today()

    suppliers = [
        Supplier(
            supplier_id="SUP-001",
            supplier_name="江苏阳光毛纺织有限公司",
            contact_person="张经理",
            contact_phone="13800138001",
            address="江苏省苏州市工业园区纺织大道88号",
            remark="长期合作供应商，主打羊毛面料质量稳定"
        ),
        Supplier(
            supplier_id="SUP-002",
            supplier_name="浙江柯桥丝绸集团",
            contact_person="李厂长",
            contact_phone="13900139002",
            address="浙江省绍兴市柯桥区中国轻纺城",
            remark="真丝面料专业供应商，货期有时延误"
        ),
        Supplier(
            supplier_id="SUP-003",
            supplier_name="广东东莞针织面料厂",
            contact_person="王主管",
            contact_phone="13700137003",
            address="广东省东莞市虎门镇布料市场",
            remark="针织面料，起订量小，适合小批量"
        ),
        Supplier(
            supplier_id="SUP-004",
            supplier_name="上海皮革制品有限公司",
            contact_person="赵总",
            contact_phone="13600136004",
            address="上海市浦东新区张江高科技园区",
            remark="高端皮革面料，价格较高"
        ),
    ]
    for s in suppliers:
        store.suppliers[s.supplier_id] = s

    samples_data = [
        {
            "sample_id": "SAMP-001-A",
            "fabric_name": "80支精纺羊毛面料",
            "fabric_type": "100%澳毛，精纺，克重280g/㎡",
            "color_code": "#DC143C",
            "color_name": "大红",
            "supplier_id": "SUP-001",
            "expected_arrival": today - timedelta(days=5),
            "arrival_date": today - timedelta(days=6),
            "inspection_deadline": today - timedelta(days=3),
            "inspection_status": InspectionStatus.PASSED,
            "is_missing": False,
            "remark": "手感细腻，垂感好，注意避光存放",
            "sample_report_path": "/reports/SAMP-001-A.pdf"
        },
        {
            "sample_id": "SAMP-002-B",
            "fabric_name": "16姆米双绉真丝",
            "fabric_type": "100%桑蚕丝，双绉，16姆米",
            "color_code": "255,0,0",
            "color_name": "正红",
            "supplier_id": "SUP-002",
            "expected_arrival": today - timedelta(days=3),
            "arrival_date": today - timedelta(days=2),
            "inspection_deadline": today - timedelta(days=1),
            "inspection_status": InspectionStatus.IN_PROGRESS,
            "is_missing": False,
            "remark": "有轻微色差，需与设计师确认",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-003-C",
            "fabric_name": "40支精梳棉汗布",
            "fabric_type": "100%新疆长绒棉，精梳，210g/㎡",
            "color_code": "PANTONE 186 C",
            "color_name": "中国红",
            "supplier_id": "SUP-003",
            "expected_arrival": today - timedelta(days=2),
            "arrival_date": None,
            "inspection_deadline": today + timedelta(days=2),
            "inspection_status": InspectionStatus.PENDING,
            "is_missing": False,
            "remark": "供应商说发错了色号，等通知",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-004-D",
            "fabric_name": "藏青色哔叽毛料",
            "fabric_type": "70%羊毛30%涤纶，哔叽，克重320g/㎡",
            "color_code": "藏蓝",
            "color_name": "藏蓝",
            "supplier_id": "SUP-001",
            "expected_arrival": today - timedelta(days=7),
            "arrival_date": today - timedelta(days=8),
            "inspection_deadline": today - timedelta(days=4),
            "inspection_status": InspectionStatus.PASSED,
            "is_missing": False,
            "remark": "样卡边缘有污渍，不影响大货",
            "sample_report_path": "/reports/SAMP-004-D.pdf"
        },
        {
            "sample_id": "SAMP-005-E",
            "fabric_name": "米白色山羊绒针织",
            "fabric_type": "100%山羊绒，平针，克重260g/㎡",
            "color_code": "#F5F5DC",
            "color_name": "米白",
            "supplier_id": "SUP-003",
            "expected_arrival": today + timedelta(days=1),
            "arrival_date": None,
            "inspection_deadline": today + timedelta(days=5),
            "inspection_status": InspectionStatus.PENDING,
            "is_missing": False,
            "remark": "注意与象牙白样卡对比，确认哪个更适合",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-006-F",
            "fabric_name": "头层牛皮荔枝纹",
            "fabric_type": "头层黄牛皮，荔枝纹，厚度1.2mm",
            "color_code": "#000000",
            "color_name": "黑色",
            "supplier_id": "SUP-004",
            "expected_arrival": today - timedelta(days=10),
            "arrival_date": today + timedelta(days=5),
            "inspection_deadline": today,
            "inspection_status": InspectionStatus.PENDING,
            "is_missing": False,
            "remark": "严重逾期！！供应商解释是海关查验延误",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-007-G",
            "fabric_name": "军绿色纯棉帆布",
            "fabric_type": "100%棉，重磅帆布，克重400g/㎡",
            "color_code": "军绿",
            "color_name": "军绿",
            "supplier_id": "SUP-001",
            "expected_arrival": today - timedelta(days=4),
            "arrival_date": today - timedelta(days=1),
            "inspection_deadline": today - timedelta(days=10),
            "inspection_status": InspectionStatus.FAILED,
            "is_missing": False,
            "remark": "❗状态流转异常测试：检验状态为检验不合格，但到货晚于检验截止",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-008-H",
            "fabric_name": "酒红色丝绒面料",
            "fabric_type": "聚酯纤维丝绒，不倒绒，克重380g/㎡",
            "color_code": "#722F37",
            "color_name": "酒红",
            "supplier_id": "SUP-002",
            "expected_arrival": today - timedelta(days=15),
            "arrival_date": today - timedelta(days=12),
            "inspection_deadline": today - timedelta(days=8),
            "inspection_status": InspectionStatus.REVOKED,
            "is_missing": False,
            "remark": "样卡退回供应商重新做",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-009-I",
            "fabric_name": "宝蓝色醋酸面料",
            "fabric_type": "100%醋酸纤维，缎面，克重180g/㎡",
            "color_code": "RGB(25,25,112)",
            "color_name": "宝蓝",
            "supplier_id": "SUP-002",
            "expected_arrival": today + timedelta(days=3),
            "arrival_date": None,
            "inspection_deadline": today + timedelta(days=8),
            "inspection_status": InspectionStatus.PENDING,
            "is_missing": True,
            "remark": "样卡丢失！正在联系供应商补发",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-010-J",
            "fabric_name": "驼色羊毛大衣呢",
            "fabric_type": "90%羊毛10%羊绒，双面呢，克重700g/㎡",
            "color_code": "C193, M154, Y107, K0",
            "color_name": "驼色",
            "supplier_id": "SUP-004",
            "expected_arrival": today - timedelta(days=1),
            "arrival_date": today - timedelta(days=1),
            "inspection_deadline": today + timedelta(days=4),
            "inspection_status": InspectionStatus.PENDING,
            "is_missing": False,
            "remark": "CMYK格式色号，需转RGB测试",
            "sample_report_path": None
        },
        {
            "sample_id": "SAMP-011-K",
            "fabric_name": "藕粉色雪纺面料",
            "fabric_type": "100%聚酯纤维，乔其雪纺，克重80g/㎡",
            "color_code": "香芋紫",
            "color_name": "藕粉",
            "supplier_id": "SUP-003",
            "expected_arrival": today - timedelta(days=6),
            "arrival_date": today - timedelta(days=6),
            "inspection_deadline": today - timedelta(days=2),
            "inspection_status": InspectionStatus.REINSPECT,
            "is_missing": False,
            "remark": "颜色名称不一致，设计师说香芋紫和藕粉实际是一个颜色？",
            "sample_report_path": None
        },
    ]

    for sd in samples_data:
        color_spec = color_validator.validate_color_spec(
            sd["color_code"],
            sd["color_name"],
            entity_id=sd["sample_id"],
            entity_type="sample"
        )

        sample = FabricSample(
            sample_id=sd["sample_id"],
            fabric_name=sd["fabric_name"],
            fabric_type=sd["fabric_type"],
            color_spec=color_spec,
            supplier_id=sd["supplier_id"],
            expected_arrival=sd["expected_arrival"],
            arrival_date=sd["arrival_date"],
            inspection_deadline=sd["inspection_deadline"],
            inspection_status=sd["inspection_status"],
            is_missing=sd["is_missing"],
            remark=sd["remark"],
            sample_report_path=sd["sample_report_path"]
        )
        store.samples[sample.sample_id] = sample

    garments_data = [
        {
            "garment_id": "GAR-001",
            "style_name": "修身西装外套",
            "style_code": "SS24-CX-001",
            "color_code": "#DC143C",
            "color_name": "大红",
            "fitting_date": today + timedelta(days=3),
            "show_order": 1,
            "supplier_id": "SUP-001",
            "remark": "开场第一套，红色系主题"
        },
        {
            "garment_id": "GAR-002",
            "style_name": "真丝连衣裙",
            "style_code": "SS24-LYQ-002",
            "color_code": "255,0,0",
            "color_name": "正红",
            "fitting_date": today + timedelta(days=5),
            "show_order": 3,
            "supplier_id": "SUP-002",
            "remark": "注意与西装外套的红色是否一致"
        },
        {
            "garment_id": "GAR-003",
            "style_name": "纯棉T恤",
            "style_code": "SS24-TX-003",
            "color_code": "PANTONE 186 C",
            "color_name": "中国红",
            "fitting_date": today + timedelta(days=4),
            "show_order": 5,
            "supplier_id": "SUP-003",
            "remark": "内搭单品"
        },
        {
            "garment_id": "GAR-004",
            "style_name": "藏青色西装套装",
            "style_code": "SS24-TZ-004",
            "color_code": "藏蓝",
            "color_name": "藏蓝",
            "fitting_date": today + timedelta(days=2),
            "show_order": 7,
            "supplier_id": "SUP-001",
            "remark": "商务系列"
        },
        {
            "garment_id": "GAR-005",
            "style_name": "米白色羊绒开衫",
            "style_code": "SS24-KS-005",
            "color_code": "象牙白",
            "color_name": "米白",
            "fitting_date": today + timedelta(days=6),
            "show_order": 9,
            "supplier_id": "SUP-003",
            "remark": "颜色名称故意混淆测试：样卡是米白，成衣写象牙白"
        },
        {
            "garment_id": "GAR-006",
            "style_name": "黑色皮夹克",
            "style_code": "SS24-PY-006",
            "color_code": "#000000",
            "color_name": "黑色",
            "fitting_date": today + timedelta(days=1),
            "show_order": 11,
            "supplier_id": "SUP-004",
            "remark": "朋克风格"
        },
        {
            "garment_id": "GAR-007",
            "style_name": "军绿色风衣",
            "style_code": "SS24-FY-007",
            "color_code": "军绿",
            "color_name": "军绿",
            "fitting_date": today + timedelta(days=7),
            "show_order": 13,
            "supplier_id": "SUP-001",
            "remark": "工装风格"
        },
        {
            "garment_id": "GAR-008",
            "style_name": "酒红色丝绒长裙",
            "style_code": "SS24-CQ-008",
            "color_code": "#722F37",
            "color_name": "酒红",
            "fitting_date": today + timedelta(days=8),
            "show_order": 15,
            "supplier_id": "SUP-002",
            "remark": "晚宴系列"
        },
        {
            "garment_id": "GAR-009",
            "style_name": "宝蓝色吊带裙",
            "style_code": "SS24-DD-009",
            "color_code": "RGB(25,25,112)",
            "color_name": "宝蓝",
            "fitting_date": today + timedelta(days=4),
            "show_order": 17,
            "supplier_id": "SUP-002",
            "remark": "优雅系列"
        },
        {
            "garment_id": "GAR-010",
            "style_name": "驼色双面呢大衣",
            "style_code": "SS24-DY-010",
            "color_code": "#C19A6B",
            "color_name": "驼色",
            "fitting_date": today + timedelta(days=6),
            "show_order": 19,
            "supplier_id": "SUP-004",
            "remark": "主打款，手工双面呢"
        },
        {
            "garment_id": "GAR-011",
            "style_name": "藕粉色雪纺上衣",
            "style_code": "SS24-SY-011",
            "color_code": "#EDC9AF",
            "color_name": "藕粉",
            "fitting_date": today + timedelta(days=3),
            "show_order": 21,
            "supplier_id": "SUP-003",
            "remark": "颜色名和样卡不一致测试"
        },
        {
            "garment_id": "GAR-012",
            "style_name": "黑色阔腿裤",
            "style_code": "SS24-KK-012",
            "color_code": "碳黑",
            "color_name": "黑色",
            "fitting_date": today + timedelta(days=2),
            "show_order": 2,
            "supplier_id": "SUP-001",
            "remark": "基础款，搭配多套"
        },
    ]

    for gd in garments_data:
        color_spec = color_validator.validate_color_spec(
            gd["color_code"],
            gd["color_name"],
            entity_id=gd["garment_id"],
            entity_type="garment"
        )

        garment = Garment(
            garment_id=gd["garment_id"],
            style_name=gd["style_name"],
            style_code=gd["style_code"],
            color_spec=color_spec,
            fitting_date=gd["fitting_date"],
            show_order=gd["show_order"],
            supplier_id=gd["supplier_id"],
            remark=gd["remark"]
        )
        store.garments[garment.garment_id] = garment

    return store

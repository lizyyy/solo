SAMPLE_STUDENTS = [
    {
        "id": "S001",
        "name": "张三",
        "id_card": "110101201201011234",
        "school": "北京市第一实验小学",
        "class_name": "三年级(2)班",
        "guardian_name": "张大明",
        "guardian_phone": "13800000001"
    },
    {
        "id": "S002",
        "name": "李四",
        "id_card": "110101201202022345",
        "school": "北京市第一实验小学",
        "class_name": "三年级(2)班",
        "guardian_name": "李小明",
        "guardian_phone": "13800000002"
    },
    {
        "id": "S003",
        "name": "王五",
        "id_card": "110101201203033456",
        "school": "北京市第一实验小学",
        "class_name": "三年级(2)班",
        "guardian_name": "王大明",
        "guardian_phone": "13800000003"
    },
    {
        "id": "S004",
        "name": "赵六",
        "id_card": "110101201204044567",
        "school": "北京市第一实验小学",
        "class_name": "三年级(2)班",
        "guardian_name": "赵小明",
        "guardian_phone": "13800000004"
    },
    {
        "id": "S005",
        "name": "孙七",
        "id_card": "110101201205055678",
        "school": "北京市第一实验小学",
        "class_name": "三年级(2)班",
        "guardian_name": "孙大明",
        "guardian_phone": "13800000005"
    }
]

SAMPLE_INSURANCES = [
    {
        "student_name": "张三",
        "student_id_card": "110101201201011234",
        "policy_number": "INS202605001",
        "insurance_company": "平安保险",
        "start_date": "2026-05-10",
        "end_date": "2026-05-20",
        "amount": 200000
    },
    {
        "student_name": "李四",
        "student_id_card": "110101201202029999",
        "policy_number": "INS202605002",
        "insurance_company": "平安保险",
        "start_date": "2026-05-10",
        "end_date": "2026-05-20",
        "amount": 200000
    },
    {
        "student_name": "王五",
        "student_id_card": "110101201203033456",
        "policy_number": "INS202605003",
        "insurance_company": "人保财险",
        "start_date": "2026-05-20",
        "end_date": "2026-05-30",
        "amount": 200000
    },
    {
        "student_name": "赵六",
        "student_id_card": "110101201204044567",
        "policy_number": "INS202605004",
        "insurance_company": "平安保险",
        "start_date": "2026-05-10",
        "end_date": "2026-05-20",
        "amount": 200000
    }
]

SAMPLE_AUTHORIZATIONS = [
    {
        "student_name": "张三",
        "student_id_card": "110101201201011234",
        "guardian_name": "张大明",
        "guardian_id_card": "110101198001011234",
        "relation": "父亲",
        "signature_status": True,
        "emergency_contact": "张大明",
        "emergency_phone": "13800000001",
        "medical_allergy": "无",
        "special_needs": "无"
    },
    {
        "student_name": "李四",
        "student_id_card": "110101201202022345",
        "guardian_name": "李小明",
        "guardian_id_card": "110101198002022345",
        "relation": "母亲",
        "signature_status": True,
        "emergency_contact": "李小明",
        "emergency_phone": "13800000002",
        "medical_allergy": "青霉素",
        "special_needs": "无"
    },
    {
        "student_name": "王五",
        "student_id_card": "110101201203033456",
        "guardian_name": "王大明",
        "guardian_id_card": "110101198003033456",
        "relation": "父亲",
        "signature_status": False,
        "emergency_contact": "王大明",
        "emergency_phone": "13800000003",
        "medical_allergy": "无",
        "special_needs": "晕车"
    },
    {
        "student_name": "孙七",
        "student_id_card": "110101201205055678",
        "guardian_name": "孙大明",
        "guardian_id_card": "110101198005055678",
        "relation": "父亲",
        "signature_status": True,
        "emergency_contact": "孙大明",
        "emergency_phone": "13800000005",
        "medical_allergy": "无",
        "special_needs": "无"
    }
]

SAMPLE_VEHICLES = [
    {
        "plate_number": "京A12345",
        "driver_name": "王师傅",
        "driver_phone": "13900000001",
        "capacity": 20,
        "route": "学校 -> 故宫 -> 科技馆",
        "student_ids": ["S001", "S002", "S003", "S004"]
    },
    {
        "plate_number": "京B67890",
        "driver_name": "李师傅",
        "driver_phone": "13900000002",
        "capacity": 20,
        "route": "学校 -> 故宫 -> 科技馆",
        "student_ids": ["S005"]
    }
]

SAMPLE_WITHDRAWALS = [
    {
        "student_id": "S004",
        "reason": "生病住院，无法参加",
        "withdrawal_date": "2026-05-11",
        "operator": "刘老师",
        "refund_status": "processing"
    }
]

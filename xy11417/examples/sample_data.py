from datetime import datetime

SAMPLE_RESIDENT_SCREENSHOT = {
    "source_type": "resident_screenshot",
    "source_id": "SCREENSHOT-2024-05-001",
    "resident_id": "R001",
    "resident_name": "张三",
    "room_number": "1号楼201室",
    "repair_type": "水电维修",
    "repair_content": "客厅插座不通电，需要检查线路",
    "submit_time": datetime.now().isoformat(),
    "screenshot_urls": [
        "https://example.com/screenshots/20240501_1.jpg",
        "https://example.com/screenshots/20240501_2.jpg"
    ],
    "raw_data": {
        "ocr_text": "业主报修单\n姓名：张三\n房号：1-201\n问题：客厅插座坏了",
        "image_hash": "abc123def456"
    }
}

SAMPLE_TECHNICIAN_RECEIPT = {
    "source_type": "technician_receipt",
    "source_id": "RECEIPT-2024-05-001",
    "resident_id": "R001",
    "resident_name": "张三",
    "room_number": "1号楼201室",
    "repair_type": "水电维修",
    "repair_content": "更换插座面板",
    "submit_time": datetime.now().isoformat(),
    "technician_id": "T007",
    "technician_name": "李师傅",
    "work_hours": 1.5,
    "completion_status": "part_replacement",
    "receipt_number": "RC-20240501-001",
    "raw_data": {
        "receipt_pdf_url": "https://example.com/receipts/RC-20240501-001.pdf"
    }
}

SAMPLE_MATERIAL_FORM = {
    "source_type": "material_form",
    "source_id": "MATERIAL-2024-05-001",
    "resident_id": "R001",
    "resident_name": "张三",
    "room_number": "1号楼201室",
    "repair_type": "水电维修",
    "submit_time": datetime.now().isoformat(),
    "technician_id": "T007",
    "technician_name": "李师傅",
    "material_used": [
        {"item_code": "MAT-001", "name": "五孔插座面板", "quantity": 1, "unit_price": 25.0},
        {"item_code": "MAT-002", "name": "绝缘胶带", "quantity": 1, "unit_price": 5.0},
        {"item_code": "MAT-003", "name": "电线2.5平方", "quantity": 2, "unit_price": 8.0}
    ],
    "material_cost": 46.0,
    "raw_data": {
        "warehouse_outbound_id": "WB-20240501-015"
    }
}

SAMPLE_SUPPLEMENTARY_FORM = {
    "source_type": "supplementary_form",
    "source_id": "SUPP-2024-05-001",
    "resident_id": "R001",
    "resident_name": "张三",
    "room_number": "1号楼201室",
    "repair_type": "水电维修",
    "repair_content": "补充记录：发现内部线路老化",
    "submit_time": datetime.now().isoformat(),
    "technician_id": "T007",
    "technician_name": "李师傅",
    "original_order_id": "ORD-XXXXXXXXXXXX",
    "supplementary_reason": "现场发现额外问题需要追加记录",
    "work_hours": 0.5,
    "raw_data": {
        "supplementary_form_id": "SF-2024-05-001"
    }
}

ERROR_SCENARIOS = [
    {
        "scenario": "数据验证失败",
        "description": "材料领用表单缺少material_used字段",
        "error_category": "data_validation",
        "fix": "补充完整材料清单后重新提交",
        "example": {
            "source_type": "material_form",
            "source_id": "MATERIAL-2024-05-999",
            "resident_id": "R002",
            "room_number": "2号楼305室"
        }
    },
    {
        "scenario": "重复订单检测",
        "description": "同一住户同一维修类型7天内重复提交",
        "error_category": "duplicate_order",
        "fix": "系统自动合并到已有订单，不会产生重复计费",
        "merge_logic": "通过resident_id + room_number + repair_type + 7天时间窗口匹配"
    },
    {
        "scenario": "返修/换件合并",
        "description": "维修回执显示需要返修，系统自动关联到原订单",
        "merge_trigger": "completion_status = 'repair_needed' 或 'part_replacement'",
        "result": "不会产生新订单，只在原订单上追加费用和记录"
    },
    {
        "scenario": "网络超时重试",
        "description": "第三方接口调用超时",
        "retry_strategy": "指数退避重试，最多5次",
        "intervals": ["60秒", "120秒", "240秒", "480秒", "960秒"]
    }
]

TEST_API_FLOWS = [
    {
        "name": "完整报修流程",
        "steps": [
            "1. 提交住户报修截图",
            "2. 提交维修师傅回执",
            "3. 提交材料领用表",
            "4. 查看系统自动合并的订单",
            "5. 追踪处理过程日志",
            "6. 查看报表汇总"
        ]
    },
    {
        "name": "失败处理流程",
        "steps": [
            "1. 提交不完整数据（触发失败）",
            "2. 在失败列表中查看错误原因",
            "3. 修正数据后重新验证",
            "4. 手动触发重试",
            "5. 验证补偿入账（如需要）"
        ]
    }
]

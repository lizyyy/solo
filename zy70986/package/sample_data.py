SAMPLE_PACKAGES_CSV = """package_id,tracking_no,recipient_name,recipient_phone,pickup_code,arrival_date,status,pickup_date,shelf_location,courier_company,weight
PKG001,SF1234567890123,张三,13800138001,1-2-333,2026-05-20,pending,,A-01,顺丰,1.5
PKG002,YT9876543210987,李四,13900139002,2-5-666,2026-05-20,picked,2026-05-20,A-02,圆通,0.8
PKG003,ZT5678901234567,王五,13700137003,3-1-888,2026-05-10,pending,,B-03,中通,2.3
PKG004,JD2345678901234,赵六,13600136004,1-3-111,2026-05-15,pending,,A-04,京东,0.5
PKG005,EMS7890123456789,孙七,13500135005,2-2-222,2026-05-05,overdue,,B-05,EMS,3.2
"""

SAMPLE_SMS_JSON = """[
    {"sms_id": "SMS001", "package_id": "PKG001", "sms_type": "arrival", "send_time": "2026-05-20 09:30:00", "content": "您的包裹已到驿站，取件码1-2-333", "recipient_phone": "138****8001"},
    {"sms_id": "SMS002", "package_id": "PKG001", "sms_type": "reminder", "send_time": "2026-05-22 10:00:00", "content": "您有包裹待取，请尽快来取", "recipient_phone": "138****8001"},
    {"sms_id": "SMS003", "package_id": "PKG002", "sms_type": "arrival", "send_time": "2026-05-20 09:35:00", "content": "您的包裹已到驿站", "recipient_phone": "139****9002"},
    {"sms_id": "SMS004", "package_id": "PKG002", "sms_type": "reminder", "send_time": "2026-05-11 10:00:00", "content": "包裹已超期，请尽快取件", "recipient_phone": "137****7003"},
    {"sms_id": "SMS005", "package_id": "PKG003", "sms_type": "reminder", "send_time": "2026-05-13 14:00:00", "content": "包裹已超期，请尽快取件", "recipient_phone": "137****7003"},
    {"sms_id": "SMS006", "package_id": "PKG003", "sms_type": "overdue", "send_time": "2026-05-15 09:00:00", "content": "包裹即将退回，请及时处理", "recipient_phone": "137****7003"},
    {"sms_id": "SMS007", "package_id": "PKG004", "sms_type": "arrival", "send_time": "2026-05-15 08:00:00", "content": "您的包裹已到驿站，取件码1-3-111", "recipient_phone": "136****6004"},
    {"sms_id": "SMS008", "package_id": "PKG004", "sms_type": "reminder", "send_time": "2026-05-20 10:00:00", "content": "您有包裹待取", "recipient_phone": "136****6004"},
    {"sms_id": "SMS009", "package_id": "PKG004", "sms_type": "reminder", "send_time": "2026-05-22 10:00:00", "content": "包裹已超期", "recipient_phone": "136****6004"},
    {"sms_id": "SMS010", "package_id": "PKG005", "sms_type": "arrival", "send_time": "2026-05-05 10:00:00", "content": "包裹已到", "recipient_phone": "135****5005"}
]"""

SAMPLE_RULES_JSON = """[
    {"rule_id": "RULE001", "rule_name": "普通包裹7天退回", "overdue_days": 7, "priority": 1, "description": "普通包裹存放超过7天自动退回"},
    {"rule_id": "RULE002", "rule_name": "生鲜包裹3天退回", "overdue_days": 3, "priority": 2, "description": "生鲜类包裹存放超过3天自动退回"}
]"""

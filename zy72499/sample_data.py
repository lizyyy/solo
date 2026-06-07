SAMPLE_RECORDS_NORMAL = [
    {
        "house_number": "光明村12号",
        "address": "光明村正街12号",
        "complaint_id": "TS-2026-001",
        "is_temporary_detour": False,
        "is_old_standard": False,
        "remark": "居民反映门牌缺失，已现场核实",
    },
]

SAMPLE_RECORDS_DETOUR = [
    {
        "house_number": "光明村23号",
        "address": "光明村后街23号",
        "complaint_id": "TS-2026-002",
        "is_temporary_detour": True,
        "is_old_standard": False,
        "remark": "因道路施工临时改道，地图尚未更新",
    },
]

SAMPLE_RECORDS_SUPPLEMENTARY = [
    {
        "house_number": "旧光明村5号",
        "address": "光明村旧区5号",
        "complaint_id": "TS-2026-003",
        "is_temporary_detour": False,
        "is_old_standard": True,
        "remark": "历史遗留旧门牌，路口照片新发现",
    },
]

SAMPLE_COMPLAINTS_ALL = SAMPLE_RECORDS_NORMAL + SAMPLE_RECORDS_DETOUR + SAMPLE_RECORDS_SUPPLEMENTARY

PHOTO_MAPPINGS_ALL = [
    {
        "record_id": "R-001",
        "photo_id": "PHOTO-2026-0607-001",
        "mark_detour": False,
        "mark_old_standard": False,
    },
    {
        "record_id": "R-002",
        "photo_id": "PHOTO-2026-0607-002",
        "mark_detour": True,
        "mark_old_standard": False,
    },
    {
        "record_id": "R-003",
        "photo_id": "PHOTO-2026-0607-003",
        "mark_detour": False,
        "mark_old_standard": True,
    },
]

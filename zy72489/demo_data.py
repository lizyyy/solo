from data_models import PointRecord, PointStatus, DataSource, HistoryLog, ProcessingSession
from datetime import datetime


def get_timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def create_ramp_import_data():
    return [
        {
            "point_id": "P001",
            "name": "幸福社区服务中心",
            "address": "幸福路1号",
            "ramp_condition": "完好",
            "width": "1.5米",
            "notes": "顺利记录，无障碍坡道符合标准"
        },
        {
            "point_id": "P002",
            "name": "阳光便利店",
            "address": "幸福路8号",
            "ramp_condition": "完好",
            "width": "1.2米",
            "notes": "施工临时改道，地图未同步"
        },
        {
            "point_id": "P003",
            "name": "老街口早餐铺",
            "address": "民生街3号",
            "ramp_condition": "待核实",
            "width": "未知",
            "notes": "夜间采样点有旧口径记录，需要补录"
        }
    ]


def create_night_sampling_data():
    return [
        {
            "point_id": "N001",
            "original_point_id": "P003",
            "name": "老街口早餐铺（夜间采样点）",
            "address": "民生街3号",
            "old_caliber": "空置铺面（2023年口径）",
            "new_caliber": "便民早餐点（2024年口径）",
            "collect_time": "2024-05-15 20:30"
        }
    ]


def create_construction_detour_info():
    return {
        "P002": {
            "detour_route": "幸福路绕行至民生街再进入",
            "construction_period": "2024-06-01 至 2024-06-30",
            "map_update_status": "未同步",
            "responsible_department": "市政工程队"
        }
    }


def create_history_logs_for_normal():
    return [
        HistoryLog(
            log_id="L001",
            point_id="P001",
            action="无障碍坡道导入",
            operator="系统",
            timestamp="2024-06-05 09:00:00",
            details="首次导入无障碍坡道记录",
            before_status=None,
            after_status="待复核"
        ),
        HistoryLog(
            log_id="L002",
            point_id="P001",
            action="点位核验",
            operator="周姐",
            timestamp="2024-06-05 09:15:00",
            details="现场核验无障碍坡道完好，符合标准",
            before_status="待复核",
            after_status="正常"
        )
    ]


def create_history_logs_for_detour():
    return [
        HistoryLog(
            log_id="L003",
            point_id="P002",
            action="无障碍坡道导入",
            operator="系统",
            timestamp="2024-06-05 09:00:00",
            details="首次导入无障碍坡道记录",
            before_status=None,
            after_status="待复核"
        ),
        HistoryLog(
            log_id="L004",
            point_id="P002",
            action="发现施工改道",
            operator="周姐",
            timestamp="2024-06-05 09:20:00",
            details="现场发现施工临时改道，地图未同步，留待居民代表复核",
            before_status="待复核",
            after_status="需居民代表复核"
        )
    ]


def create_history_logs_for_supplement():
    return [
        HistoryLog(
            log_id="L005",
            point_id="P003",
            action="无障碍坡道导入",
            operator="系统",
            timestamp="2024-06-05 09:00:00",
            details="首次导入无障碍坡道记录，状态待核实",
            before_status=None,
            after_status="待复核"
        ),
        HistoryLog(
            log_id="L006",
            point_id="P003",
            action="夜间采样点补录",
            operator="周姐",
            timestamp="2024-06-05 09:30:00",
            details="从夜间采样点数据补录旧口径信息，更新为新口径",
            before_status="待复核",
            after_status="补录完成"
        ),
        HistoryLog(
            log_id="L007",
            point_id="P003",
            action="点位清单更新",
            operator="系统",
            timestamp="2024-06-05 09:35:00",
            details="点位清单已更新，补录信息生效",
            before_status="补录完成",
            after_status="正常"
        )
    ]


def create_manual_correction_log():
    return HistoryLog(
        log_id="L008",
        point_id="P002",
        action="人工修正",
        operator="居民代表",
        timestamp="2024-06-05 10:00:00",
        details="居民代表复核确认施工改道情况，建议暂缓更新地图",
        before_status="需居民代表复核",
        after_status="施工临时改道"
    )


def create_rerun_log():
    return HistoryLog(
        log_id="L009",
        point_id="P003",
        action="重跑",
        operator="周姐",
        timestamp="2024-06-05 10:30:00",
        details="重跑点位核验流程，确认补录数据准确",
        before_status="正常",
        after_status="正常"
    )

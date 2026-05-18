import math
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
from enum import Enum


class AuditCategory(Enum):
    NORMAL = "正常站点"
    POSITION_DRIFT = "定位漂移"
    TEMPORARY_SITE = "临时站点"
    RERUN_AVAILABLE = "可复跑输出"


@dataclass
class AuditResult:
    category: AuditCategory
    reason: str
    data: Dict


class SchoolBusAuditor:
    STANDARD_LATITUDE_RANGE = (30.0, 32.0)
    STANDARD_LONGITUDE_RANGE = (120.0, 122.0)
    POSITION_DRIFT_THRESHOLD_KM = 2.0
    REFERENCE_POINT = (31.2304, 121.4737)

    def __init__(self):
        self.stats = {
            "total": 0,
            "normal": 0,
            "position_drift": 0,
            "temporary_site": 0,
            "rerun_available": 0,
        }

    def calculate_distance_km(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        R = 6371.0
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)

        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad

        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        return R * c

    def is_position_drift(
        self, latitude: float, longitude: float
    ) -> Tuple[bool, str]:
        if not (
            self.STANDARD_LATITUDE_RANGE[0]
            <= latitude
            <= self.STANDARD_LATITUDE_RANGE[1]
        ):
            return True, f"纬度 {latitude} 超出标准范围 {self.STANDARD_LATITUDE_RANGE}"

        if not (
            self.STANDARD_LONGITUDE_RANGE[0]
            <= longitude
            <= self.STANDARD_LONGITUDE_RANGE[1]
        ):
            return True, (
                f"经度 {longitude} 超出标准范围 {self.STANDARD_LONGITUDE_RANGE}"
            )

        distance = self.calculate_distance_km(
            latitude, longitude, self.REFERENCE_POINT[0], self.REFERENCE_POINT[1]
        )
        if distance > self.POSITION_DRIFT_THRESHOLD_KM:
            return True, f"距离参考点 {distance:.2f} 公里，超过阈值 {self.POSITION_DRIFT_THRESHOLD_KM} 公里"

        return False, ""

    def is_temporary_site(self, row: Dict) -> Tuple[bool, str]:
        site_type = str(row.get("站点类型", "")).strip()
        if "临时" in site_type:
            return True, f"站点类型标记为临时: {site_type}"

        site_name = str(row.get("站点名称", "")).strip()
        if "临时" in site_name or "应急" in site_name or "备用" in site_name:
            return True, f"站点名称包含临时标识: {site_name}"

        operation_status = str(row.get("运营状态", "")).strip()
        if "暂停" in operation_status or "测试" in operation_status:
            return True, f"运营状态为临时状态: {operation_status}"

        start_date = str(row.get("生效日期", ""))
        end_date = str(row.get("失效日期", ""))
        if start_date and end_date and start_date == end_date:
            return True, "生效日期与失效日期相同，为单日临时站点"

        return False, ""

    def needs_rerun(self, row: Dict) -> Tuple[bool, str]:
        missing_fields = []
        required_fields = ["站点ID", "站点名称", "纬度", "经度", "运营时间"]
        for field in required_fields:
            if not row.get(field) or str(row.get(field, "")).strip() == "":
                missing_fields.append(field)

        if missing_fields:
            return True, f"缺少必填字段: {', '.join(missing_fields)}"

        try:
            lat = float(row.get("纬度", 0))
            lon = float(row.get("经度", 0))
            if lat == 0 or lon == 0:
                return True, "经纬度为0，需要重新采集"
        except (ValueError, TypeError):
            return True, "经纬度格式错误，需要重新解析"

        operation_time = str(row.get("运营时间", "")).strip()
        if not operation_time or operation_time == "待定":
            return True, "运营时间待定，需要确认后复跑"

        return False, ""

    def audit_row(self, row: Dict) -> AuditResult:
        self.stats["total"] += 1

        has_drift, drift_reason = self.is_position_drift(
            float(row.get("纬度", 0)), float(row.get("经度", 0))
        )
        if has_drift:
            self.stats["position_drift"] += 1
            return AuditResult(
                category=AuditCategory.POSITION_DRIFT,
                reason=drift_reason,
                data=row,
            )

        is_temp, temp_reason = self.is_temporary_site(row)
        if is_temp:
            self.stats["temporary_site"] += 1
            return AuditResult(
                category=AuditCategory.TEMPORARY_SITE,
                reason=temp_reason,
                data=row,
            )

        need_rerun, rerun_reason = self.needs_rerun(row)
        if need_rerun:
            self.stats["rerun_available"] += 1
            return AuditResult(
                category=AuditCategory.RERUN_AVAILABLE,
                reason=rerun_reason,
                data=row,
            )

        self.stats["normal"] += 1
        return AuditResult(
            category=AuditCategory.NORMAL,
            reason="数据完整且符合标准",
            data=row,
        )

    def get_statistics(self) -> Dict:
        return self.stats.copy()

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
import pandas as pd
from .models import RecordStatus


class BusinessRuleEngine:
    def __init__(self):
        self.processed_repair_ids = set()
        self.processed_rating_ids = set()

    def reset(self):
        self.processed_repair_ids.clear()
        self.processed_rating_ids.clear()

    def validate_repair_record(
        self, record: Dict[str, Any], existing_repairs: Dict[str, Any]
    ) -> Tuple[RecordStatus, Optional[str], Optional[str]]:
        repair_id = record.get("repair_id")

        if repair_id in self.processed_repair_ids:
            return (
                RecordStatus.FAILED,
                "重复报修：同一报修单在当前批次中重复提交",
                "请检查并删除重复记录，或确认是否需要重新提交"
            )

        if repair_id in existing_repairs:
            return (
                RecordStatus.FAILED,
                "重复报修：该报修单已存在于历史记录中",
                "该报修单已被处理，如需重新提交请使用新的报修编号"
            )

        building = record.get("building", "")
        if not building or not self._is_valid_building(building):
            return (
                RecordStatus.PENDING_CONFIRM,
                "宿舍楼栋信息异常",
                "请确认楼栋名称是否正确，例如：1号楼、2号楼、东1楼等"
            )

        submit_time = record.get("submit_time")
        if submit_time and isinstance(submit_time, str):
            try:
                submit_dt = datetime.fromisoformat(submit_time.replace("Z", "+00:00"))
                if submit_dt > datetime.now() + timedelta(hours=1):
                    return (
                        RecordStatus.PENDING_CONFIRM,
                        "提交时间异常：未来时间",
                        "请检查提交时间是否正确，系统不接受超过当前时间1小时以上的报修"
                    )
            except ValueError:
                pass

        description = record.get("description", "")
        if not isinstance(description, str) or not description or len(description.strip()) < 5:
            return (
                RecordStatus.PENDING_CONFIRM,
                "报修描述过于简单",
                "请补充详细的故障描述，至少5个字符，以便维修师傅提前准备"
            )

        room = record.get("room")
        if room is None or (isinstance(room, str) and not room) or (isinstance(room, float) and pd.isna(room)):
            return (
                RecordStatus.PENDING_CONFIRM,
                "房间号缺失",
                "请补充具体房间号，以便维修师傅准确找到位置"
            )

        self.processed_repair_ids.add(repair_id)
        return RecordStatus.NORMAL, None, None

    def validate_worker_record(
        self, record: Dict[str, Any], existing_workers: Dict[str, Any]
    ) -> Tuple[RecordStatus, Optional[str], Optional[str]]:
        worker_id = record.get("worker_id")
        phone = record.get("phone", "")

        if worker_id in existing_workers:
            return (
                RecordStatus.FAILED,
                "维修工信息已存在",
                "该工号已注册，如需更新信息请使用更新接口"
            )

        if not isinstance(phone, str) or not phone or len(phone) < 11:
            return (
                RecordStatus.PENDING_CONFIRM,
                "联系电话格式异常",
                "请提供有效的11位手机号码"
            )

        skills = record.get("skills", [])
        if not skills or len(skills) == 0:
            return (
                RecordStatus.PENDING_CONFIRM,
                "维修技能未填写",
                "请至少填写一项维修技能，以便系统派单"
            )

        worker_name = record.get("worker_name", "")
        if not isinstance(worker_name, str) or not worker_name:
            return (
                RecordStatus.PENDING_CONFIRM,
                "维修工姓名缺失",
                "请填写维修工真实姓名"
            )

        return RecordStatus.NORMAL, None, None

    def validate_rating_record(
        self, record: Dict[str, Any], existing_ratings: Dict[str, Any],
        repair_records: Dict[str, Any], worker_records: Dict[str, Any]
    ) -> Tuple[RecordStatus, Optional[str], Optional[str]]:
        rating_id = record.get("rating_id")
        repair_id = record.get("repair_id")
        worker_id = record.get("worker_id")
        score = record.get("score", 0)

        if rating_id in self.processed_rating_ids:
            return (
                RecordStatus.FAILED,
                "重复评分：同一评分记录在当前批次中重复提交",
                "请检查并删除重复记录"
            )

        if rating_id in existing_ratings:
            return (
                RecordStatus.FAILED,
                "重复评分：该评分记录已存在",
                "同一报修单只能评分一次，如需修改请联系管理员"
            )

        if repair_id not in repair_records:
            return (
                RecordStatus.PENDING_CONFIRM,
                "关联报修单不存在",
                "请确认报修单号是否正确，或先导入对应的报修记录"
            )

        repair = repair_records.get(repair_id, {})
        repair_worker = repair.get("worker_id")
        if repair_worker and repair_worker != worker_id:
            return (
                RecordStatus.FAILED,
                "维修工与报修单不匹配",
                f"该报修单实际处理人为 {repair_worker}，请核对维修工编号"
            )

        if worker_id and worker_id not in worker_records:
            return (
                RecordStatus.PENDING_CONFIRM,
                "维修工不存在",
                "请确认维修工编号是否正确，或先导入维修工信息"
            )

        if score < 1 or score > 5:
            return (
                RecordStatus.FAILED,
                "评分分数无效",
                "评分必须在1-5分之间"
            )

        comment = record.get("comment", "")
        if not isinstance(comment, str):
            comment = ""

        if self._is_malicious_rating(record):
            return (
                RecordStatus.FAILED,
                "疑似恶意评分",
                "检测到该评价存在异常模式，已标记为待人工审核"
            )

        if score == 1 and len(comment.strip()) < 10:
            return (
                RecordStatus.PENDING_CONFIRM,
                "差评需要详细说明",
                "1分评价请补充至少10个字符的详细评价，以便我们改进服务"
            )

        rating_time = record.get("rating_time")
        complete_time = repair.get("complete_time")
        if rating_time and complete_time:
            try:
                rating_dt = datetime.fromisoformat(rating_time.replace("Z", "+00:00"))
                complete_dt = datetime.fromisoformat(complete_time.replace("Z", "+00:00"))
                if (rating_dt - complete_dt).days > 30:
                    return (
                        RecordStatus.FAILED,
                        "评分超时：超过评价有效期",
                        "报修完成后30天内可以评价，超时后评价通道关闭"
                    )
            except ValueError:
                pass

        self.processed_rating_ids.add(rating_id)
        return RecordStatus.NORMAL, None, None

    def _is_valid_building(self, building) -> bool:
        if not isinstance(building, str):
            return False
        valid_patterns = ["号楼", "栋", "舍", "公寓", "楼"]
        return any(pattern in building for pattern in valid_patterns)

    def _is_malicious_rating(self, record: Dict[str, Any]) -> bool:
        score = record.get("score", 0)
        comment = record.get("comment", "")
        if not isinstance(comment, str):
            comment = ""

        if score == 1 and comment.strip() in ["差", "很差", "垃圾", "不好"]:
            return True

        return False

    def check_timeout_penalty(self, repair_record: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        submit_time = repair_record.get("submit_time")
        complete_time = repair_record.get("complete_time")
        status = repair_record.get("status")

        if status != "completed" or not submit_time or not complete_time:
            return None

        try:
            submit_dt = datetime.fromisoformat(str(submit_time).replace("Z", "+00:00"))
            complete_dt = datetime.fromisoformat(str(complete_time).replace("Z", "+00:00"))

            time_diff_hours = (complete_dt - submit_dt).total_seconds() / 3600

            SLA_HOURS = 24
            if time_diff_hours > SLA_HOURS:
                overtime_hours = time_diff_hours - SLA_HOURS
                penalty_per_hour = 0.1
                penalty_points = min(round(overtime_hours * penalty_per_hour, 2), 5.0)

                return {
                    "repair_id": repair_record.get("repair_id"),
                    "submit_time": submit_time,
                    "complete_time": complete_time,
                    "total_hours": round(time_diff_hours, 2),
                    "overtime_hours": round(overtime_hours, 2),
                    "penalty_points": penalty_points,
                    "reason": f"维修超时{round(overtime_hours, 1)}小时，超过24小时服务承诺"
                }
        except (ValueError, TypeError):
            pass

        return None

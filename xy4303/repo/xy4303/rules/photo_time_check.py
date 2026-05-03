from datetime import datetime, timedelta
from typing import List, Optional

from models.enums import IssueType, IssueSeverity
from models.workbench import Workbench, WorkbenchItem
from rules.base_rule import BaseRule, RuleResult


class PhotoTimeRule(BaseRule):
    rule_name = "取模照片时间异常检查"
    rule_description = "检查照片拍摄时间是否异常（如与订单日期差距过大）"
    issue_type = IssueType.PHOTO_TIME_ABNORMAL

    def __init__(self, config: dict = None):
        super().__init__(config)
        self.threshold_hours = self.config.get("photo_time_threshold_hours", 48)

    def execute(
        self,
        workbench: Workbench,
        item: Optional[WorkbenchItem] = None
    ) -> RuleResult:
        result = RuleResult()

        if item:
            item_result = self.check_item(item)
            result.issues.extend(item_result.issues)
        else:
            for model_id, workbench_item in workbench.items.items():
                item_result = self.check_item(workbench_item)
                result.issues.extend(item_result.issues)

        result.stats = {
            "total_checked": 1 if item else len(workbench.items),
            "issues_found": len(result.issues),
        }

        return result

    def check_item(self, item: WorkbenchItem) -> RuleResult:
        result = RuleResult()
        model_id = item.model_id

        if not item.photos:
            return result

        order_date = None
        if item.order and item.order.order_date:
            order_date = item.order.order_date

        photo_times = []
        for photo in item.photos:
            if photo.taken_at:
                photo_times.append((photo, photo.taken_at))

        if not photo_times:
            return result

        if len(photo_times) > 1:
            photo_times.sort(key=lambda x: x[1])
            earliest_time = photo_times[0][1]
            latest_time = photo_times[-1][1]

            time_diff = latest_time - earliest_time
            if time_diff > timedelta(hours=self.threshold_hours):
                issue = self.create_issue(
                    model_id=model_id,
                    title="照片拍摄时间跨度异常",
                    description=f"模型 {model_id} 的照片拍摄时间跨度超过 {self.threshold_hours} 小时。"
                                f"最早：{earliest_time.strftime('%Y-%m-%d %H:%M')}，"
                                f"最晚：{latest_time.strftime('%Y-%m-%d %H:%M')}，"
                                f"跨度：{time_diff.total_seconds() / 3600:.1f} 小时",
                    severity=IssueSeverity.MEDIUM,
                )
                result.issues.append(issue)

        if order_date:
            for photo, taken_at in photo_times:
                time_diff = taken_at - order_date
                if abs(time_diff.total_seconds()) > self.threshold_hours * 3600:
                    direction = "之后" if time_diff.total_seconds() > 0 else "之前"
                    hours_diff = abs(time_diff.total_seconds()) / 3600

                    issue = self.create_issue(
                        model_id=model_id,
                        title=f"照片{photo.photo_type.value}拍摄时间异常",
                        description=f"照片 {photo.file_name} 的拍摄时间 {taken_at.strftime('%Y-%m-%d %H:%M')} "
                                    f"与订单日期 {order_date.strftime('%Y-%m-%d %H:%M')} "
                                    f"相差约 {hours_diff:.1f} 小时（{direction}），"
                                    f"超过阈值 {self.threshold_hours} 小时",
                        severity=IssueSeverity.LOW,
                    )
                    result.issues.append(issue)

        now = datetime.now()
        for photo, taken_at in photo_times:
            if taken_at > now:
                issue = self.create_issue(
                    model_id=model_id,
                    title="照片拍摄时间在未来",
                    description=f"照片 {photo.file_name} 的拍摄时间 {taken_at.strftime('%Y-%m-%d %H:%M')} "
                                f"晚于当前时间，可能存在时间设置错误",
                    severity=IssueSeverity.HIGH,
                )
                result.issues.append(issue)

        return result

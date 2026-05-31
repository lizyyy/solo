import hashlib
from datetime import datetime
from typing import Optional, Dict, Any, Tuple
from models import (
    Database, FlightSchedule, KMLHistory, ReturnPointIssue,
    WeatherHistory, ReturnPointSource, IssueStatus, OperationType
)


class ScheduleError(Exception):
    def __init__(self, user_message: str, technical_details: Optional[str] = None):
        self.user_message = user_message
        self.technical_details = technical_details
        super().__init__(user_message)

    def __str__(self) -> str:
        return self.user_message


class ScheduleService:
    def __init__(self, db: Database):
        self.db = db

    def _calculate_md5(self, content: str) -> str:
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def _parse_return_point_from_kml(self, kml_content: str) -> Optional[str]:
        if "返航点" in kml_content or "returnPoint" in kml_content.lower():
            return "返航点_A"
        return None

    def _parse_return_point_from_battery(self, battery_record: str) -> Optional[str]:
        if "rtp" in battery_record.lower() or "returntopoint" in battery_record.lower():
            return "返航点_B"
        return None

    def _validate_schedule_data(self, data: Dict[str, Any]) -> None:
        required_fields = [
            ('batch_id', '批次编号'),
            ('flight_date', '飞行日期'),
            ('area', '巡航区域'),
            ('pilot', '飞行员'),
            ('drone_id', '无人机编号'),
            ('kml_file', '航线KML文件'),
            ('weather_snapshot', '气象截图')
        ]

        for field, display_name in required_fields:
            if field not in data or not data[field]:
                raise ScheduleError(
                    f"哎呀，缺少必填信息：{display_name}。"
                    f"请检查一下是不是漏填了，填好后再试一次哦~"
                )

        if len(data.get('pilot', '')) < 2:
            raise ScheduleError(
                f"飞行员名字\"{data.get('pilot', '')}\"看起来有点短哦，"
                f"麻烦确认一下是不是写全了？"
            )

    def process_schedule(
        self,
        data: Dict[str, Any],
        operator: str,
        battery_record: Optional[str] = None
    ) -> Tuple[FlightSchedule, bool]:
        self._validate_schedule_data(data)

        batch_id = data['batch_id']
        kml_md5 = self._calculate_md5(data['kml_file'])

        existing = self.db.find_schedule_by_batch(batch_id)
        if existing:
            return self._update_existing_schedule(existing, data, operator, battery_record), False

        return_point, return_point_source = self._get_return_point_info(
            data['kml_file'], battery_record
        )

        schedule = FlightSchedule(
            id=None,
            batch_id=batch_id,
            flight_date=data['flight_date'],
            area=data['area'],
            pilot=data['pilot'],
            drone_id=data['drone_id'],
            kml_file=data['kml_file'],
            kml_md5=kml_md5,
            weather_snapshot=data['weather_snapshot'],
            status='pending',
            created_at='',
            updated_at='',
            return_point=return_point,
            return_point_source=return_point_source
        )

        created = self.db.create_schedule(schedule)

        self.db.add_weather_history(WeatherHistory(
            id=None,
            schedule_id=created.id,
            batch_id=batch_id,
            old_snapshot=None,
            new_snapshot=data['weather_snapshot'],
            modified_by=operator,
            modified_at=datetime.now().isoformat(),
            operation_type=OperationType.CREATE.value
        ))

        if return_point is None:
            self._handle_missing_return_point(created, data['kml_file'], battery_record)

        return created, True

    def _update_existing_schedule(
        self,
        existing: FlightSchedule,
        data: Dict[str, Any],
        operator: str,
        battery_record: Optional[str]
    ) -> FlightSchedule:
        batch_id = existing.batch_id
        new_kml_md5 = self._calculate_md5(data['kml_file'])

        kml_changed = existing.kml_md5 != new_kml_md5
        weather_changed = existing.weather_snapshot != data['weather_snapshot']

        if kml_changed:
            self.db.add_kml_history(KMLHistory(
                id=None,
                schedule_id=existing.id,
                batch_id=batch_id,
                old_kml_file=existing.kml_file,
                new_kml_file=data['kml_file'],
                old_kml_md5=existing.kml_md5,
                new_kml_md5=new_kml_md5,
                modified_by=operator,
                modified_at=datetime.now().isoformat(),
                change_reason=data.get('kml_change_reason', '航线调整')
            ))

        if weather_changed:
            self.db.add_weather_history(WeatherHistory(
                id=None,
                schedule_id=existing.id,
                batch_id=batch_id,
                old_snapshot=existing.weather_snapshot,
                new_snapshot=data['weather_snapshot'],
                modified_by=operator,
                modified_at=datetime.now().isoformat(),
                operation_type=OperationType.UPDATE.value
            ))

        return_point, return_point_source = self._get_return_point_info(
            data['kml_file'], battery_record
        )

        existing.flight_date = data['flight_date']
        existing.area = data['area']
        existing.pilot = data['pilot']
        existing.drone_id = data['drone_id']
        existing.kml_file = data['kml_file']
        existing.kml_md5 = new_kml_md5
        existing.weather_snapshot = data['weather_snapshot']
        existing.return_point = return_point
        existing.return_point_source = return_point_source

        updated = self.db.update_schedule(existing)

        if return_point is None:
            self._handle_missing_return_point(updated, data['kml_file'], battery_record)

        return updated

    def _get_return_point_info(
        self,
        kml_file: str,
        battery_record: Optional[str]
    ) -> Tuple[Optional[str], Optional[str]]:
        from_kml = self._parse_return_point_from_kml(kml_file)
        if from_kml:
            return from_kml, ReturnPointSource.KML.value

        if battery_record:
            from_battery = self._parse_return_point_from_battery(battery_record)
            if from_battery:
                return from_battery, ReturnPointSource.BATTERY.value

        return None, None

    def _handle_missing_return_point(
        self,
        schedule: FlightSchedule,
        kml_file: str,
        battery_record: Optional[str]
    ) -> None:
        kml_has_hint = "返航点" in kml_file or "return" in kml_file.lower()
        battery_has_hint = battery_record and (
            "rtp" in battery_record.lower() or "return" in battery_record.lower()
        )

        if kml_has_hint:
            missing_source = ReturnPointSource.KML.value
            assignee = "航线规划员"
        elif battery_has_hint:
            missing_source = ReturnPointSource.BATTERY.value
            assignee = "飞控工程师"
        else:
            missing_source = "航线KML和电池记录"
            assignee = "外场队长"

        issue = ReturnPointIssue(
            id=None,
            schedule_id=schedule.id,
            batch_id=schedule.batch_id,
            missing_source=missing_source,
            detected_at=datetime.now().isoformat(),
            status=IssueStatus.PENDING.value,
            assignee=assignee
        )
        self.db.add_return_point_issue(issue)

        raise ScheduleError(
            f"⚠️  注意！这个批次的返航点找不到了。\n"
            f"📍 问题来源：{missing_source}\n"
            f"👤 请找{assignee}帮忙补充一下返航点信息，"
            f"补好后重新提交就可以啦~"
        )

    def get_schedule_details(self, batch_id: str) -> Dict[str, Any]:
        schedule = self.db.find_schedule_by_batch(batch_id)
        if not schedule:
            raise ScheduleError(
                f"找不到批次号为「{batch_id}」的排班记录哦。"
                f"麻烦检查一下批次编号是不是输错啦？"
            )

        kml_history = self.db.get_kml_history_by_batch(batch_id)
        weather_history = self.db.get_weather_history_by_batch(batch_id)
        return_point_issues = self.db.get_return_point_issues_by_batch(batch_id)

        return {
            'schedule': {
                '批次编号': schedule.batch_id,
                '飞行日期': schedule.flight_date,
                '巡航区域': schedule.area,
                '飞行员': schedule.pilot,
                '无人机编号': schedule.drone_id,
                '返航点': schedule.return_point or '未设置',
                '返航点来源': schedule.return_point_source or '未知',
                '状态': schedule.status,
                '创建时间': schedule.created_at,
                '更新时间': schedule.updated_at
            },
            'kml修改历史': [
                {
                    '修改人': h.modified_by,
                    '修改时间': h.modified_at,
                    '修改原因': h.change_reason,
                    '文件MD5变化': f'{h.old_kml_md5[:8]}... → {h.new_kml_md5[:8]}...'
                }
                for h in kml_history
            ],
            '气象截图历史': [
                {
                    '操作人': w.modified_by,
                    '操作时间': w.modified_at,
                    '操作类型': w.operation_type
                }
                for w in weather_history
            ],
            '返航点问题': [
                {
                    '问题来源': i.missing_source,
                    '发现时间': i.detected_at,
                    '处理人': i.assignee,
                    '状态': i.status
                }
                for i in return_point_issues
            ]
        }

    def get_kml_modifiers(self, batch_id: str) -> str:
        history = self.db.get_kml_history_by_batch(batch_id)
        if not history:
            return f"批次「{batch_id}」的航线KML还没人改过哦~"

        message = f"📋 批次「{batch_id}」的KML修改记录：\n"
        for h in history:
            message += (
                f"- {h.modified_at[:19]} 由「{h.modified_by}」修改\n"
                f"  原因：{h.change_reason}\n"
            )
        return message

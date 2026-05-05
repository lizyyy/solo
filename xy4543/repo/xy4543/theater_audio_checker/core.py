import os
from datetime import datetime, date
from pathlib import Path
from typing import Optional, List

from theater_audio_checker.models import (
    AudioItem,
    ZoneSchedule,
    DeviceLog,
    ReviewNote,
    CheckResult,
    ExportData,
    InputConfig
)
from theater_audio_checker.loaders import DataLoader, DataLoadError
from theater_audio_checker.checkers import AudioChecker
from theater_audio_checker.exporters import MarkdownExporter, JsonExporter
from theater_audio_checker.notes import NoteManager
from theater_audio_checker.version import __version__


class TheaterAudioChecker:
    """剧场音频检查器主类"""

    def __init__(self, config: Optional[InputConfig] = None):
        self.config = config or InputConfig()
        self.audio_items: List[AudioItem] = []
        self.zone_schedules: List[ZoneSchedule] = []
        self.device_logs: List[DeviceLog] = []
        self.review_notes: List[ReviewNote] = []
        self.check_result: Optional[CheckResult] = None
        self.note_manager: Optional[NoteManager] = None

    def load_data(
        self,
        audio_path: Optional[str] = None,
        schedule_path: Optional[str] = None,
        device_path: Optional[str] = None,
        notes_path: Optional[str] = None
    ):
        """加载所有数据文件"""
        audio_manifest = audio_path or self.config.audio_manifest_path
        zone_schedule = schedule_path or self.config.zone_schedule_path
        device_log = device_path or self.config.device_log_path
        review_notes = notes_path or self.config.review_notes_path

        try:
            (
                self.audio_items,
                self.zone_schedules,
                self.device_logs,
                self.review_notes
            ) = DataLoader.load_all(
                audio_path=audio_manifest,
                schedule_path=zone_schedule,
                device_path=device_log,
                notes_path=review_notes
            )
        except DataLoadError as e:
            raise RuntimeError(f"数据加载失败: {e}")

        if review_notes and os.path.exists(review_notes):
            self.note_manager = NoteManager(review_notes)

    def run_checks(self, target_date: Optional[str] = None) -> CheckResult:
        """运行所有检查"""
        check_date = target_date or self.config.target_date
        if not check_date:
            check_date = date.today().isoformat()

        checker = AudioChecker(
            audio_items=self.audio_items,
            zone_schedules=self.zone_schedules,
            device_logs=self.device_logs,
            review_notes=self.review_notes,
            target_date=check_date
        )

        self.check_result = checker.run_all_checks()
        return self.check_result

    def generate_export_data(self) -> ExportData:
        """生成导出数据"""
        if self.audio_items is None:
            self.audio_items = []
        if self.zone_schedules is None:
            self.zone_schedules = []
        if self.device_logs is None:
            self.device_logs = []
        if self.review_notes is None:
            self.review_notes = []

        return ExportData(
            version=__version__,
            target_date=self.config.target_date or date.today().isoformat(),
            audio_items=self.audio_items,
            zone_schedules=self.zone_schedules,
            device_logs=self.device_logs,
            review_notes=self.review_notes,
            check_result=self.check_result
        )

    def export_markdown(self, output_path: str, title: Optional[str] = None):
        """导出 Markdown 交班单"""
        export_data = self.generate_export_data()
        MarkdownExporter.export_to_file(export_data, output_path, title)

    def export_json(self, output_path: str, indent: int = 2):
        """导出 JSON 明细"""
        export_data = self.generate_export_data()
        JsonExporter.export_to_file(export_data, output_path, indent)

    def run_full_check(
        self,
        audio_path: Optional[str] = None,
        schedule_path: Optional[str] = None,
        device_path: Optional[str] = None,
        notes_path: Optional[str] = None,
        output_dir: Optional[str] = None,
        target_date: Optional[str] = None
    ) -> dict:
        """
        运行完整检查流程：加载数据 -> 执行检查 -> 导出报告
        
        Returns:
            包含检查结果和导出文件路径的字典
        """
        self.load_data(
            audio_path=audio_path,
            schedule_path=schedule_path,
            device_path=device_path,
            notes_path=notes_path
        )

        check_result = self.run_checks(target_date=target_date)

        out_dir = Path(output_dir or self.config.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        date_str = target_date or self.config.target_date or date.today().isoformat()
        
        markdown_path = out_dir / f"handover_report_{date_str}.md"
        json_path = out_dir / f"check_detail_{date_str}.json"

        self.export_markdown(str(markdown_path))
        self.export_json(str(json_path))

        return {
            "check_result": check_result,
            "markdown_path": str(markdown_path),
            "json_path": str(json_path),
            "output_dir": str(out_dir)
        }

    def add_review_note(
        self,
        item_type: str,
        item_id: str,
        reviewer: str,
        status: str,
        comment: str,
        save_path: Optional[str] = None
    ) -> ReviewNote:
        """添加复核备注"""
        if self.note_manager is None:
            self.note_manager = NoteManager()

        from theater_audio_checker.models import CheckStatus
        try:
            check_status = CheckStatus(status)
        except ValueError:
            check_status = CheckStatus(status)

        note = self.note_manager.add_note(
            item_type=item_type,
            item_id=item_id,
            reviewer=reviewer,
            status=check_status,
            comment=comment
        )

        if save_path or self.config.review_notes_path:
            save_target = save_path or self.config.review_notes_path
            if save_target:
                self.note_manager.save(save_target)

        return note

    def get_check_summary(self) -> dict:
        """获取检查摘要"""
        if self.check_result is None:
            return {"status": "no_check_run"}

        return {
            "total_audio_items": self.check_result.total_audio_items,
            "total_schedules": self.check_result.total_schedules,
            "total_devices": self.check_result.total_devices,
            "pass_count": self.check_result.pass_count,
            "fail_count": self.check_result.fail_count,
            "warning_count": self.check_result.warning_count,
            "needs_review_count": self.check_result.needs_review_count,
            "total_issues": self.check_result.total_issues,
            "is_all_clear": self.check_result.is_all_clear
        }

import hashlib
import shutil
import tempfile
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from .models import (
    BackupSet,
    DrillRecord,
    DataStore,
    BackupStatus,
    DrillStatus,
    generate_id,
)


class BackupDrillError(Exception):
    pass


class BackupExpiredError(BackupDrillError):
    pass


class ChecksumMissingError(BackupDrillError):
    pass


class DirectoryConflictError(BackupDrillError):
    pass


class BackupRegistrationService:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store

    def register_backup(
        self,
        name: str,
        source_path: str,
        checksum: str,
        checksum_algorithm: str = "md5",
        retention_days: int = 30,
        backup_date: Optional[str] = None,
        description: Optional[str] = None,
    ) -> BackupSet:
        if not checksum or not checksum.strip():
            raise ChecksumMissingError("备份集缺少校验值，必须提供 checksum")

        source = Path(source_path)
        if not source.exists():
            raise BackupDrillError(f"备份路径不存在: {source_path}")

        size_bytes = self._calculate_size(source)

        if backup_date is None:
            backup_date = datetime.now().isoformat()

        now = datetime.now().isoformat()
        
        existing = self.data_store.get_backup_by_name(name)
        if existing:
            raise BackupDrillError(
                f"备份集 '{name}' 已存在活跃记录，请先停用旧版本或使用其他名称"
            )

        backup = BackupSet(
            id=generate_id(),
            name=name,
            backup_date=backup_date,
            source_path=str(source.absolute()),
            checksum=checksum.strip(),
            checksum_algorithm=checksum_algorithm.lower(),
            retention_days=retention_days,
            status=BackupStatus.ACTIVE.value,
            created_at=now,
            updated_at=now,
            size_bytes=size_bytes,
            description=description,
        )

        return self.data_store.save_backup(backup)

    def _calculate_size(self, path: Path) -> int:
        if path.is_file():
            return path.stat().st_size
        total = 0
        for child in path.rglob("*"):
            if child.is_file():
                total += child.stat().st_size
        return total


class ChecksumService:
    SUPPORTED_ALGORITHMS = ["md5", "sha1", "sha256", "sha512"]

    def calculate_checksum(self, path: str, algorithm: str = "md5") -> str:
        if algorithm not in self.SUPPORTED_ALGORITHMS:
            raise BackupDrillError(
                f"不支持的校验算法: {algorithm}。支持: {', '.join(self.SUPPORTED_ALGORITHMS)}"
            )

        source = Path(path)
        if not source.exists():
            raise BackupDrillError(f"路径不存在: {path}")

        if source.is_file():
            return self._calculate_file_checksum(source, algorithm)
        else:
            return self._calculate_directory_checksum(source, algorithm)

    def _calculate_file_checksum(self, file_path: Path, algorithm: str) -> str:
        hasher = hashlib.new(algorithm)
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _calculate_directory_checksum(self, dir_path: Path, algorithm: str) -> str:
        hasher = hashlib.new(algorithm)
        files = sorted(dir_path.rglob("*"))
        for file_path in files:
            if file_path.is_file():
                hasher.update(str(file_path.relative_to(dir_path)).encode("utf-8"))
                with open(file_path, "rb") as f:
                    for chunk in iter(lambda: f.read(8192), b""):
                        hasher.update(chunk)
        return hasher.hexdigest()

    def verify_checksum(
        self, path: str, expected_checksum: str, algorithm: str = "md5"
    ) -> bool:
        actual = self.calculate_checksum(path, algorithm)
        return actual.lower() == expected_checksum.lower()


class RecoveryDrillService:
    def __init__(self, data_store: DataStore, checksum_service: ChecksumService):
        self.data_store = data_store
        self.checksum_service = checksum_service

    def run_drill(
        self,
        backup_set_id: str,
        restore_path: Optional[str] = None,
        skip_checksum: bool = False,
    ) -> DrillRecord:
        backup = self.data_store.get_backup_by_id(backup_set_id)
        if not backup:
            raise BackupDrillError(f"备份集不存在: {backup_set_id}")

        if backup.is_expired():
            raise BackupExpiredError(
                f"备份集已过期 (保留期 {backup.retention_days} 天，备份日期: {backup.backup_date})"
            )

        drill = DrillRecord(
            id=generate_id(),
            backup_set_id=backup.id,
            started_at=datetime.now().isoformat(),
            status=DrillStatus.IN_PROGRESS.value,
        )
        self.data_store.save_drill(drill)

        start_time = time.time()

        try:
            if restore_path is None:
                temp_dir = tempfile.mkdtemp(prefix="backup_drill_")
                restore_path = temp_dir

            target_dir = Path(restore_path)
            if target_dir.exists() and any(target_dir.iterdir()):
                raise DirectoryConflictError(
                    f"恢复目录已存在且非空: {restore_path}。请使用空目录或临时目录。"
                )

            target_dir.mkdir(parents=True, exist_ok=True)

            source_path = Path(backup.source_path)
            if not source_path.exists():
                raise BackupDrillError(f"原始备份源已不存在: {backup.source_path}")

            if source_path.is_file():
                shutil.copy2(source_path, target_dir / source_path.name)
            else:
                for item in source_path.iterdir():
                    if item.is_dir():
                        shutil.copytree(item, target_dir / item.name)
                    else:
                        shutil.copy2(item, target_dir / item.name)

            drill.restored_path = str(target_dir.absolute())

            if not skip_checksum:
                checksum_verified = self.checksum_service.verify_checksum(
                    str(target_dir), backup.checksum, backup.checksum_algorithm
                )
                drill.checksum_verified = checksum_verified
                if not checksum_verified:
                    raise BackupDrillError("恢复后校验和不匹配，备份可能已损坏")
            else:
                drill.checksum_verified = None

            duration = time.time() - start_time
            drill.duration_seconds = duration
            drill.completed_at = datetime.now().isoformat()
            drill.status = DrillStatus.SUCCESS.value

            self.data_store.save_drill(drill)
            return drill

        except Exception as e:
            duration = time.time() - start_time
            drill.duration_seconds = duration
            drill.completed_at = datetime.now().isoformat()
            drill.status = DrillStatus.FAILED.value
            drill.error_message = str(e)

            if restore_path is not None:
                temp_path = Path(restore_path)
                if "backup_drill_" in temp_path.name and temp_path.exists():
                    try:
                        shutil.rmtree(temp_path)
                        drill.restored_path = None
                    except Exception:
                        pass

            self.data_store.save_drill(drill)
            raise

    def cleanup_restore(self, drill_id: str) -> bool:
        drill = self.data_store.get_drill_by_id(drill_id)
        if not drill or not drill.restored_path:
            return False

        restore_path = Path(drill.restored_path)
        if restore_path.exists():
            shutil.rmtree(restore_path)
            drill.restored_path = None
            self.data_store.save_drill(drill)
            return True
        return False


class TrendAnalysisService:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store

    def analyze_backup_trend(self, backup_set_id: str, limit: int = 10) -> Dict[str, Any]:
        drills = self.data_store.get_drills_by_backup(backup_set_id)
        drills = drills[:limit]

        if not drills:
            return {
                "backup_set_id": backup_set_id,
                "total_drills": 0,
                "success_rate": 0,
                "avg_duration": 0,
                "trend": "no_data",
            }

        total = len(drills)
        success_drills = [d for d in drills if d.status == DrillStatus.SUCCESS.value]
        success_count = len(success_drills)
        success_rate = (success_count / total * 100) if total > 0 else 0

        durations = [d.duration_seconds for d in drills if d.duration_seconds is not None]
        avg_duration = sum(durations) / len(durations) if durations else 0

        recent_3 = drills[:3]
        recent_success = sum(1 for d in recent_3 if d.status == DrillStatus.SUCCESS.value)
        if len(recent_3) >= 3:
            if recent_success == 3:
                trend = "improving"
            elif recent_success == 0:
                trend = "worsening"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"

        return {
            "backup_set_id": backup_set_id,
            "total_drills": total,
            "success_count": success_count,
            "failed_count": total - success_count,
            "success_rate": round(success_rate, 2),
            "avg_duration_seconds": round(avg_duration, 2),
            "trend": trend,
            "drills": [
                {
                    "id": d.id,
                    "started_at": d.started_at,
                    "status": d.status,
                    "duration": d.duration_seconds,
                }
                for d in drills
            ],
        }

    def get_overall_stats(self) -> Dict[str, Any]:
        all_drills = self.data_store.get_all_drills()
        active_backups = self.data_store.get_active_backups()

        total_drills = len(all_drills)
        success_drills = [d for d in all_drills if d.status == DrillStatus.SUCCESS.value]
        success_rate = (len(success_drills) / total_drills * 100) if total_drills > 0 else 0

        expired_backups = [b for b in active_backups if b.is_expired()]
        never_drilled = [
            b for b in active_backups
            if not self.data_store.get_drills_by_backup(b.id)
        ]

        return {
            "total_drills": total_drills,
            "success_drills": len(success_drills),
            "failed_drills": total_drills - len(success_drills),
            "success_rate": round(success_rate, 2),
            "active_backups": len(active_backups),
            "expired_backups": len(expired_backups),
            "never_drilled_backups": len(never_drilled),
            "backups_requiring_attention": len(expired_backups) + len(never_drilled),
        }


class ReportService:
    def __init__(self, data_store: DataStore, trend_service: TrendAnalysisService):
        self.data_store = data_store
        self.trend_service = trend_service

    def generate_text_report(self, output_path: Optional[str] = None) -> str:
        stats = self.trend_service.get_overall_stats()
        active_backups = self.data_store.get_active_backups()
        recent_drills = self.data_store.get_recent_drills(20)

        lines = []
        lines.append("=" * 80)
        lines.append("备份恢复演练报告")
        lines.append("=" * 80)
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("[概览统计]")
        lines.append("-" * 40)
        lines.append(f"总演练次数: {stats['total_drills']}")
        lines.append(f"成功次数: {stats['success_drills']}")
        lines.append(f"失败次数: {stats['failed_drills']}")
        lines.append(f"成功率: {stats['success_rate']}%")
        lines.append("")
        lines.append(f"活跃备份集: {stats['active_backups']}")
        lines.append(f"已过期备份: {stats['expired_backups']}")
        lines.append(f"从未演练的备份: {stats['never_drilled_backups']}")
        lines.append(f"需要关注的备份: {stats['backups_requiring_attention']}")
        lines.append("")

        lines.append("[活跃备份集]")
        lines.append("-" * 40)
        for backup in active_backups:
            expired = " (已过期)" if backup.is_expired() else ""
            lines.append(f"名称: {backup.name}{expired}")
            lines.append(f"  ID: {backup.id}")
            lines.append(f"  备份日期: {backup.backup_date}")
            lines.append(f"  保留期: {backup.retention_days} 天")
            lines.append(f"  大小: {self._format_size(backup.size_bytes)}")
            trend = self.trend_service.analyze_backup_trend(backup.id)
            lines.append(f"  演练次数: {trend['total_drills']}")
            lines.append(f"  成功率: {trend['success_rate']}%")
            lines.append(f"  趋势: {self._format_trend(trend['trend'])}")
            lines.append("")

        lines.append("[最近演练记录]")
        lines.append("-" * 40)
        if recent_drills:
            for drill in recent_drills:
                status = "成功" if drill.status == DrillStatus.SUCCESS.value else "失败"
                manual = " (人工确认)" if drill.manually_confirmed else ""
                re_backed = " (已重新备份)" if drill.re_backed_up else ""
                lines.append(f"ID: {drill.id}")
                lines.append(f"  时间: {drill.started_at}")
                lines.append(f"  状态: {status}{manual}{re_backed}")
                if drill.duration_seconds:
                    lines.append(f"  耗时: {drill.duration_seconds:.2f} 秒")
                if drill.error_message:
                    lines.append(f"  错误: {drill.error_message}")
                lines.append("")
        else:
            lines.append("暂无演练记录")
            lines.append("")

        lines.append("=" * 80)

        report = "\n".join(lines)

        if output_path:
            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(report)

        return report

    def _format_size(self, bytes_size: int) -> str:
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if bytes_size < 1024.0:
                return f"{bytes_size:.2f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.2f} PB"

    def _format_trend(self, trend: str) -> str:
        mapping = {
            "improving": "改善中",
            "worsening": "恶化中",
            "stable": "稳定",
            "insufficient_data": "数据不足",
            "no_data": "无数据",
        }
        return mapping.get(trend, trend)

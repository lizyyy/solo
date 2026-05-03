"""
文件归档模块 - 自动整理和归档文件
"""

import shutil
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Set
from collections import defaultdict

from config import Config
from parsers.csv_parser import TemperatureCSVParser, TemperatureReading
from parsers.photo_parser import PhotoParser, PhotoInfo
from parsers.log_parser import DoorLogParser


class ArchiveResult:
    """
    归档结果
    """
    
    def __init__(self):
        self.archived_files: List[Dict[str, Any]] = []
        self.failed_files: List[Dict[str, Any]] = []
        self.created_directories: List[Path] = []
        self.source_files: List[Dict[str, Any]] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_archived": len(self.archived_files),
            "total_failed": len(self.failed_files),
            "created_directories": [str(p) for p in self.created_directories],
            "archived_files": self.archived_files,
            "failed_files": self.failed_files,
        }

    @property
    def success_count(self) -> int:
        return len(self.archived_files)

    @property
    def failure_count(self) -> int:
        return len(self.failed_files)


class FileArchiver:
    """
    文件归档器 - 按日期和类型整理归档文件
    """

    ARCHIVE_CATEGORIES = {
        "temperature_csv": "temperature",
        "photo": "photos",
        "door_log": "door_logs",
        "other": "others",
    }

    def __init__(
        self,
        config: Optional[Config] = None,
        temp_parser: Optional[TemperatureCSVParser] = None,
        photo_parser: Optional[PhotoParser] = None,
        door_parser: Optional[DoorLogParser] = None,
    ):
        self.config = config or Config()
        self.temp_parser = temp_parser
        self.photo_parser = photo_parser
        self.door_parser = door_parser
        self.archive_result = ArchiveResult()

    def archive_all(
        self, 
        input_dir: Optional[Path] = None, 
        output_dir: Optional[Path] = None,
        move: bool = False,
    ) -> ArchiveResult:
        """
        归档所有文件
        
        Args:
            input_dir: 输入目录
            output_dir: 输出目录
            move: 是否移动文件（False为复制）
        """
        input_dir = input_dir or self.config.INPUT_DIR
        output_dir = output_dir or self.config.ARCHIVE_DIR
        
        self.archive_result = ArchiveResult()
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if self.temp_parser and self.temp_parser.parsed_files:
            self._archive_temperature_files(output_dir, move)
            
        if self.photo_parser and self.photo_parser.parsed_photos:
            self._archive_photo_files(output_dir, move)
            
        if self.door_parser and self.door_parser.parsed_entries:
            self._archive_door_log_files(output_dir, move)
            
        self._archive_remaining_files(input_dir, output_dir, move)
        
        return self.archive_result

    def _archive_temperature_files(self, output_dir: Path, move: bool):
        """
        归档温度CSV文件
        """
        for file_meta in self.temp_parser.parsed_files:
            file_path = Path(file_meta["file_path"])
            
            target_date = None
            if file_meta["start_time"]:
                target_date = file_meta["start_time"].date()
            elif file_meta["end_time"]:
                target_date = file_meta["end_time"].date()
            else:
                continue
                
            target_path = self._build_archive_path(
                output_dir, 
                target_date, 
                "temperature",
                file_path.name
            )
            
            self._archive_file(file_path, target_path, move, "temperature_csv")

    def _archive_photo_files(self, output_dir: Path, move: bool):
        """
        归档照片文件
        """
        for photo in self.photo_parser.parsed_photos:
            target_date = photo.date
            if not target_date:
                continue
                
            category = f"photos_{photo.shift}" if photo.shift else "photos"
            subfolder = photo.photo_type if photo.photo_type != "other" else "misc"
            
            target_path = self._build_archive_path(
                output_dir,
                target_date,
                category,
                photo.filename,
                subfolder=subfolder
            )
            
            self._archive_file(photo.file_path, target_path, move, "photo")

    def _archive_door_log_files(self, output_dir: Path, move: bool):
        """
        归档开门日志文件
        """
        log_files = set()
        
        for entry in self.door_parser.parsed_entries:
            if entry.raw_line:
                pass
                
        for date_val, entries in self.door_parser.entries_by_date.items():
            if not entries:
                continue
                
            for entry in entries[:1]:
                source_path = None
                if entry.raw_line:
                    pass
                    
            target_path = self._build_archive_path(
                output_dir,
                date_val,
                "door_logs",
                f"door_log_{date_val.isoformat()}.log"
            )

    def _archive_remaining_files(
        self, 
        input_dir: Path, 
        output_dir: Path, 
        move: bool
    ):
        """
        归档未被解析器处理的其他文件
        """
        if not input_dir.exists():
            return
            
        today = date.today()
        
        for item in input_dir.rglob("*"):
            if item.is_file():
                already_archived = False
                for archived in self.archive_result.archived_files:
                    if str(item) == archived.get("source"):
                        already_archived = True
                        break
                        
                if not already_archived:
                    file_date = self._get_file_date(item)
                    if not file_date:
                        file_date = today
                        
                    target_path = self._build_archive_path(
                        output_dir,
                        file_date,
                        "others",
                        item.name
                    )
                    
                    self._archive_file(item, target_path, move, "other")

    def _build_archive_path(
        self,
        base_dir: Path,
        target_date: date,
        category: str,
        filename: str,
        subfolder: Optional[str] = None,
    ) -> Path:
        """
        构建归档路径
        
        结构: base_dir/YYYY-MM/YYYY-MM-DD/category/subfolder/filename
        """
        year_month = target_date.strftime("%Y-%m")
        date_str = target_date.strftime("%Y-%m-%d")
        
        if subfolder:
            path = base_dir / year_month / date_str / category / subfolder
        else:
            path = base_dir / year_month / date_str / category
            
        if not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            self.archive_result.created_directories.append(path)
            
        target_path = path / filename
        
        counter = 1
        while target_path.exists():
            stem = target_path.stem
            suffix = target_path.suffix
            target_path = path / f"{stem}_{counter:03d}{suffix}"
            counter += 1
            
        return target_path

    def _archive_file(
        self, 
        source: Path, 
        target: Path, 
        move: bool,
        category: str,
    ) -> bool:
        """
        归档单个文件
        """
        try:
            if not source.exists():
                self.archive_result.failed_files.append({
                    "source": str(source),
                    "error": "源文件不存在",
                    "category": category,
                })
                return False
                
            if move:
                shutil.move(str(source), str(target))
            else:
                shutil.copy2(str(source), str(target))
                
            self.archive_result.archived_files.append({
                "source": str(source),
                "target": str(target),
                "category": category,
                "operation": "move" if move else "copy",
                "timestamp": datetime.now().isoformat(),
            })
            
            return True
            
        except Exception as e:
            self.archive_result.failed_files.append({
                "source": str(source),
                "target": str(target),
                "error": str(e),
                "category": category,
            })
            return False

    def _get_file_date(self, file_path: Path) -> Optional[date]:
        """
        从文件名获取日期，如果无法获取则使用文件修改时间
        """
        import re
        from datetime import datetime
        
        filename = file_path.stem
        
        patterns = [
            r"(\d{4}[-/]\d{2}[-/]\d{2})",
            r"(\d{4}\d{2}\d{2})",
        ]
        
        for pattern in patterns:
            match = re.search(pattern, filename)
            if match:
                date_str = match.group(1)
                try:
                    if "-" in date_str or "/" in date_str:
                        date_str = date_str.replace("/", "-")
                        return datetime.strptime(date_str, "%Y-%m-%d").date()
                    else:
                        return datetime.strptime(date_str, "%Y%m%d").date()
                except ValueError:
                    continue
                    
        try:
            mtime = file_path.stat().st_mtime
            return datetime.fromtimestamp(mtime).date()
        except Exception:
            pass
            
        return None

    def get_archive_summary(self) -> Dict[str, Any]:
        """
        获取归档摘要
        """
        summary = {
            "total_files": self.archive_result.success_count + self.archive_result.failure_count,
            "success_count": self.archive_result.success_count,
            "failure_count": self.archive_result.failure_count,
            "created_directories": len(self.archive_result.created_directories),
        }
        
        categories = defaultdict(int)
        for archived in self.archive_result.archived_files:
            categories[archived.get("category", "unknown")] += 1
            
        summary["by_category"] = dict(categories)
        
        return summary

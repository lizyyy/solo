import csv
import json
import re
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from .models import (
    Actor, Vehicle, Scene, CallSheetVersion, Issue,
    IssueType, IssueSeverity
)


class CallSheetImporter:
    DATE_FORMATS = [
        "%Y-%m-%d", "%Y/%m/%d", "%m-%d-%Y", "%m/%d/%Y",
        "%Y年%m月%d日", "%m月%d日",
    ]
    
    TIME_FORMATS = [
        "%H:%M", "%H:%M:%S", "%I:%M %p", "%I:%M:%S %p",
        "%H时%M分", "%H点%M分",
    ]

    def __init__(self, source_file: str):
        self.source_file = source_file
        self.source_name = Path(source_file).name
        self.issues: List[Issue] = []

    def import_file(self, version: str) -> Tuple[CallSheetVersion, List[Issue]]:
        self.issues = []
        file_path = Path(self.source_file)
        
        if not file_path.exists():
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.ERROR,
                f"文件不存在: {self.source_file}",
                self.source_name
            )
            return self._create_empty_version(version), self.issues

        if file_path.suffix.lower() in [".json"]:
            return self._import_json(version)
        elif file_path.suffix.lower() in [".csv"]:
            return self._import_csv(version)
        else:
            self._add_issue(
                IssueType.INVALID_TIME_FORMAT,
                IssueSeverity.ERROR,
                f"不支持的文件格式: {file_path.suffix}",
                self.source_name
            )
            return self._create_empty_version(version), self.issues

    def _import_json(self, version: str) -> Tuple[CallSheetVersion, List[Issue]]:
        try:
            with open(self.source_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            self._add_issue(
                IssueType.INVALID_TIME_FORMAT,
                IssueSeverity.ERROR,
                f"JSON解析错误: {str(e)}",
                self.source_name
            )
            return self._create_empty_version(version), self.issues

        shoot_date = self._parse_shoot_date(data.get("shoot_date", ""))
        scenes = self._parse_scenes(data.get("scenes", []), shoot_date)
        actors = self._parse_actors(data.get("actors", []), shoot_date)
        vehicles = self._parse_vehicles(data.get("vehicles", []), shoot_date)

        return self._create_version(version, shoot_date, scenes, actors, vehicles, data.get("notes", ""))

    def _import_csv(self, version: str) -> Tuple[CallSheetVersion, List[Issue]]:
        scenes: List[Scene] = []
        actors: List[Actor] = []
        vehicles: List[Vehicle] = []
        shoot_date = None
        notes = ""
        
        try:
            with open(self.source_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                line_num = 2
                
                for row in reader:
                    if not shoot_date:
                        shoot_date = self._parse_shoot_date(row.get("shoot_date", ""), line_num)
                    
                    if row.get("scene_number"):
                        scenes.append(self._parse_scene_csv(row, shoot_date, line_num))
                    elif row.get("actor_name"):
                        actors.append(self._parse_actor_csv(row, shoot_date, line_num))
                    elif row.get("vehicle_id"):
                        vehicles.append(self._parse_vehicle_csv(row, shoot_date, line_num))
                    
                    line_num += 1
        except Exception as e:
            self._add_issue(
                IssueType.INVALID_TIME_FORMAT,
                IssueSeverity.ERROR,
                f"CSV解析错误: {str(e)}",
                self.source_name
            )

        return self._create_version(version, shoot_date or date.today(), scenes, actors, vehicles, notes)

    def _create_version(self, version: str, shoot_date: date, 
                        scenes: List[Scene], actors: List[Actor], 
                        vehicles: List[Vehicle], notes: str) -> Tuple[CallSheetVersion, List[Issue]]:
        
        self._validate_scenes(scenes)
        self._validate_actors(actors)
        self._validate_vehicles(vehicles)
        self._check_references(scenes, actors, vehicles)
        
        call_sheet = CallSheetVersion(
            version=version,
            shoot_date=shoot_date,
            imported_at=datetime.now(),
            source_file=self.source_file,
            scenes=scenes,
            actors=actors,
            vehicles=vehicles,
            notes=notes,
            issues=self.issues.copy(),
            conflicts=[]
        )
        
        return call_sheet, self.issues

    def _create_empty_version(self, version: str) -> CallSheetVersion:
        return CallSheetVersion(
            version=version,
            shoot_date=date.today(),
            imported_at=datetime.now(),
            source_file=self.source_file,
            scenes=[],
            actors=[],
            vehicles=[],
            notes="",
            issues=self.issues.copy(),
            conflicts=[]
        )

    def _parse_scene_csv(self, row: Dict[str, str], shoot_date: date, line_num: int) -> Scene:
        number = row.get("scene_number", "").strip()
        location = row.get("location", "").strip()
        
        if not number:
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.ERROR,
                f"场景号不能为空",
                self.source_name,
                "scene_number",
                "",
                line_num
            )
        
        if not location:
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.ERROR,
                f"场景地点不能为空",
                self.source_name,
                "location",
                "",
                line_num
            )

        actors_str = row.get("actors", "")
        vehicles_str = row.get("vehicles", "")
        
        return Scene(
            number=number,
            location=location,
            description=row.get("description", ""),
            shoot_date=shoot_date,
            call_time=self._parse_datetime(row.get("call_time", ""), shoot_date, line_num),
            wrap_time=self._parse_datetime(row.get("wrap_time", ""), shoot_date, line_num),
            actors=[a.strip() for a in actors_str.split(";") if a.strip()] if actors_str else [],
            vehicles=[v.strip() for v in vehicles_str.split(";") if v.strip()] if vehicles_str else [],
            notes=row.get("notes", "")
        )

    def _parse_actor_csv(self, row: Dict[str, str], shoot_date: date, line_num: int) -> Actor:
        name = row.get("actor_name", "").strip()
        
        if not name:
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.ERROR,
                f"演员姓名不能为空",
                self.source_name,
                "actor_name",
                "",
                line_num
            )

        scenes_str = row.get("scenes", "")
        
        return Actor(
            name=name,
            role=row.get("role", ""),
            call_time=self._parse_datetime(row.get("call_time", ""), shoot_date, line_num),
            wrap_time=self._parse_datetime(row.get("wrap_time", ""), shoot_date, line_num),
            scenes=[s.strip() for s in scenes_str.split(";") if s.strip()] if scenes_str else [],
            notes=row.get("notes", "")
        )

    def _parse_vehicle_csv(self, row: Dict[str, str], shoot_date: date, line_num: int) -> Vehicle:
        vid = row.get("vehicle_id", "").strip()
        vtype = row.get("vehicle_type", "").strip()
        
        if not vid:
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.ERROR,
                f"车辆ID不能为空",
                self.source_name,
                "vehicle_id",
                "",
                line_num
            )
        
        if not vtype:
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.ERROR,
                f"车辆类型不能为空",
                self.source_name,
                "vehicle_type",
                "",
                line_num
            )

        return Vehicle(
            id=vid,
            type=vtype,
            driver=row.get("driver", ""),
            usage=row.get("usage", ""),
            start_time=self._parse_datetime(row.get("start_time", ""), shoot_date, line_num),
            end_time=self._parse_datetime(row.get("end_time", ""), shoot_date, line_num),
            notes=row.get("notes", "")
        )

    def _parse_scenes(self, scenes_data: List[Dict[str, Any]], shoot_date: date) -> List[Scene]:
        scenes = []
        seen_numbers = set()
        
        for idx, s in enumerate(scenes_data):
            number = s.get("number", "").strip()
            
            if number in seen_numbers:
                self._add_issue(
                    IssueType.DUPLICATE_ENTRY,
                    IssueSeverity.ERROR,
                    f"重复的场景号: {number}",
                    self.source_name,
                    "number",
                    number,
                    idx + 2
                )
            else:
                seen_numbers.add(number)
            
            scenes.append(Scene(
                number=number,
                location=s.get("location", ""),
                description=s.get("description", ""),
                shoot_date=self._parse_date(s.get("shoot_date")) if s.get("shoot_date") else shoot_date,
                call_time=self._parse_datetime(s.get("call_time", ""), shoot_date or date.today(), idx + 2),
                wrap_time=self._parse_datetime(s.get("wrap_time", ""), shoot_date or date.today(), idx + 2),
                actors=s.get("actors", []),
                vehicles=s.get("vehicles", []),
                notes=s.get("notes", "")
            ))
        
        return scenes

    def _parse_actors(self, actors_data: List[Dict[str, Any]], shoot_date: date) -> List[Actor]:
        actors = []
        seen_names = set()
        
        for idx, a in enumerate(actors_data):
            name = a.get("name", "").strip()
            
            if name in seen_names:
                self._add_issue(
                    IssueType.DUPLICATE_ENTRY,
                    IssueSeverity.ERROR,
                    f"重复的演员: {name}",
                    self.source_name,
                    "name",
                    name,
                    idx + 2
                )
            else:
                seen_names.add(name)
            
            actors.append(Actor(
                name=name,
                role=a.get("role", ""),
                call_time=self._parse_datetime(a.get("call_time", ""), shoot_date or date.today(), idx + 2),
                wrap_time=self._parse_datetime(a.get("wrap_time", ""), shoot_date or date.today(), idx + 2),
                scenes=a.get("scenes", []),
                notes=a.get("notes", "")
            ))
        
        return actors

    def _parse_vehicles(self, vehicles_data: List[Dict[str, Any]], shoot_date: date) -> List[Vehicle]:
        vehicles = []
        seen_ids = set()
        
        for idx, v in enumerate(vehicles_data):
            vid = v.get("id", "").strip()
            
            if vid in seen_ids:
                self._add_issue(
                    IssueType.DUPLICATE_ENTRY,
                    IssueSeverity.ERROR,
                    f"重复的车辆ID: {vid}",
                    self.source_name,
                    "id",
                    vid,
                    idx + 2
                )
            else:
                seen_ids.add(vid)
            
            vehicles.append(Vehicle(
                id=vid,
                type=v.get("type", ""),
                driver=v.get("driver", ""),
                usage=v.get("usage", ""),
                start_time=self._parse_datetime(v.get("start_time", ""), shoot_date or date.today(), idx + 2),
                end_time=self._parse_datetime(v.get("end_time", ""), shoot_date or date.today(), idx + 2),
                notes=v.get("notes", "")
            ))
        
        return vehicles

    def _validate_scenes(self, scenes: List[Scene]) -> None:
        for idx, scene in enumerate(scenes):
            if not scene.number:
                self._add_issue(
                    IssueType.MISSING_REQUIRED_FIELD,
                    IssueSeverity.ERROR,
                    "场景缺少场景号",
                    self.source_name,
                    "number",
                    "",
                    idx + 2
                )
            if not scene.location:
                self._add_issue(
                    IssueType.MISSING_REQUIRED_FIELD,
                    IssueSeverity.WARNING,
                    f"场景 {scene.number} 缺少地点",
                    self.source_name,
                    "location",
                    "",
                    idx + 2
                )

    def _validate_actors(self, actors: List[Actor]) -> None:
        for idx, actor in enumerate(actors):
            if not actor.name:
                self._add_issue(
                    IssueType.MISSING_REQUIRED_FIELD,
                    IssueSeverity.ERROR,
                    "演员缺少姓名",
                    self.source_name,
                    "name",
                    "",
                    idx + 2
                )

    def _validate_vehicles(self, vehicles: List[Vehicle]) -> None:
        for idx, vehicle in enumerate(vehicles):
            if not vehicle.id:
                self._add_issue(
                    IssueType.MISSING_REQUIRED_FIELD,
                    IssueSeverity.ERROR,
                    "车辆缺少ID",
                    self.source_name,
                    "id",
                    "",
                    idx + 2
                )
            if not vehicle.type:
                self._add_issue(
                    IssueType.MISSING_REQUIRED_FIELD,
                    IssueSeverity.WARNING,
                    f"车辆 {vehicle.id} 缺少类型",
                    self.source_name,
                    "type",
                    "",
                    idx + 2
                )

    def _check_references(self, scenes: List[Scene], actors: List[Actor], vehicles: List[Vehicle]) -> None:
        actor_names = {a.name for a in actors}
        vehicle_ids = {v.id for v in vehicles}
        scene_numbers = {s.number for s in scenes}

        for idx, scene in enumerate(scenes):
            for actor_name in scene.actors:
                if actor_name not in actor_names:
                    self._add_issue(
                        IssueType.REFERENCE_NOT_FOUND,
                        IssueSeverity.WARNING,
                        f"场景 {scene.number} 引用的演员 '{actor_name}' 未在演员列表中定义",
                        self.source_name,
                        "actors",
                        actor_name,
                        idx + 2
                    )
            for vehicle_id in scene.vehicles:
                if vehicle_id not in vehicle_ids:
                    self._add_issue(
                        IssueType.REFERENCE_NOT_FOUND,
                        IssueSeverity.WARNING,
                        f"场景 {scene.number} 引用的车辆 '{vehicle_id}' 未在车辆列表中定义",
                        self.source_name,
                        "vehicles",
                        vehicle_id,
                        idx + 2
                    )

        for idx, actor in enumerate(actors):
            for scene_num in actor.scenes:
                if scene_num not in scene_numbers:
                    self._add_issue(
                        IssueType.REFERENCE_NOT_FOUND,
                        IssueSeverity.WARNING,
                        f"演员 {actor.name} 引用的场景 '{scene_num}' 未在场景列表中定义",
                        self.source_name,
                        "scenes",
                        scene_num,
                        idx + 2
                    )

    def _parse_shoot_date(self, date_str: str, line_num: Optional[int] = None) -> date:
        if not date_str:
            self._add_issue(
                IssueType.MISSING_REQUIRED_FIELD,
                IssueSeverity.WARNING,
                "拍摄日期未指定，使用今天作为默认日期",
                self.source_name,
                "shoot_date",
                "",
                line_num
            )
            return date.today()
        
        parsed = self._parse_date(date_str)
        if not parsed:
            self._add_issue(
                IssueType.INVALID_DATE_FORMAT,
                IssueSeverity.ERROR,
                f"无效的日期格式: {date_str}",
                self.source_name,
                "shoot_date",
                date_str,
                line_num
            )
            return date.today()
        return parsed

    def _parse_date(self, date_str: str) -> Optional[date]:
        if not date_str:
            return None
        
        for fmt in self.DATE_FORMATS:
            try:
                return datetime.strptime(str(date_str), fmt).date()
            except ValueError:
                continue
        return None

    def _parse_datetime(self, time_str: str, base_date: date, line_num: Optional[int] = None) -> Optional[datetime]:
        if not time_str:
            return None
        
        for fmt in self.TIME_FORMATS:
            try:
                t = datetime.strptime(str(time_str), fmt).time()
                return datetime.combine(base_date, t)
            except ValueError:
                continue
        
        self._add_issue(
            IssueType.INVALID_TIME_FORMAT,
            IssueSeverity.WARNING,
            f"无效的时间格式: {time_str}",
            self.source_name,
            "time",
            time_str,
            line_num
        )
        return None

    def _add_issue(self, issue_type: IssueType, severity: IssueSeverity, 
                   message: str, source: str, field: Optional[str] = None,
                   value: Optional[str] = None, line_number: Optional[int] = None) -> None:
        self.issues.append(Issue(
            issue_type=issue_type,
            severity=severity,
            message=message,
            source=source,
            field=field,
            value=value,
            line_number=line_number
        ))

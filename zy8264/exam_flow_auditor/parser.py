"""
解析器模块 - 负责解析各类输入文件
"""

import csv
import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

import yaml


class ExamRoom:
    def __init__(self, room_id: str, building: str, floor: int, capacity: int,
                 campus: str, exam_date: str, exam_time: str):
        self.room_id = room_id
        self.building = building
        self.floor = floor
        self.capacity = capacity
        self.campus = campus
        self.exam_date = exam_date
        self.exam_time = exam_time
        self._parse_exam_time()

    def _parse_exam_time(self):
        start_str, end_str = self.exam_time.split("-")
        self.exam_start_time = start_str.strip()
        self.exam_end_time = end_str.strip()

    @property
    def is_midnight_exam(self) -> bool:
        start_hour = int(self.exam_start_time.split(":")[0])
        end_hour = int(self.exam_end_time.split(":")[0])
        return start_hour >= 22 or (start_hour < end_hour and start_hour >= 20)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "room_id": self.room_id,
            "building": self.building,
            "floor": self.floor,
            "capacity": self.capacity,
            "campus": self.campus,
            "exam_date": self.exam_date,
            "exam_time": self.exam_time,
            "is_midnight_exam": self.is_midnight_exam
        }


class Invigilator:
    def __init__(self, teacher_id: str, name: str, department: str,
                 campus: str, role: str, authorized_rooms: List[str]):
        self.teacher_id = teacher_id
        self.name = name
        self.department = department
        self.campus = campus
        self.role = role
        self.authorized_rooms = authorized_rooms

    def is_authorized_for_room(self, room_id: str) -> bool:
        if self.role == "考务":
            return True
        return room_id in self.authorized_rooms

    def to_dict(self) -> Dict[str, Any]:
        return {
            "teacher_id": self.teacher_id,
            "name": self.name,
            "department": self.department,
            "campus": self.campus,
            "role": self.role,
            "authorized_rooms": self.authorized_rooms
        }


class BagManifest:
    def __init__(self, bag_id: str, bag_type: str, exam_date: str, exam_time: str,
                 room_id: str, campus: str, subject: str, sealed_time: str,
                 initial_location: str, paper_count: Optional[int] = None,
                 answer_count: Optional[int] = None):
        self.bag_id = bag_id
        self.bag_type = bag_type
        self.exam_date = exam_date
        self.exam_time = exam_time
        self.room_id = room_id
        self.campus = campus
        self.subject = subject
        self.sealed_time = sealed_time
        self.initial_location = initial_location
        self.paper_count = paper_count
        self.answer_count = answer_count
        self._parse_exam_time()

    def _parse_exam_time(self):
        if "-" in self.exam_time:
            start_str, end_str = self.exam_time.split("-")
            self.exam_start_time = start_str.strip()
            self.exam_end_time = end_str.strip()
        else:
            self.exam_start_time = self.exam_time
            self.exam_end_time = self.exam_time

    @property
    def is_midnight_exam(self) -> bool:
        start_hour = int(self.exam_start_time.split(":")[0])
        end_hour = int(self.exam_end_time.split(":")[0])
        return start_hour >= 22 or (start_hour < end_hour and start_hour >= 20)

    @property
    def is_paper_bag(self) -> bool:
        return self.bag_type == "备用卷袋"

    @property
    def is_answer_bag(self) -> bool:
        return self.bag_type == "答题卡袋"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bag_id": self.bag_id,
            "bag_type": self.bag_type,
            "exam_date": self.exam_date,
            "exam_time": self.exam_time,
            "room_id": self.room_id,
            "campus": self.campus,
            "subject": self.subject,
            "sealed_time": self.sealed_time,
            "initial_location": self.initial_location,
            "paper_count": self.paper_count,
            "answer_count": self.answer_count,
            "is_midnight_exam": self.is_midnight_exam
        }


class BagScan:
    def __init__(self, scan_id: str, bag_id: str, teacher_id: str, action: str,
                 timestamp: str, location: str, notes: str = ""):
        self.scan_id = scan_id
        self.bag_id = bag_id
        self.teacher_id = teacher_id
        self.action = action
        self.timestamp = timestamp
        self.location = location
        self.notes = notes
        self._parse_timestamp()

    def _parse_timestamp(self):
        self.dt = datetime.fromisoformat(self.timestamp)
        self.date_str = self.dt.strftime("%Y-%m-%d")
        self.time_str = self.dt.strftime("%H:%M:%S")

    @property
    def hour(self) -> int:
        return self.dt.hour

    @property
    def minute(self) -> int:
        return self.dt.minute

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scan_id": self.scan_id,
            "bag_id": self.bag_id,
            "teacher_id": self.teacher_id,
            "action": self.action,
            "timestamp": self.timestamp,
            "location": self.location,
            "notes": self.notes
        }


class FlowRule:
    def __init__(self, flow_type: str, name: str, states: List[str],
                 transitions: List[Dict[str, Any]]):
        self.flow_type = flow_type
        self.name = name
        self.states = states
        self.transitions = transitions
        self._build_transition_map()

    def _build_transition_map(self):
        self.transition_map: Dict[str, Dict[str, Dict[str, Any]]] = {}
        for state in self.states:
            self.transition_map[state] = {}

        for trans in self.transitions:
            from_state = trans["from"]
            action = trans["action"]
            self.transition_map[from_state][action] = {
                "to": trans["to"],
                "required_roles": trans.get("required_roles", []),
                "time_window": trans.get("time_window", "")
            }

    def get_next_state(self, current_state: str, action: str) -> Optional[str]:
        if current_state in self.transition_map:
            if action in self.transition_map[current_state]:
                return self.transition_map[current_state][action]["to"]
        return None

    def get_required_roles(self, current_state: str, action: str) -> List[str]:
        if current_state in self.transition_map:
            if action in self.transition_map[current_state]:
                return self.transition_map[current_state][action].get("required_roles", [])
        return []

    def is_valid_transition(self, current_state: str, action: str) -> bool:
        return self.get_next_state(current_state, action) is not None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "flow_type": self.flow_type,
            "name": self.name,
            "states": self.states,
            "transitions": self.transitions
        }


class ValidationRule:
    def __init__(self, rule_id: str, name: str, description: str, severity: str):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.severity = severity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "name": self.name,
            "description": self.description,
            "severity": self.severity
        }


class Parser:
    def __init__(self, base_path: Optional[Path] = None):
        self.base_path = base_path or Path.cwd()

    def parse_exam_rooms(self, file_path: str) -> Dict[str, ExamRoom]:
        full_path = self.base_path / file_path
        rooms: Dict[str, ExamRoom] = {}

        with open(full_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                room = ExamRoom(
                    room_id=row["room_id"],
                    building=row["building"],
                    floor=int(row["floor"]),
                    capacity=int(row["capacity"]),
                    campus=row["campus"],
                    exam_date=row["exam_date"],
                    exam_time=row["exam_time"]
                )
                rooms[room.room_id] = room

        return rooms

    def parse_invigilators(self, file_path: str) -> Dict[str, Invigilator]:
        full_path = self.base_path / file_path
        invigilators: Dict[str, Invigilator] = {}

        with open(full_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                authorized_rooms = []
                if row.get("authorized_rooms"):
                    authorized_rooms = [r.strip() for r in row["authorized_rooms"].split(",") if r.strip()]

                invigilator = Invigilator(
                    teacher_id=row["teacher_id"],
                    name=row["name"],
                    department=row["department"],
                    campus=row["campus"],
                    role=row["role"],
                    authorized_rooms=authorized_rooms
                )
                invigilators[invigilator.teacher_id] = invigilator

        return invigilators

    def parse_paper_manifest(self, file_path: str) -> Dict[str, BagManifest]:
        full_path = self.base_path / file_path
        manifests: Dict[str, BagManifest] = {}

        with open(full_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        for item in data.get("manifests", []):
            manifest = BagManifest(
                bag_id=item["bag_id"],
                bag_type=item["bag_type"],
                exam_date=item["exam_date"],
                exam_time=item["exam_time"],
                room_id=item["room_id"],
                campus=item["campus"],
                subject=item["subject"],
                sealed_time=item["sealed_time"],
                initial_location=item["initial_location"],
                paper_count=item.get("paper_count"),
                answer_count=item.get("answer_count")
            )
            manifests[manifest.bag_id] = manifest

        return manifests

    def parse_bag_scans(self, file_path: str) -> List[BagScan]:
        full_path = self.base_path / file_path
        scans: List[BagScan] = []

        with open(full_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                data = json.loads(line)
                scan = BagScan(
                    scan_id=data["scan_id"],
                    bag_id=data["bag_id"],
                    teacher_id=data["teacher_id"],
                    action=data["action"],
                    timestamp=data["timestamp"],
                    location=data["location"],
                    notes=data.get("notes", "")
                )
                scans.append(scan)

        scans.sort(key=lambda x: x.dt)
        return scans

    def parse_flow_rules(self, file_path: str) -> Dict[str, Any]:
        full_path = self.base_path / file_path

        with open(full_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        flow_rules: Dict[str, FlowRule] = {}
        validation_rules: Dict[str, ValidationRule] = {}

        for flow_type, flow_data in data.get("flow_rules", {}).items():
            states = []
            for state_item in flow_data["states"]:
                if isinstance(state_item, dict):
                    states.append(list(state_item.keys())[0])
                else:
                    states.append(state_item)

            flow_rule = FlowRule(
                flow_type=flow_type,
                name=flow_data["name"],
                states=states,
                transitions=flow_data["transitions"]
            )
            flow_rules[flow_type] = flow_rule

        for rule_id, rule_data in data.get("validation_rules", {}).items():
            validation_rule = ValidationRule(
                rule_id=rule_id,
                name=rule_data["name"],
                description=rule_data["description"],
                severity=rule_data["severity"]
            )
            validation_rules[rule_id] = validation_rule

        return {
            "flow_rules": flow_rules,
            "validation_rules": validation_rules
        }

    def parse_all(self, exam_rooms_path: str, invigilators_path: str,
                  paper_manifest_path: str, bag_scans_path: str,
                  flow_rules_path: str) -> Dict[str, Any]:
        return {
            "exam_rooms": self.parse_exam_rooms(exam_rooms_path),
            "invigilators": self.parse_invigilators(invigilators_path),
            "bag_manifests": self.parse_paper_manifest(paper_manifest_path),
            "bag_scans": self.parse_bag_scans(bag_scans_path),
            "flow_rules": self.parse_flow_rules(flow_rules_path)
        }

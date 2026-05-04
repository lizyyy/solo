import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .models import (
    Volunteer, Course, ScheduleResult, LeaveRequest, SwapRequest,
    TimeSlot, ScheduleAssignment
)


class DataStore:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.getcwd(), "scheduler_data")
        
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.volunteers_file = self.data_dir / "volunteers.json"
        self.courses_file = self.data_dir / "courses.json"
        self.schedule_file = self.data_dir / "schedule.json"
        self.leaves_file = self.data_dir / "leave_requests.json"
        self.swaps_file = self.data_dir / "swap_requests.json"
        self.history_dir = self.data_dir / "history"
        self.history_dir.mkdir(parents=True, exist_ok=True)

    def save_volunteers(self, volunteers: List[Volunteer]) -> bool:
        try:
            data = [v.to_dict() for v in volunteers]
            with open(self.volunteers_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存志愿者数据失败: {e}")
            return False

    def load_volunteers(self) -> List[Volunteer]:
        if not self.volunteers_file.exists():
            return []
        
        try:
            with open(self.volunteers_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [Volunteer.from_dict(v) for v in data]
        except Exception as e:
            print(f"加载志愿者数据失败: {e}")
            return []

    def save_courses(self, courses: List[Course]) -> bool:
        try:
            data = [c.to_dict() for c in courses]
            with open(self.courses_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存课程数据失败: {e}")
            return False

    def load_courses(self) -> List[Course]:
        if not self.courses_file.exists():
            return []
        
        try:
            with open(self.courses_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [Course.from_dict(c) for c in data]
        except Exception as e:
            print(f"加载课程数据失败: {e}")
            return []

    def save_schedule(self, schedule: ScheduleResult, create_backup: bool = True) -> bool:
        try:
            if create_backup and self.schedule_file.exists():
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_file = self.history_dir / f"schedule_{timestamp}.json"
                with open(self.schedule_file, 'r', encoding='utf-8') as f:
                    old_data = json.load(f)
                with open(backup_file, 'w', encoding='utf-8') as f:
                    json.dump(old_data, f, ensure_ascii=False, indent=2)
            
            data = schedule.to_dict()
            with open(self.schedule_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存排班数据失败: {e}")
            return False

    def load_schedule(self) -> Optional[ScheduleResult]:
        if not self.schedule_file.exists():
            return None
        
        try:
            with open(self.schedule_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return ScheduleResult.from_dict(data)
        except Exception as e:
            print(f"加载排班数据失败: {e}")
            return None

    def save_leave_requests(self, requests: List[LeaveRequest]) -> bool:
        try:
            data = [r.to_dict() for r in requests]
            with open(self.leaves_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存请假数据失败: {e}")
            return False

    def load_leave_requests(self) -> List[LeaveRequest]:
        if not self.leaves_file.exists():
            return []
        
        try:
            with open(self.leaves_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [LeaveRequest.from_dict(r) for r in data]
        except Exception as e:
            print(f"加载请假数据失败: {e}")
            return []

    def save_swap_requests(self, requests: List[SwapRequest]) -> bool:
        try:
            data = [r.to_dict() for r in requests]
            with open(self.swaps_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存调班数据失败: {e}")
            return False

    def load_swap_requests(self) -> List[SwapRequest]:
        if not self.swaps_file.exists():
            return []
        
        try:
            with open(self.swaps_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return [SwapRequest.from_dict(r) for r in data]
        except Exception as e:
            print(f"加载调班数据失败: {e}")
            return []

    def save_all(
        self,
        volunteers: List[Volunteer] = None,
        courses: List[Course] = None,
        schedule: ScheduleResult = None,
        leave_requests: List[LeaveRequest] = None,
        swap_requests: List[SwapRequest] = None
    ) -> Dict[str, bool]:
        results = {}
        
        if volunteers is not None:
            results['volunteers'] = self.save_volunteers(volunteers)
        
        if courses is not None:
            results['courses'] = self.save_courses(courses)
        
        if schedule is not None:
            results['schedule'] = self.save_schedule(schedule)
        
        if leave_requests is not None:
            results['leave_requests'] = self.save_leave_requests(leave_requests)
        
        if swap_requests is not None:
            results['swap_requests'] = self.save_swap_requests(swap_requests)
        
        return results

    def load_all(self) -> Dict[str, Any]:
        return {
            'volunteers': self.load_volunteers(),
            'courses': self.load_courses(),
            'schedule': self.load_schedule(),
            'leave_requests': self.load_leave_requests(),
            'swap_requests': self.load_swap_requests()
        }

    def list_history_files(self) -> List[str]:
        if not self.history_dir.exists():
            return []
        
        files = []
        for f in self.history_dir.glob("schedule_*.json"):
            files.append(f.name)
        
        files.sort(reverse=True)
        return files

    def load_history(self, filename: str) -> Optional[ScheduleResult]:
        file_path = self.history_dir / filename
        
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return ScheduleResult.from_dict(data)
        except Exception as e:
            print(f"加载历史排班数据失败: {e}")
            return None

    def get_data_status(self) -> Dict[str, Any]:
        status = {
            'data_dir': str(self.data_dir),
            'volunteers': {
                'exists': self.volunteers_file.exists(),
                'count': len(self.load_volunteers())
            },
            'courses': {
                'exists': self.courses_file.exists(),
                'count': len(self.load_courses())
            },
            'schedule': {
                'exists': self.schedule_file.exists(),
                'last_modified': self._get_file_modified_time(self.schedule_file)
            },
            'leave_requests': {
                'exists': self.leaves_file.exists(),
                'count': len(self.load_leave_requests())
            },
            'swap_requests': {
                'exists': self.swaps_file.exists(),
                'count': len(self.load_swap_requests())
            },
            'history_count': len(self.list_history_files())
        }
        return status

    def _get_file_modified_time(self, file_path: Path) -> Optional[str]:
        if not file_path.exists():
            return None
        
        try:
            mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            return mtime.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return None

    def clear_all_data(self, confirm: bool = False) -> bool:
        if not confirm:
            return False
        
        try:
            for file_path in [
                self.volunteers_file,
                self.courses_file,
                self.schedule_file,
                self.leaves_file,
                self.swaps_file
            ]:
                if file_path.exists():
                    file_path.unlink()
            
            for history_file in self.history_dir.glob("*.json"):
                history_file.unlink()
            
            return True
        except Exception as e:
            print(f"清除数据失败: {e}")
            return False

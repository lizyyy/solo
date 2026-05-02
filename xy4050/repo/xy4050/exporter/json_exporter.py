import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from models.drill import Drill, DrillStatus
from models.event import Event, MergeStatus
from models.risk_level import RiskLevel
from detector.issue_detector import Issue, IssueType, IssueSeverity, IssueStatus
from config import APP_NAME, APP_VERSION


class JSONExporter:
    def __init__(self):
        pass
    
    def _serialize_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        if dt is None:
            return None
        return dt.isoformat()
    
    def _serialize_object(self, obj) -> Any:
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        elif isinstance(obj, datetime):
            return self._serialize_datetime(obj)
        elif isinstance(obj, (list, tuple)):
            return [self._serialize_object(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: self._serialize_object(v) for k, v in obj.items()}
        elif hasattr(obj, 'value'):
            return str(obj.value)
        return obj
    
    def export_drill_archive(
        self,
        drill: Drill,
        events: List[Event],
        issues: List[Issue],
        import_batches: Optional[List] = None,
        time_offsets: Optional[Dict[str, int]] = None,
        areas: Optional[List] = None,
        event_types: Optional[List] = None,
        observers: Optional[List] = None,
        output_path: Optional[str] = None,
    ) -> Dict[str, Any]:
        archive: Dict[str, Any] = {
            'version': '1.0',
            'export_time': self._serialize_datetime(datetime.now()),
            'exported_by': f'{APP_NAME} v{APP_VERSION}',
        }
        
        archive['drill'] = self._serialize_object(drill)
        
        archive['events'] = [self._serialize_object(e) for e in events]
        
        archive['issues'] = [self._serialize_object(i) for i in issues]
        
        if import_batches:
            archive['import_batches'] = [self._serialize_object(b) for b in import_batches]
        
        if time_offsets:
            archive['time_offsets'] = time_offsets
        
        if areas:
            archive['areas'] = [self._serialize_object(a) for a in areas]
        
        if event_types:
            archive['event_types'] = [self._serialize_object(et) for et in event_types]
        
        if observers:
            archive['observers'] = [self._serialize_object(o) for o in observers]
        
        statistics = {
            'total_events': len(events),
            'valid_events': sum(1 for e in events if e.is_valid),
            'invalid_events': sum(1 for e in events if not e.is_valid),
            'total_issues': len(issues),
            'issues_by_severity': {},
            'events_by_source': {},
            'events_by_risk_level': {},
        }
        
        for issue in issues:
            severity = str(issue.severity)
            statistics['issues_by_severity'][severity] = statistics['issues_by_severity'].get(severity, 0) + 1
        
        for event in events:
            source = event.source
            statistics['events_by_source'][source] = statistics['events_by_source'].get(source, 0) + 1
            
            risk = str(event.risk_level)
            statistics['events_by_risk_level'][risk] = statistics['events_by_risk_level'].get(risk, 0) + 1
        
        archive['statistics'] = statistics
        
        if output_path:
            output_file = Path(output_path)
            output_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(archive, f, ensure_ascii=False, indent=2, default=str)
        
        return archive
    
    def load_drill_archive(
        self,
        input_path: str,
    ) -> Dict[str, Any]:
        input_file = Path(input_path)
        if not input_file.exists():
            raise FileNotFoundError(f"档案文件不存在: {input_path}")
        
        with open(input_file, 'r', encoding='utf-8') as f:
            archive = json.load(f)
        
        return archive

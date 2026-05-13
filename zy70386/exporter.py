import csv
import json
from datetime import datetime
from typing import List, Dict, Any

from database import Database
from config import get_config


class Exporter:
    def __init__(self, db: Database = None):
        self.db = db or Database()
        self.config = get_config()

    def export_ready_list(self, format: str = 'csv', include_history: bool = False) -> str:
        members = self.db.get_all_members()
        ready_members = []
        
        for member_id in members:
            conflicts = self.db.get_conflicts(member_id, resolved=False)
            if not conflicts:
                member = self.db.get_member(member_id)
                tags = self.db.get_member_tags(member_id, include_cleaned=False)
                
                ready_members.append({
                    'member_id': member_id,
                    'name': member.get('name') if member else '',
                    'phone': member.get('phone') if member else '',
                    'email': member.get('email') if member else '',
                    'tags': self._format_tags(tags),
                    'tag_details': tags if include_history else None,
                })
        
        if format == 'json':
            return json.dumps(ready_members, ensure_ascii=False, indent=2)
        else:
            return self._to_csv(ready_members, include_history)

    def export_need_review_list(self, format: str = 'csv', include_history: bool = False) -> str:
        conflicts = self.db.get_conflicts()
        need_review = []
        
        for conflict in conflicts:
            member = self.db.get_member(conflict['member_id'])
            tag_ids = list(map(int, conflict['tag_ids'].split(',')))
            tags = [self.db.get_tag_by_id(tid) for tid in tag_ids]
            tags = [t for t in tags if t]
            
            need_review.append({
                'conflict_id': conflict['id'],
                'member_id': conflict['member_id'],
                'member_name': member.get('name') if member else '',
                'conflict_type': conflict['conflict_type'],
                'conflict_description': conflict['description'],
                'conflicting_tags': ', '.join([f"{t['tag_name']}({t['source_display_name']})" for t in tags]),
                'created_at': conflict['created_at'],
                'history': self.db.get_conflict_history(conflict['member_id']) if include_history else [],
            })
        
        if format == 'json':
            return json.dumps(need_review, ensure_ascii=False, indent=2)
        else:
            return self._conflicts_to_csv(need_review)

    def export_clean_report(self, format: str = 'csv') -> str:
        members = self.db.get_all_members()
        report = []
        
        for member_id in members:
            member = self.db.get_member(member_id)
            all_tags = self.db.get_member_tags(member_id, include_cleaned=True)
            
            active_tags = [t for t in all_tags if not t['is_cleaned']]
            cleaned_tags = [t for t in all_tags if t['is_cleaned']]
            
            conflicts = self.db.get_conflicts(member_id, resolved=True)
            
            report.append({
                'member_id': member_id,
                'member_name': member.get('name') if member else '',
                'original_tag_count': len(all_tags),
                'active_tags': self._format_tags(active_tags),
                'cleaned_tags': self._format_tags(cleaned_tags),
                'conflict_resolution_count': len(conflicts),
                'all_tags_details': all_tags,
                'conflict_history': conflicts,
            })
        
        if format == 'json':
            return json.dumps(report, ensure_ascii=False, indent=2)
        else:
            return self._report_to_csv(report)

    def export_resolution_history(self, member_id: str = None, format: str = 'csv') -> str:
        if member_id:
            conflicts = self.db.get_conflict_history(member_id)
        else:
            conflicts = self.db.get_conflicts(resolved=True)
        
        history = []
        for conflict in conflicts:
            member = self.db.get_member(conflict['member_id'])
            history.append({
                'conflict_id': conflict['id'],
                'member_id': conflict['member_id'],
                'member_name': member.get('name') if member else '',
                'conflict_type': conflict['conflict_type'],
                'resolution': conflict['resolution'],
                'resolved_by': conflict['resolved_by'],
                'resolved_at': conflict['resolved_at'],
            })
        
        if format == 'json':
            return json.dumps(history, ensure_ascii=False, indent=2)
        else:
            return self._history_to_csv(history)

    def _format_tags(self, tags: List[Dict[str, Any]]) -> str:
        if not tags:
            return ''
        return '; '.join([
            f"{t['tag_name']}({t['source_display_name']})" for t in tags
        ])

    def _to_csv(self, data: List[Dict[str, Any]], include_history: bool) -> str:
        import io
        output = io.StringIO()
        
        fieldnames = ['member_id', 'name', 'phone', 'email', 'tags']
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for item in data:
            writer.writerow({
                'member_id': item['member_id'],
                'name': item['name'],
                'phone': item['phone'],
                'email': item['email'],
                'tags': item['tags'],
            })
        
        return output.getvalue()

    def _conflicts_to_csv(self, data: List[Dict[str, Any]]) -> str:
        import io
        output = io.StringIO()
        
        fieldnames = ['conflict_id', 'member_id', 'member_name', 
                      'conflict_type', 'conflict_description', 
                      'conflicting_tags', 'created_at']
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(data)
        
        return output.getvalue()

    def _report_to_csv(self, data: List[Dict[str, Any]]) -> str:
        import io
        output = io.StringIO()
        
        fieldnames = ['member_id', 'member_name', 'original_tag_count', 
                      'active_tags', 'cleaned_tags', 'conflict_resolution_count']
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        for item in data:
            writer.writerow({
                'member_id': item['member_id'],
                'member_name': item['member_name'],
                'original_tag_count': item['original_tag_count'],
                'active_tags': item['active_tags'],
                'cleaned_tags': item['cleaned_tags'],
                'conflict_resolution_count': item['conflict_resolution_count'],
            })
        
        return output.getvalue()

    def _history_to_csv(self, data: List[Dict[str, Any]]) -> str:
        import io
        output = io.StringIO()
        
        fieldnames = ['conflict_id', 'member_id', 'member_name', 
                      'conflict_type', 'resolution', 'resolved_by', 'resolved_at']
        
        writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(data)
        
        return output.getvalue()

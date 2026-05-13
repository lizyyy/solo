from typing import List, Dict, Any
from datetime import datetime

from database import Database
from config import get_config


class ConflictResolver:
    def __init__(self, db: Database = None):
        self.db = db or Database()
        self.config = get_config()

    def auto_resolve_priority(self, conflict_id: int, resolved_by: str) -> Dict[str, Any]:
        conflicts = self.db.get_conflicts()
        conflict = next((c for c in conflicts if c['id'] == conflict_id), None)
        
        if not conflict:
            return {'success': False, 'message': f'冲突 {conflict_id} 不存在'}
        
        tag_ids = list(map(int, conflict['tag_ids'].split(',')))
        tags = [self.db.get_tag_by_id(tid) for tid in tag_ids]
        tags = [t for t in tags if t]
        
        if conflict['conflict_type'] in ['source_conflict', 'mutually_exclusive']:
            tags_with_priority = [
                (t, self.config.get_source_priority(t['source']))
                for t in tags
            ]
            max_priority = max(p for _, p in tags_with_priority)
            keep_tags = [t for t, p in tags_with_priority if p == max_priority]
            remove_tags = [t for t, p in tags_with_priority if p < max_priority]
            remove_tag_ids = [t['id'] for t in remove_tags]
            
            keep_names = [f"{t['tag_name']}({t['source_display_name']})" for t in keep_tags]
            remove_names = [f"{t['tag_name']}({t['source_display_name']})" for t in remove_tags]
            
            if remove_tag_ids:
                resolution = f"自动按优先级规则: 保留 {', '.join(keep_names)}, 清除 {', '.join(remove_names)}"
                cleaned_reason = f"按优先级规则清除 (优先级低于其他标签"
                
                self.db.resolve_conflict(
                    conflict_id, resolved_by, resolution, remove_tag_ids, cleaned_reason)
                
                return {
                    'success': True,
                    'message': f'自动解决冲突',
                    'kept': keep_names,
                    'removed': remove_names,
                    'resolution': resolution,
                }
            else:
                return {
                    'success': False,
                    'message': '所有标签优先级相同，需要人工确认',
                    'conflict_type': conflict['conflict_type'],
                    'tags': [f"{t['tag_name']}({t['source_display_name']})" for t in tags],
                }
        
        elif conflict['conflict_type'] == 'expired':
            self.db.resolve_conflict(
                conflict_id, resolved_by, 
                '清除过期标签', tag_ids, '标签已过期')
            return {
                'success': True,
                'message': '清除过期标签',
                'removed': [f"{t['tag_name']}({t['source_display_name']})" for t in tags],
            }
        
        elif conflict['conflict_type'] == 'duplicate':
            keep_tag = tags[0]
            remove_tags = tags[1:]
            remove_tag_ids = [t['id'] for t in remove_tags]
            
            self.db.resolve_conflict(
                conflict_id, resolved_by,
                f'保留第一个导入的标签，清除重复项', 
                remove_tag_ids, '重复标签')
            
            return {
                'success': True,
                'message': '清除重复标签',
                'kept': [f"{keep_tag['tag_name']}({keep_tag['source_display_name']})"],
                'removed': [f"{t['tag_name']}({t['source_display_name']})" for t in remove_tags],
            }
        
        return {
            'success': False,
            'message': f'无法自动解决该冲突类型',
            'conflict_type': conflict['conflict_type'],
        }

    def manual_resolve(self, conflict_id: int, resolved_by: str, keep_tag_ids: List[int], 
                        reason: str) -> Dict[str, Any]:
        conflicts = self.db.get_conflicts()
        conflict = next((c for c in conflicts if c['id'] == conflict_id), None)
        
        if not conflict:
            return {'success': False, 'message': f'冲突 {conflict_id} 不存在'}
        
        all_tag_ids = list(map(int, conflict['tag_ids'].split(',')))
        remove_tag_ids = [tid for tid in all_tag_ids if tid not in keep_tag_ids]
        
        if not remove_tag_ids:
            return {'success': False, 'message': '必须选择要清除的标签'}
        
        removed_tags = [self.db.get_tag_by_id(tid) for tid in remove_tag_ids]
        kept_tags = [self.db.get_tag_by_id(tid) for tid in keep_tag_ids]
        
        removed_names = [f"{t['tag_name']}({t['source_display_name']})" for t in removed_tags if t]
        kept_names = [f"{t['tag_name']}({t['source_display_name']})" for t in kept_tags if t]
        
        resolution = f"人工解决: 保留 {', '.join(kept_names)}, 清除 {', '.join(removed_names)}"
        cleaned_reason = reason or '人工处理'
        
        self.db.resolve_conflict(
            conflict_id, resolved_by, resolution, remove_tag_ids, cleaned_reason)
        
        return {
            'success': True,
            'message': '人工解决冲突成功',
            'kept': kept_names,
            'removed': removed_names,
            'resolution': resolution,
            'reason': reason,
        }

    def get_conflicts_for_review(self) -> List[Dict[str, Any]]:
        conflicts = self.db.get_conflicts()
        result = []
        
        for conflict in conflicts:
            tag_ids = list(map(int, conflict['tag_ids'].split(',')))
            tags = [self.db.get_tag_by_id(tid) for tid in tag_ids]
            tags = [t for t in tags if t]
            
            member = self.db.get_member(conflict['member_id'])
            
            result.append({
                'id': conflict['id'],
                'member_id': conflict['member_id'],
                'member_name': member.get('name') if member else None,
                'conflict_type': conflict['conflict_type'],
                'description': conflict['description'],
                'created_at': conflict['created_at'],
                'tags': tags,
                'history': self.db.get_resolution_history(conflict['member_id']),
            })
        
        return result

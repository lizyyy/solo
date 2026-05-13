from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Set
from collections import defaultdict

from database import Database
from config import get_config


class ConflictChecker:
    def __init__(self, db: Database = None):
        self.db = db or Database()
        self.config = get_config()

    def check_all(self) -> Dict[str, Any]:
        all_conflicts = []
        ready_members = []
        need_review_members = []

        members = self.db.get_all_members()
        
        for member_id in members:
            result = self.check_member(member_id)
            if result['conflicts']:
                all_conflicts.extend(result['conflicts'])
                need_review_members.append(member_id)
            else:
                ready_members.append(member_id)

        return {
            'total_members': len(members),
            'ready_members': ready_members,
            'ready_count': len(ready_members),
            'need_review_members': need_review_members,
            'need_review_count': len(need_review_members),
            'conflicts': all_conflicts,
            'conflict_count': len(all_conflicts),
        }

    def check_member(self, member_id: str) -> Dict[str, Any]:
        tags = self.db.get_member_tags(member_id, include_cleaned=False)
        
        self.db.clear_conflicts(member_id)
        
        conflicts = []
        
        conflicts.extend(self._check_expired_tags(member_id, tags))
        conflicts.extend(self._check_duplicate_tags(member_id, tags))
        conflicts.extend(self._check_mutually_exclusive_tags(member_id, tags))
        conflicts.extend(self._check_source_conflicts(member_id, tags))
        conflicts.extend(self._check_missing_reason_tags(member_id, tags))
        conflicts.extend(self._check_reappearance_tags(member_id, tags))

        conflict_ids = []
        for conflict in conflicts:
            cid = self.db.save_conflict(
                member_id=member_id,
                conflict_type=conflict['type'],
                tag_ids=conflict['tag_ids'],
                description=conflict['description']
            )
            conflict_ids.append(cid)
            conflict['id'] = cid
            conflict['member_id'] = member_id

        return {
            'member_id': member_id,
            'tags': tags,
            'conflicts': conflicts,
            'conflict_count': len(conflicts),
        }

    def _check_expired_tags(self, member_id: str, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        today = datetime.now().date()
        
        for tag in tags:
            if tag['end_date']:
                try:
                    end_date = datetime.strptime(tag['end_date'], '%Y-%m-%d').date()
                    if end_date < today:
                        conflicts.append({
                            'type': 'expired',
                            'tag_ids': [tag['id']],
                            'description': f"标签 '{tag['tag_name']}' 已过期 (截止日期: {tag['end_date']})",
                            'details': {
                                'tag_name': tag['tag_name'],
                                'source': tag['source'],
                                'end_date': tag['end_date'],
                            }
                        })
                except Exception:
                    pass
        
        return conflicts

    def _check_duplicate_tags(self, member_id: str, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        key_to_tags = defaultdict(list)
        
        for tag in tags:
            key = (tag['tag_name'], tag['source'], tag.get('start_date'))
            key_to_tags[key].append(tag)
        
        for key, tag_list in key_to_tags.items():
            if len(tag_list) > 1:
                tag_ids = [t['id'] for t in tag_list]
                conflicts.append({
                    'type': 'duplicate',
                    'tag_ids': tag_ids,
                    'description': f"同一来源重复标签 '{key[0]}' 来自 {tag_list[0]['source_display_name']}",
                    'details': {
                        'tag_name': key[0],
                        'source': key[1],
                        'count': len(tag_list),
                    }
                })
        
        return conflicts

    def _check_mutually_exclusive_tags(self, member_id: str, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        tag_names = set(t['tag_name'] for t in tags)
        
        for group in self.config.mutually_exclusive_tags:
            found = [tag for tag in group if tag in tag_names]
            if len(found) >= 2:
                related_tags = [t for t in tags if t['tag_name'] in found]
                tag_ids = [t['id'] for t in related_tags]
                tag_sources = [f"{t['tag_name']}({t['source_display_name']})" for t in related_tags]
                
                conflicts.append({
                    'type': 'mutually_exclusive',
                    'tag_ids': tag_ids,
                    'description': f"互斥标签冲突: {', '.join(tag_sources)}",
                    'details': {
                        'tags': found,
                        'sources': list(set(t['source'] for t in related_tags)),
                    }
                })
        
        return conflicts

    def _check_source_conflicts(self, member_id: str, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        tag_name_to_tags = defaultdict(list)
        
        for tag in tags:
            tag_name_to_tags[tag['tag_name']].append(tag)
        
        for tag_name, tag_list in tag_name_to_tags.items():
            sources = set(t['source'] for t in tag_list)
            if len(sources) > 1:
                tag_ids = [t['id'] for t in tag_list]
                priorities = [(t['source'], self.config.get_source_priority(t['source'])) for t in tag_list]
                max_priority = max(p for _, p in priorities)
                preferred_sources = [s for s, p in priorities if p == max_priority]
                
                tag_sources = [f"{t['source_display_name']}(优先级:{self.config.get_source_priority(t['source'])})" 
                             for t in tag_list]
                
                conflicts.append({
                    'type': 'source_conflict',
                    'tag_ids': tag_ids,
                    'description': f"多来源标签 '{tag_name}': {', '.join(tag_sources)} (推荐: {', '.join(preferred_sources)})",
                    'details': {
                        'tag_name': tag_name,
                        'sources': list(sources),
                        'preferred_sources': preferred_sources,
                        'priorities': {s: p for s, p in priorities},
                    }
                })
        
        return conflicts

    def _check_missing_reason_tags(self, member_id: str, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        
        for tag in tags:
            if self.config.requires_reason(tag['tag_name']) and not tag.get('reason'):
                conflicts.append({
                    'type': 'missing_reason',
                    'tag_ids': [tag['id']],
                    'description': f"人工标签 '{tag['tag_name']}' 缺少原因说明",
                    'details': {
                        'tag_name': tag['tag_name'],
                        'source': tag['source'],
                    }
                })
        
        return conflicts

    def _check_reappearance_tags(self, member_id: str, tags: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        conflicts = []
        
        for tag in tags:
            cleaned = self.db.check_reappearance(member_id, tag['tag_name'], tag['source'])
            if cleaned:
                cleaned_info = cleaned[0]
                conflicts.append({
                    'type': 'reappearance',
                    'tag_ids': [tag['id']],
                    'description': f"标签 '{tag['tag_name']}' 复发 (已清洗过, 处理人: {cleaned_info.get('cleaned_by', 'unknown')})",
                    'details': {
                        'tag_name': tag['tag_name'],
                        'source': tag['source'],
                        'cleaned_at': cleaned_info.get('cleaned_at'),
                        'cleaned_by': cleaned_info.get('cleaned_by'),
                        'cleaned_reason': cleaned_info.get('cleaned_reason'),
                    }
                })
        
        return conflicts

import json
import os
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

class VersionManager:
    def __init__(self, storage_dir: str = "./versions"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.storage_dir / "index.json"
        self._load_index()
    
    def _load_index(self):
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                self.index = json.load(f)
        else:
            self.index = {
                'songs': {},
                'total_versions': 0,
            }
    
    def _save_index(self):
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)
    
    def _generate_version_id(self) -> str:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        return f"v{timestamp}"
    
    def _calculate_hash(self, text: str) -> str:
        return hashlib.md5(text.encode('utf-8')).hexdigest()
    
    def save_version(self, 
                     lyrics_text: str,
                     song_title: str = "未命名",
                     author: str = "未知",
                     check_result: Optional[Dict] = None,
                     notes: str = "") -> Dict:
        version_id = self._generate_version_id()
        content_hash = self._calculate_hash(lyrics_text)
        
        if song_title not in self.index['songs']:
            self.index['songs'][song_title] = {
                'author': author,
                'created_at': datetime.now().isoformat(),
                'versions': [],
                'current_version': None,
            }
        
        song_data = self.index['songs'][song_title]
        
        existing = [v for v in song_data['versions'] if v['content_hash'] == content_hash]
        if existing:
            return {
                'is_duplicate': True,
                'existing_version': existing[0],
                'message': f"内容与版本 {existing[0]['version_id']} 完全相同",
            }
        
        version_data = {
            'version_id': version_id,
            'song_title': song_title,
            'author': author,
            'created_at': datetime.now().isoformat(),
            'content_hash': content_hash,
            'notes': notes,
            'check_result_summary': self._extract_summary(check_result) if check_result else None,
            'line_count': len(lyrics_text.split('\n')),
            'char_count': len(lyrics_text),
        }
        
        version_file = self.storage_dir / f"{song_title}_{version_id}.json"
        with open(version_file, 'w', encoding='utf-8') as f:
            json.dump({
                'version_info': version_data,
                'lyrics_text': lyrics_text,
                'check_result': check_result,
            }, f, ensure_ascii=False, indent=2)
        
        song_data['versions'].append(version_data)
        song_data['current_version'] = version_id
        song_data['last_updated'] = datetime.now().isoformat()
        self.index['total_versions'] += 1
        self._save_index()
        
        return {
            'is_duplicate': False,
            'version_id': version_id,
            'version_file': str(version_file),
            'version_data': version_data,
            'message': f"版本 {version_id} 已保存",
        }
    
    def _extract_summary(self, check_result: Dict) -> Dict:
        summary = {}
        
        if 'word_count' in check_result:
            wc = check_result['word_count'].get('summary', {})
            summary['total_chinese_chars'] = wc.get('total_chinese_chars', 0)
            summary['total_lines'] = wc.get('total_lines', 0)
        
        if 'rhyme' in check_result:
            rhyme = check_result['rhyme']
            if 'scheme_check' in rhyme:
                sc = rhyme['scheme_check'].get('summary', {})
                summary['rhyme_issues'] = sc.get('issues_count', 0)
        
        if 'all_issues' in check_result:
            summary['total_issues'] = len(check_result['all_issues'])
            summary['error_count'] = sum(1 for i in check_result['all_issues'] if i.get('severity') == 'error')
            summary['warning_count'] = sum(1 for i in check_result['all_issues'] if i.get('severity') == 'warning')
        
        return summary
    
    def get_version(self, song_title: str, version_id: Optional[str] = None) -> Optional[Dict]:
        if song_title not in self.index['songs']:
            return None
        
        song_data = self.index['songs'][song_title]
        
        if version_id is None:
            version_id = song_data.get('current_version')
        
        version_info = next((v for v in song_data['versions'] if v['version_id'] == version_id), None)
        if not version_info:
            return None
        
        version_file = self.storage_dir / f"{song_title}_{version_id}.json"
        if version_file.exists():
            with open(version_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        
        return None
    
    def list_versions(self, song_title: str) -> List[Dict]:
        if song_title not in self.index['songs']:
            return []
        
        versions = self.index['songs'][song_title]['versions']
        return sorted(versions, key=lambda x: x['created_at'], reverse=True)
    
    def list_songs(self) -> List[Dict]:
        songs = []
        for title, data in self.index['songs'].items():
            songs.append({
                'title': title,
                'author': data.get('author', '未知'),
                'version_count': len(data.get('versions', [])),
                'current_version': data.get('current_version'),
                'created_at': data.get('created_at'),
                'last_updated': data.get('last_updated'),
            })
        return sorted(songs, key=lambda x: x.get('last_updated', ''), reverse=True)
    
    def compare_versions(self, song_title: str, 
                         version_id1: str, 
                         version_id2: str) -> Dict:
        v1 = self.get_version(song_title, version_id1)
        v2 = self.get_version(song_title, version_id2)
        
        if not v1 or not v2:
            return {'error': '版本不存在'}
        
        lines1 = v1['lyrics_text'].split('\n')
        lines2 = v2['lyrics_text'].split('\n')
        
        changes = []
        max_len = max(len(lines1), len(lines2))
        
        for i in range(max_len):
            l1 = lines1[i] if i < len(lines1) else None
            l2 = lines2[i] if i < len(lines2) else None
            
            if l1 != l2:
                change_type = 'modified'
                if l1 is None:
                    change_type = 'added'
                elif l2 is None:
                    change_type = 'deleted'
                
                changes.append({
                    'line_index': i,
                    'type': change_type,
                    'old': l1,
                    'new': l2,
                })
        
        summary1 = v1.get('version_info', {}).get('check_result_summary', {})
        summary2 = v2.get('version_info', {}).get('check_result_summary', {})
        
        return {
            'song_title': song_title,
            'versions': [version_id1, version_id2],
            'line_changes': changes,
            'total_changes': len(changes),
            'check_result_diff': {
                'issues_change': summary2.get('total_issues', 0) - summary1.get('total_issues', 0),
                'chars_change': len(lines2) - len(lines1),
            },
        }
    
    def delete_version(self, song_title: str, version_id: str) -> bool:
        if song_title not in self.index['songs']:
            return False
        
        song_data = self.index['songs'][song_title]
        versions = song_data['versions']
        
        version_info = next((v for v in versions if v['version_id'] == version_id), None)
        if not version_info:
            return False
        
        versions.remove(version_info)
        song_data['versions'] = versions
        
        if song_data.get('current_version') == version_id:
            if versions:
                song_data['current_version'] = versions[-1]['version_id']
            else:
                song_data['current_version'] = None
        
        version_file = self.storage_dir / f"{song_title}_{version_id}.json"
        if version_file.exists():
            version_file.unlink()
        
        self.index['total_versions'] -= 1
        self._save_index()
        
        return True

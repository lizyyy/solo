#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文件修改历史追踪模块
功能：记录和追踪文件的人工修改，确保运行账本和明细一致
"""

import os
import json
import difflib
import hashlib
from datetime import datetime
from pathlib import Path


class ChangeHistory:
    def __init__(self, base_path):
        self.base_path = os.path.abspath(base_path)
        self.history_dir = os.path.join(self.base_path, '.log_doctor_history')
        self.history_file = os.path.join(self.history_dir, 'change_records.json')
        self._init_history()
        
    def _init_history(self):
        """初始化历史记录目录"""
        if not os.path.exists(self.history_dir):
            os.makedirs(self.history_dir)
        
        if not os.path.exists(self.history_file):
            with open(self.history_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'created': datetime.now().isoformat(),
                    'files': {}
                }, f, ensure_ascii=False, indent=2)
    
    def _load_history(self):
        """加载历史记录"""
        try:
            with open(self.history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return {'created': datetime.now().isoformat(), 'files': {}}
    
    def _save_history(self, history):
        """保存历史记录"""
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    
    def _calc_file_hash(self, filepath):
        """计算文件内容哈希"""
        hasher = hashlib.sha256()
        try:
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(8192), b''):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except:
            return None
    
    def record_change(self, filepath, change_type='auto', comment=''):
        """记录文件变更"""
        abs_path = os.path.abspath(filepath)
        rel_path = os.path.relpath(abs_path, self.base_path)
        
        if not os.path.exists(abs_path):
            return None
        
        file_hash = self._calc_file_hash(abs_path)
        file_size = os.path.getsize(abs_path)
        file_mtime = os.path.getmtime(abs_path)
        
        history = self._load_history()
        
        if rel_path not in history['files']:
            history['files'][rel_path] = {
                'first_seen': datetime.now().isoformat(),
                'versions': []
            }
        
        versions = history['files'][rel_path]['versions']
        
        if versions and versions[-1]['hash'] == file_hash:
            return None
        
        version_info = {
            'version': len(versions) + 1,
            'hash': file_hash,
            'size': file_size,
            'mtime': self._format_mtime(file_mtime),
            'recorded': datetime.now().isoformat(),
            'change_type': change_type,
            'comment': comment
        }
        
        if versions:
            old_content = self._get_version_content(rel_path, len(versions) - 1)
            new_content = self._read_file_safely(abs_path)
            diff = self._generate_diff(old_content, new_content)
            version_info['diff'] = diff
            version_info['change_summary'] = self._summarize_diff(diff)
        
        versions.append(version_info)
        
        backup_file = os.path.join(self.history_dir, f"{rel_path.replace('/', '_')}.v{len(versions)}.bak")
        os.makedirs(os.path.dirname(backup_file), exist_ok=True)
        try:
            with open(abs_path, 'rb') as src, open(backup_file, 'wb') as dst:
                dst.write(src.read())
            version_info['backup_file'] = os.path.relpath(backup_file, self.history_dir)
        except:
            pass
        
        self._save_history(history)
        return version_info
    
    def _read_file_safely(self, filepath):
        """安全读取文件内容"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.readlines()
        except UnicodeDecodeError:
            try:
                with open(filepath, 'r', encoding='gbk') as f:
                    return f.readlines()
            except:
                return []
        except:
            return []
    
    def _get_version_content(self, rel_path, version_index):
        """获取指定版本的文件内容"""
        history = self._load_history()
        if rel_path not in history['files']:
            return []
        
        versions = history['files'][rel_path]['versions']
        if version_index < 0 or version_index >= len(versions):
            return []
        
        version = versions[version_index]
        if 'backup_file' in version:
            backup_file = os.path.join(self.history_dir, version['backup_file'])
            return self._read_file_safely(backup_file)
        
        return []
    
    def _generate_diff(self, old_lines, new_lines):
        """生成差异内容"""
        differ = difflib.Differ()
        diff = list(differ.compare(old_lines, new_lines))
        
        changes = []
        for i, line in enumerate(diff):
            if line.startswith('+ '):
                changes.append({'type': 'add', 'content': line[2:].rstrip()})
            elif line.startswith('- '):
                changes.append({'type': 'remove', 'content': line[2:].rstrip()})
            elif line.startswith('? '):
                continue
        
        return changes[:100]
    
    def _summarize_diff(self, diff):
        """总结差异变化"""
        adds = sum(1 for d in diff if d['type'] == 'add')
        removes = sum(1 for d in diff if d['type'] == 'remove')
        
        summary = []
        if adds > 0:
            summary.append(f"新增 {adds} 行")
        if removes > 0:
            summary.append(f"删除 {removes} 行")
        
        return ', '.join(summary) if summary else "无变化"
    
    def get_history(self, filename):
        """获取文件的修改历史"""
        history = self._load_history()
        
        results = []
        for rel_path, file_info in history['files'].items():
            if os.path.basename(rel_path) == filename or rel_path == filename:
                results.append({
                    'file': rel_path,
                    'first_seen': file_info['first_seen'],
                    'versions': file_info['versions']
                })
        
        return results
    
    def get_all_changes(self):
        """获取所有文件变更记录"""
        history = self._load_history()
        all_changes = []
        
        for rel_path, file_info in history['files'].items():
            for version in file_info['versions']:
                all_changes.append({
                    'file': rel_path,
                    'version': version['version'],
                    'timestamp': version['recorded'],
                    'change_type': version.get('change_type', 'unknown'),
                    'summary': version.get('change_summary', ''),
                    'comment': version.get('comment', '')
                })
        
        all_changes.sort(key=lambda x: x['timestamp'])
        return all_changes
    
    def detect_manual_changes(self, filepath):
        """检测文件是否被人工修改"""
        abs_path = os.path.abspath(filepath)
        rel_path = os.path.relpath(abs_path, self.base_path)
        
        history = self._load_history()
        
        if rel_path not in history['files']:
            return {
                'has_changes': False,
                'message': '该文件尚无历史记录'
            }
        
        versions = history['files'][rel_path]['versions']
        current_hash = self._calc_file_hash(abs_path)
        
        if versions[-1]['hash'] != current_hash:
            return {
                'has_changes': True,
                'message': '文件内容与上次记录不一致，可能被人工修改过',
                'last_recorded': versions[-1]['recorded']
            }
        
        manual_versions = [v for v in versions if v.get('change_type') == 'manual']
        
        return {
            'has_changes': len(manual_versions) > 0,
            'manual_change_count': len(manual_versions),
            'manual_versions': manual_versions
        }
    
    def _format_mtime(self, timestamp):
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    
    def print_history(self, records):
        """打印历史记录"""
        if not records:
            print("  未找到历史记录")
            return
        
        for file_history in records:
            print(f"\n📄 文件: {file_history['file']}")
            print(f"  首次记录: {file_history['first_seen']}")
            print(f"  版本数: {len(file_history['versions'])}")
            
            for version in file_history['versions']:
                change_marker = '👤' if version.get('change_type') == 'manual' else '🔧'
                print(f"\n  {change_marker} 版本 {version['version']} ({version['recorded']})")
                print(f"     变化类型: {'人工修改' if version.get('change_type') == 'manual' else '自动记录'}")
                print(f"     变化摘要: {version.get('change_summary', '无')}")
                
                if version.get('comment'):
                    print(f"     备注: {version['comment']}")
                
                if 'diff' in version and version['diff']:
                    print(f"     详细变化:")
                    for change in version['diff'][:10]:
                        if change['type'] == 'add':
                            print(f"       + {change['content'][:60]}")
                        else:
                            print(f"       - {change['content'][:60]}")
                    if len(version['diff']) > 10:
                        print(f"       ... 还有 {len(version['diff']) - 10} 处变化")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
目录快照模块
功能：拍摄目录快照，检测空格路径，记录文件元信息
"""

import os
import json
from datetime import datetime
from pathlib import Path


class DirectorySnapshot:
    def __init__(self, base_path):
        self.base_path = os.path.abspath(base_path)
        self.space_path_warnings = []
        
    def take(self):
        """拍摄目录快照"""
        result = {
            'snapshot_time': datetime.now().isoformat(),
            'base_path': self.base_path,
            'summary': {
                'total_files': 0,
                'total_dirs': 0,
                'total_size': 0,
                'space_path_count': 0
            },
            'files': [],
            'directories': [],
            'space_path_warnings': []
        }
        
        for root, dirs, files in os.walk(self.base_path):
            for d in dirs:
                dir_path = os.path.join(root, d)
                rel_path = os.path.relpath(dir_path, self.base_path)
                
                dir_info = {
                    'path': rel_path,
                    'full_path': dir_path,
                    'has_space': ' ' in rel_path,
                    'modified': self._get_mtime(dir_path)
                }
                
                result['directories'].append(dir_info)
                result['summary']['total_dirs'] += 1
                
                if ' ' in rel_path:
                    result['summary']['space_path_count'] += 1
                    result['space_path_warnings'].append({
                        'type': 'directory',
                        'path': rel_path,
                        'source': '目录快照',
                        'message': f"目录名包含空格，可能导致脚本执行异常",
                        'action': "请联系目录创建者重命名，或在脚本中用引号包裹路径"
                    })
            
            for f in files:
                file_path = os.path.join(root, f)
                rel_path = os.path.relpath(file_path, self.base_path)
                
                try:
                    stat = os.stat(file_path)
                    file_size = stat.st_size
                    mtime = stat.st_mtime
                except (OSError, PermissionError):
                    file_size = 0
                    mtime = 0
                
                file_info = {
                    'path': rel_path,
                    'full_path': file_path,
                    'size': file_size,
                    'size_human': self._human_size(file_size),
                    'modified': self._format_mtime(mtime),
                    'has_space': ' ' in rel_path,
                    'extension': os.path.splitext(f)[1].lower()
                }
                
                result['files'].append(file_info)
                result['summary']['total_files'] += 1
                result['summary']['total_size'] += file_size
                
                if ' ' in rel_path:
                    result['summary']['space_path_count'] += 1
                    result['space_path_warnings'].append({
                        'type': 'file',
                        'path': rel_path,
                        'source': '目录快照',
                        'message': f"文件名包含空格，可能导致脚本执行异常",
                        'action': "请联系文件上传者重命名，或在脚本中用引号包裹路径"
                    })
        
        result['summary']['total_size_human'] = self._human_size(result['summary']['total_size'])
        result['files'].sort(key=lambda x: x['path'])
        result['directories'].sort(key=lambda x: x['path'])
        
        return result
    
    def _get_mtime(self, path):
        try:
            return self._format_mtime(os.path.getmtime(path))
        except (OSError, PermissionError):
            return '未知'
    
    def _format_mtime(self, timestamp):
        if timestamp == 0:
            return '未知'
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    
    def _human_size(self, size_bytes):
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} PB"
    
    def print_result(self, result):
        """打印快照结果"""
        print("\n" + "="*60)
        print("📸 目录快照结果")
        print("="*60)
        print(f"快照时间: {result['snapshot_time']}")
        print(f"目标路径: {result['base_path']}")
        print(f"文件总数: {result['summary']['total_files']}")
        print(f"目录总数: {result['summary']['total_dirs']}")
        print(f"总大小: {result['summary']['total_size_human']}")
        print(f"含空格路径: {result['summary']['space_path_count']} 个")
        print("-"*60)
        
        if result['space_path_warnings']:
            print("\n⚠️  空格路径警告:")
            for warn in result['space_path_warnings']:
                print(f"  [{warn['type']}] {warn['path']}")
                print(f"     来源: {warn['source']}")
                print(f"     说明: {warn['message']}")
                print(f"     建议: {warn['action']}")
                print()
        
        print(f"\n文件列表 (共 {len(result['files'])} 个):")
        for f in result['files'][:30]:
            space_mark = ' ⚠️' if f['has_space'] else ''
            print(f"  [{f['modified']}] {f['size_human']:>8}  {f['path']}{space_mark}")
        
        if len(result['files']) > 30:
            print(f"  ... 还有 {len(result['files']) - 30} 个文件")
    
    def save(self, result, output_dir):
        """保存快照结果"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"snapshot_{timestamp}.json"
        filepath = os.path.join(output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 快照已保存到: {filepath}")

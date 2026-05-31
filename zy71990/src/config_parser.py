#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置文件解析模块
功能：解析常见配置文件，检测空格路径配置
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path


class ConfigParser:
    def __init__(self, base_path, config_path=None):
        self.base_path = os.path.abspath(base_path)
        self.config_path = config_path
        self.space_path_warnings = []
        
    def find_config_files(self):
        """查找目录中的配置文件"""
        config_files = []
        config_extensions = ['.ini', '.conf', '.cfg', '.yaml', '.yml', '.json', '.properties']
        
        for root, dirs, files in os.walk(self.base_path):
            for f in files:
                ext = os.path.splitext(f)[1].lower()
                if ext in config_extensions:
                    file_path = os.path.join(root, f)
                    rel_path = os.path.relpath(file_path, self.base_path)
                    config_files.append({
                        'path': rel_path,
                        'full_path': file_path,
                        'type': ext.lstrip('.'),
                        'size': os.path.getsize(file_path),
                        'modified': self._format_mtime(os.path.getmtime(file_path))
                    })
        
        if self.config_path and os.path.isfile(self.config_path):
            config_files.append({
                'path': os.path.basename(self.config_path),
                'full_path': os.path.abspath(self.config_path),
                'type': os.path.splitext(self.config_path)[1].lower().lstrip('.'),
                'size': os.path.getsize(self.config_path),
                'modified': self._format_mtime(os.path.getmtime(self.config_path))
            })
        
        return config_files
    
    def parse(self, config_file):
        """解析单个配置文件"""
        result = {
            'file': config_file,
            'parsed_time': datetime.now().isoformat(),
            'sections': {},
            'path_settings': [],
            'space_path_warnings': [],
            'parse_errors': []
        }
        
        try:
            if config_file['type'] in ['ini', 'conf', 'cfg', 'properties']:
                result.update(self._parse_ini(config_file['full_path']))
            elif config_file['type'] in ['yaml', 'yml']:
                result.update(self._parse_yaml(config_file['full_path']))
            elif config_file['type'] == 'json':
                result.update(self._parse_json(config_file['full_path']))
        except Exception as e:
            result['parse_errors'].append(f"解析失败: {str(e)}")
        
        result['space_path_warnings'] = self._check_space_paths(result['path_settings'])
        
        return result
    
    def _parse_ini(self, filepath):
        """解析INI格式配置文件"""
        result = {
            'sections': {},
            'path_settings': []
        }
        
        current_section = 'default'
        result['sections'][current_section] = {}
        
        path_keywords = ['path', 'dir', 'directory', 'folder', 'file', 'log', 'data']
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                if not line or line.startswith(('#', ';')):
                    continue
                
                if line.startswith('[') and line.endswith(']'):
                    current_section = line[1:-1]
                    result['sections'][current_section] = {}
                    continue
                
                if '=' in line or ':' in line:
                    sep = '=' if '=' in line else ':'
                    key, value = line.split(sep, 1)
                    key = key.strip()
                    value = value.strip().strip('"\'')
                    
                    result['sections'][current_section][key] = value
                    
                    if any(kw in key.lower() for kw in path_keywords):
                        result['path_settings'].append({
                            'key': key,
                            'value': value,
                            'section': current_section,
                            'line': line_num,
                            'source': f"配置文件: {os.path.basename(filepath)}"
                        })
        except UnicodeDecodeError:
            with open(filepath, 'r', encoding='gbk') as f:
                return self._parse_ini(filepath)
        
        return result
    
    def _parse_yaml(self, filepath):
        """解析YAML格式配置文件"""
        result = {
            'sections': {},
            'path_settings': []
        }
        
        path_keywords = ['path', 'dir', 'directory', 'folder', 'file', 'log', 'data']
        
        try:
            import yaml
            with open(filepath, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            
            if data:
                result['sections']['root'] = data
                self._extract_paths(data, '', path_keywords, result['path_settings'], 
                                  f"配置文件: {os.path.basename(filepath)}")
        except ImportError:
            result['sections']['warning'] = "未安装PyYAML，无法解析YAML文件"
        except Exception as e:
            result['sections']['error'] = f"解析失败: {str(e)}"
        
        return result
    
    def _parse_json(self, filepath):
        """解析JSON格式配置文件"""
        result = {
            'sections': {},
            'path_settings': []
        }
        
        path_keywords = ['path', 'dir', 'directory', 'folder', 'file', 'log', 'data']
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            result['sections']['root'] = data
            self._extract_paths(data, '', path_keywords, result['path_settings'],
                              f"配置文件: {os.path.basename(filepath)}")
        except Exception as e:
            result['sections']['error'] = f"解析失败: {str(e)}"
        
        return result
    
    def _extract_paths(self, data, prefix, keywords, path_settings, source):
        """递归提取路径配置"""
        if isinstance(data, dict):
            for key, value in data.items():
                current_key = f"{prefix}.{key}" if prefix else key
                if isinstance(value, str) and any(kw in key.lower() for kw in keywords):
                    path_settings.append({
                        'key': current_key,
                        'value': value,
                        'section': prefix or 'root',
                        'line': 0,
                        'source': source
                    })
                if isinstance(value, (dict, list)):
                    self._extract_paths(value, current_key, keywords, path_settings, source)
        elif isinstance(data, list):
            for i, item in enumerate(data):
                if isinstance(item, (dict, list)):
                    self._extract_paths(item, f"{prefix}[{i}]", keywords, path_settings, source)
    
    def _check_space_paths(self, path_settings):
        """检查路径配置中的空格"""
        warnings = []
        for setting in path_settings:
            path_value = setting['value']
            if ' ' in path_value and not path_value.startswith(('"', "'")):
                warnings.append({
                    'type': 'config_path',
                    'key': setting['key'],
                    'value': path_value,
                    'section': setting['section'],
                    'source': setting['source'],
                    'message': "配置的路径包含空格但未用引号包裹，程序读取时可能被截断",
                    'action': "请联系应用负责人修改配置，给路径加上引号"
                })
        return warnings
    
    def _format_mtime(self, timestamp):
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
    
    def parse_all(self):
        """解析所有配置文件"""
        config_files = self.find_config_files()
        results = []
        all_warnings = []
        
        for config_file in config_files:
            parsed = self.parse(config_file)
            results.append(parsed)
            all_warnings.extend(parsed['space_path_warnings'])
        
        return {
            'config_count': len(config_files),
            'config_files': config_files,
            'results': results,
            'space_path_warnings': all_warnings
        }

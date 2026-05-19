import json
import os
from typing import Dict, Any
import yaml

class FileLoader:
    @staticmethod
    def load_file(file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext in ['.json']:
            return FileLoader._load_json(file_path)
        elif ext in ['.yaml', '.yml']:
            return FileLoader._load_yaml(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
    
    @staticmethod
    def _load_json(file_path: str) -> Dict[str, Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    @staticmethod
    def _load_yaml(file_path: str) -> Dict[str, Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    @staticmethod
    def load_directory(dir_path: str, pattern: str = None) -> Dict[str, Dict[str, Any]]:
        if not os.path.isdir(dir_path):
            raise NotADirectoryError(f"目录不存在: {dir_path}")
        
        translations = {}
        
        for filename in os.listdir(dir_path):
            file_path = os.path.join(dir_path, filename)
            if os.path.isfile(file_path):
                name, ext = os.path.splitext(filename)
                if ext.lower() in ['.json', '.yaml', '.yml']:
                    try:
                        data = FileLoader.load_file(file_path)
                        translations[name] = data
                    except Exception as e:
                        print(f"警告: 加载文件 {filename} 失败: {e}")
        
        return translations

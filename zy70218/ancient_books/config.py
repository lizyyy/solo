import os
from pathlib import Path


class Config:
    def __init__(self):
        self.work_dir = Path.cwd()
        self.db_path = self.work_dir / "page_checker.db"
        self.default_scan_dir = self.work_dir / "scans"
        
        self.page_patterns = [
            r'^[vV](?P<volume>\d+)[_-][pP](?P<page>\d+)\.(?P<ext>\w+)$',
            r'^(?P<volume>\d+)[-_](?P<page>\d+)\.(?P<ext>\w+)$',
            r'^卷(?P<volume>\d+)[-_]页(?P<page>\d+)\.(?P<ext>\w+)$',
            r'^卷(?P<volume>\d+)第(?P<page>\d+)页\.(?P<ext>\w+)$',
        ]
        
        self.supported_extensions = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'}
    
    def get_db_path(self):
        return str(self.db_path)
    
    def set_db_path(self, path):
        self.db_path = Path(path)
    
    def get_default_scan_dir(self):
        return str(self.default_scan_dir)

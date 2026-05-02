import os
import sys

class Config:
    APP_NAME = "扫描交付质检台"
    APP_VERSION = "1.0.0"
    
    DEFAULT_MIN_RESOLUTION = 300
    DEFAULT_BLANK_PAGE_THRESHOLD = 0.95
    DEFAULT_SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.tiff', '.tif', '.pdf'}
    
    REVIEW_STATUSES = {
        'pending': '待审核',
        'confirmed': '确认无误',
        'rescan': '需要重扫',
        'replaced': '已替换',
        'ignored': '忽略并备注'
    }
    
    ISSUE_TYPES = {
        'missing_page': '缺页',
        'duplicate_page': '重复页码',
        'filename_mismatch': '文件名不匹配',
        'low_resolution': '分辨率过低',
        'blank_page': '疑似空白页',
        'orientation_mismatch': '横竖方向不一致',
        'index_missing_file': '索引有但文件缺失',
        'extra_file': '文件夹有但未登记',
        'box_mismatch': '盒号不匹配',
        'case_mismatch': '案卷号不匹配'
    }
    
    @classmethod
    def get_app_data_dir(cls):
        if sys.platform == 'win32':
            app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
            return os.path.join(app_data, 'ScanQualityChecker')
        elif sys.platform == 'darwin':
            return os.path.join(os.path.expanduser('~'), 'Library', 'Application Support', 'ScanQualityChecker')
        else:
            return os.path.join(os.path.expanduser('~'), '.scan_quality_checker')
    
    @classmethod
    def get_db_path(cls, project_id=None):
        app_data_dir = cls.get_app_data_dir()
        os.makedirs(app_data_dir, exist_ok=True)
        if project_id:
            return os.path.join(app_data_dir, f'project_{project_id}.db')
        return os.path.join(app_data_dir, 'projects.db')

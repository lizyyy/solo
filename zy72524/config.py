import os
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-key-change-in-production'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        f'sqlite:///{os.path.join(BASE_DIR, "review_system.db")}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    LOW_CONFIDENCE_THRESHOLD = 0.7
    
    REVIEW_WORKFLOW_STEPS = [
        'step1_import',
        'step2_review_prompt',
        'step3_model_update'
    ]
    
    ROLES = {
        'annotator': '标注人员',
        'lead_annotator': '标注负责人',
        'kb_editor': '知识库编辑',
        'reviewer': '复核人员'
    }
    
    SAMPLE_STATUS = {
        'pending': '待处理',
        'low_confidence': '低置信度-待复核',
        'normal': '正常',
        'false_negative': '漏检',
        'false_positive': '误检',
        'rolled_back': '已回滚'
    }

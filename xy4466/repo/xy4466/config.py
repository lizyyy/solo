import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'stamp-room-secret-key-2026'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'stamp_room.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # 风险规则配置
    RISK_RULES = {
        # 高风险文件类型
        'high_risk_documents': [
            '担保合同',
            '贷款合同',
            '股权转让协议',
            '重大资产处置',
            '融资协议',
            '抵押合同'
        ],
        # 逾期天数阈值
        'overdue_days_threshold': 0,
        # 风险阈值
        'high_risk_threshold': 70,
        'medium_risk_threshold': 30,
        # 风险分值配置
        'risk_scores': {
            'unauthorized': 50,
            'overdue_loan': 40,
            'stamp_unavailable': 25,
            'high_risk_document': 20,
            'active_loan': 15
        }
    }

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get('TEST_DB') or os.path.join(BASE_DIR, 'accompaniment_rework.db')

ROLES = {
    'TOUR_COORDINATOR': 'tour_coordinator',
    'MUSIC_TEACHER': 'music_teacher',
    'ADMIN': 'admin'
}

STATUS = {
    'PENDING': 'pending',
    'LEAVE_MARKED': 'leave_marked',
    'AUTH_MISSING': 'auth_missing',
    'AUTH_COMPLETED': 'auth_completed',
    'PENDING_REVIEW': 'pending_review',
    'COMPLETED': 'completed'
}

STATUS_LABELS = {
    'pending': '待处理',
    'leave_marked': '请假课时异常',
    'auth_missing': '缺授权期限页',
    'auth_completed': '已补授权',
    'pending_review': '待巡演统筹复核',
    'completed': '已完成'
}

NEXT_OWNER = {
    'tour_coordinator': '巡演统筹',
    'music_teacher': '音乐老师许老师'
}

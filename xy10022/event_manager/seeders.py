from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from .models import User, UserRole, Event, EventStatus, Registration, RegistrationStatus
from .utils import hash_password

def seed_users(db: Session) -> int:
    users = [
        {
            'username': 'admin',
            'password': 'admin123',
            'email': 'admin@example.com',
            'full_name': '系统管理员',
            'role': UserRole.ADMIN
        },
        {
            'username': 'organizer',
            'password': 'organizer123',
            'email': 'organizer@example.com',
            'full_name': '活动组织者',
            'role': UserRole.ORGANIZER
        },
        {
            'username': 'volunteer',
            'password': 'volunteer123',
            'email': 'volunteer@example.com',
            'full_name': '志愿者小王',
            'role': UserRole.VOLUNTEER
        },
        {
            'username': 'alice',
            'password': 'alice123',
            'email': 'alice@example.com',
            'full_name': '爱丽丝',
            'role': UserRole.VOLUNTEER
        },
        {
            'username': 'bob',
            'password': 'bob123',
            'email': 'bob@example.com',
            'full_name': '鲍勃',
            'role': UserRole.VOLUNTEER
        }
    ]
    
    count = 0
    for user_data in users:
        existing = db.query(User).filter(User.username == user_data['username']).first()
        if not existing:
            user = User(
                username=user_data['username'],
                password_hash=hash_password(user_data['password']),
                email=user_data['email'],
                full_name=user_data['full_name'],
                role=user_data['role']
            )
            db.add(user)
            count += 1
    
    db.commit()
    return count

def seed_events(db: Session) -> int:
    users = db.query(User).all()
    user_map = {u.username: u for u in users}
    
    events = [
        {
            'title': '2024年度技术峰会',
            'description': '年度技术交流大会，邀请业内专家分享最新技术趋势',
            'location': '北京国际会议中心',
            'start_time': datetime.now() + timedelta(days=30),
            'end_time': datetime.now() + timedelta(days=30, hours=8),
            'max_participants': 200,
            'status': EventStatus.PUBLISHED,
            'created_by': user_map.get('organizer')
        },
        {
            'title': '春季户外徒步活动',
            'description': '周末户外徒步，体验大自然的美好',
            'location': '北京香山公园',
            'start_time': datetime.now() + timedelta(days=7),
            'end_time': datetime.now() + timedelta(days=7, hours=5),
            'max_participants': 30,
            'status': EventStatus.PUBLISHED,
            'created_by': user_map.get('organizer')
        },
        {
            'title': 'Python编程入门工作坊',
            'description': '零基础Python编程入门，适合初学者',
            'location': '中关村创业大厦',
            'start_time': datetime.now() + timedelta(days=14),
            'end_time': datetime.now() + timedelta(days=14, hours=4),
            'max_participants': 20,
            'status': EventStatus.DRAFT,
            'created_by': user_map.get('organizer')
        },
        {
            'title': '往期社区分享会',
            'description': '2024年1月的社区分享会记录',
            'location': '线上会议',
            'start_time': datetime.now() - timedelta(days=90),
            'end_time': datetime.now() - timedelta(days=90, hours=3),
            'max_participants': 100,
            'status': EventStatus.COMPLETED,
            'created_by': user_map.get('organizer')
        },
        {
            'title': '取消的测试活动',
            'description': '这是一个已取消的活动',
            'location': '待定',
            'start_time': datetime.now() + timedelta(days=60),
            'end_time': datetime.now() + timedelta(days=60, hours=2),
            'max_participants': 50,
            'status': EventStatus.CANCELLED,
            'created_by': user_map.get('admin')
        }
    ]
    
    count = 0
    for event_data in events:
        if not event_data['created_by']:
            continue
        
        existing = db.query(Event).filter(
            Event.title == event_data['title'],
            Event.created_by == event_data['created_by'].id
        ).first()
        
        if not existing:
            event = Event(
                title=event_data['title'],
                description=event_data['description'],
                location=event_data['location'],
                start_time=event_data['start_time'],
                end_time=event_data['end_time'],
                max_participants=event_data['max_participants'],
                status=event_data['status'],
                created_by=event_data['created_by'].id
            )
            db.add(event)
            count += 1
    
    db.commit()
    return count

def seed_registrations(db: Session) -> int:
    events = db.query(Event).all()
    users = db.query(User).all()
    
    registrations_data = []
    
    if events and users:
        tech_event = next((e for e in events if '技术峰会' in e.title), None)
        hike_event = next((e for e in events if '徒步' in e.title), None)
        workshop_event = next((e for e in events if '工作坊' in e.title), None)
        past_event = next((e for e in events if '往期' in e.title), None)
        
        volunteers = [u for u in users if u.role == UserRole.VOLUNTEER]
        
        participants = [
            {'name': '张三', 'email': 'zhangsan@example.com', 'phone': '13800138001'},
            {'name': '李四', 'email': 'lisi@example.com', 'phone': '13800138002'},
            {'name': '王五', 'email': 'wangwu@example.com', 'phone': '13800138003'},
            {'name': '赵六', 'email': 'zhaoliu@example.com', 'phone': '13800138004'},
            {'name': '陈七', 'email': 'chenqi@example.com', 'phone': '13800138005'},
            {'name': '周八', 'email': 'zhouba@example.com', 'phone': '13800138006'},
            {'name': '吴九', 'email': 'wujiu@example.com', 'phone': '13800138007'},
            {'name': '郑十', 'email': 'zhengshi@example.com', 'phone': '13800138008'},
            {'name': '钱一', 'email': 'qianyi@example.com', 'phone': '13800138009'},
            {'name': '孙二', 'email': 'suner@example.com', 'phone': '13800138010'},
        ]
        
        if tech_event:
            for idx, p in enumerate(participants[:5]):
                registrations_data.append({
                    'event': tech_event,
                    'user': volunteers[idx % len(volunteers)],
                    'participant': p,
                    'status': RegistrationStatus.CONFIRMED if idx < 3 else RegistrationStatus.PENDING,
                    'notes': '通过网站报名' if idx < 3 else '通过邮件报名'
                })
        
        if hike_event:
            for idx, p in enumerate(participants[3:7]):
                registrations_data.append({
                    'event': hike_event,
                    'user': volunteers[(idx + 1) % len(volunteers)],
                    'participant': p,
                    'status': RegistrationStatus.CONFIRMED if idx < 2 else RegistrationStatus.PENDING,
                    'notes': '团体报名'
                })
        
        if past_event:
            for idx, p in enumerate(participants[5:8]):
                registrations_data.append({
                    'event': past_event,
                    'user': volunteers[(idx + 2) % len(volunteers)],
                    'participant': p,
                    'status': RegistrationStatus.COMPLETED,
                    'notes': '已参加活动'
                })
        
        registrations_data.append({
            'event': hike_event,
            'user': volunteers[0],
            'participant': participants[8],
            'status': RegistrationStatus.CANCELLED,
            'notes': '临时有事取消'
        })
    
    count = 0
    for reg_data in registrations_data:
        existing = db.query(Registration).filter(
            Registration.event_id == reg_data['event'].id,
            Registration.participant_email == reg_data['participant']['email']
        ).first()
        
        if not existing:
            registration = Registration(
                event_id=reg_data['event'].id,
                user_id=reg_data['user'].id,
                participant_name=reg_data['participant']['name'],
                participant_email=reg_data['participant']['email'],
                participant_phone=reg_data['participant']['phone'],
                status=reg_data['status'],
                notes=reg_data['notes']
            )
            db.add(registration)
            count += 1
    
    db.commit()
    return count

def seed_all(db: Session) -> dict:
    user_count = seed_users(db)
    event_count = seed_events(db)
    registration_count = seed_registrations(db)
    
    return {
        '用户': user_count,
        '活动': event_count,
        '报名': registration_count
    }

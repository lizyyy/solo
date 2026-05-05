from app import create_app, db
from app.models import Room, Member, Reservation, AuditLog

app = create_app()
with app.app_context():
    db.create_all()
    print('Database tables created successfully!')
    
    room1 = Room(
        name='钢琴房 A1',
        description='雅马哈三角钢琴',
        capacity=1,
        equipment='三角钢琴,乐谱架'
    )
    room2 = Room(
        name='小提琴房 B2',
        description='专业练琴房',
        capacity=2,
        equipment='乐谱架,座椅'
    )
    db.session.add_all([room1, room2])
    
    member1 = Member(
        name='张三',
        phone='13800138001',
        member_level='普通会员',
        remaining_times=10
    )
    member2 = Member(
        name='李四',
        phone='13800138002',
        member_level='VIP会员',
        remaining_times=20
    )
    db.session.add_all([member1, member2])
    
    db.session.commit()
    print('Test data created successfully!')
    print(f'Rooms: {Room.query.count()}')
    print(f'Members: {Member.query.count()}')

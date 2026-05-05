from app import create_app, db
from app.models import Room, Member, Reservation, AuditLog

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'Room': Room,
        'Member': Member,
        'Reservation': Reservation,
        'AuditLog': AuditLog
    }

@app.cli.command("init-db")
def init_db():
    db.create_all()
    print("Database initialized.")

@app.cli.command("seed-db")
def seed_db():
    from datetime import datetime, timedelta
    
    room1 = Room(
        name="钢琴房 A1",
        description="雅马哈三角钢琴",
        capacity=1,
        equipment="三角钢琴,乐谱架"
    )
    room2 = Room(
        name="小提琴房 B2",
        description="专业练琴房",
        capacity=2,
        equipment="乐谱架,座椅"
    )
    db.session.add_all([room1, room2])
    
    member1 = Member(
        name="张三",
        phone="13800138001",
        member_level="普通会员",
        remaining_times=10
    )
    member2 = Member(
        name="李四",
        phone="13800138002",
        member_level="VIP会员",
        remaining_times=20
    )
    db.session.add_all([member1, member2])
    
    db.session.commit()
    print("Database seeded with test data.")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)

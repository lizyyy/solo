from app import app, db
from models import PumpRoom, Staff

def init_data():
    with app.app_context():
        print('开始初始化数据...')
        
        if PumpRoom.query.count() == 0:
            pump_rooms = [
                PumpRoom(name='1号地下泵房', location='B1层东区'),
                PumpRoom(name='2号地下泵房', location='B1层西区'),
                PumpRoom(name='3号地下泵房', location='B2层南区')
            ]
            db.session.add_all(pump_rooms)
            print('已添加3个泵房')
        
        if Staff.query.count() == 0:
            staff = [
                Staff(name='张维修', phone='13800138001', role='维修工程师'),
                Staff(name='李维修', phone='13800138002', role='维修工程师'),
                Staff(name='王调度', phone='13800138003', role='调度员')
            ]
            db.session.add_all(staff)
            print('已添加3名工作人员')
        
        db.session.commit()
        print('数据初始化完成！')

if __name__ == '__main__':
    init_data()

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("1. 测试导入 extensions...")
from extensions import db
print("   ✓ extensions 导入成功")

print("2. 测试导入 models...")
from models import Battery, CabinetDoor, SwapRecord, MaintenanceOrder, Dispute
print("   ✓ models 导入成功")

print("3. 测试导入 api...")
from api import register_routes
print("   ✓ api 导入成功")

print("4. 测试创建 Flask 应用...")
from flask import Flask

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

with app.app_context():
    db.create_all()
    print("   ✓ 数据库表创建成功")
    
    register_routes(app, db)
    print("   ✓ 路由注册成功")
    
    print("5. 测试添加测试数据...")
    
    door = CabinetDoor(
        door_number='A01',
        status='available'
    )
    db.session.add(door)
    db.session.flush()
    
    battery = Battery(
        battery_code='BAT-TEST-001',
        status='available',
        current_door_id=door.id
    )
    db.session.add(battery)
    db.session.commit()
    
    print("   ✓ 测试数据添加成功")
    
    print("6. 测试查询数据...")
    doors = CabinetDoor.query.all()
    print(f"   ✓ 找到 {len(doors)} 个柜门")
    
    batteries = Battery.query.all()
    print(f"   ✓ 找到 {len(batteries)} 个电池")
    
print("\n" + "="*50)
print("所有测试通过！")
print("="*50)

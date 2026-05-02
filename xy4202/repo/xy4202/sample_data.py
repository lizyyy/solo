from datetime import datetime, date
from __init__ import create_app
from extensions import db
from models.models import Site, EquipmentType, Equipment, Inventory, Member

app = create_app()

def create_sample_data():
    with app.app_context():
        # 创建站点
        site1 = Site(
            name='阳光社区康复中心',
            address='北京市朝阳区阳光路123号',
            contact_person='张主任',
            phone='010-12345678'
        )
        
        site2 = Site(
            name='幸福社区康复中心',
            address='北京市海淀区幸福路456号',
            contact_person='李主任',
            phone='010-87654321'
        )
        
        db.session.add_all([site1, site2])
        db.session.flush()
        
        # 创建设备类型
        wheelchair_type = EquipmentType(
            name='轮椅',
            description='手动轮椅，适用于行动不便的老年人和残疾人',
            deposit_amount=500.0,
            daily_rental_fee=10.0,
            late_fee_per_day=20.0
        )
        
        walker_type = EquipmentType(
            name='助行器',
            description='助行器，帮助行走不便的人士',
            deposit_amount=200.0,
            daily_rental_fee=5.0,
            late_fee_per_day=10.0
        )
        
        bed_type = EquipmentType(
            name='护理床',
            description='多功能护理床，适用于卧床病人',
            deposit_amount=1000.0,
            daily_rental_fee=30.0,
            late_fee_per_day=50.0
        )
        
        db.session.add_all([wheelchair_type, walker_type, bed_type])
        db.session.flush()
        
        # 创建设备
        equipment_list = []
        
        # 轮椅
        for i in range(5):
            eq = Equipment(
                equipment_type_id=wheelchair_type.id,
                serial_number=f'WC{i+1:04d}',
                name=f'轮椅 - {i+1}号',
                status='available',
                purchase_date=date(2024, 1, 15)
            )
            equipment_list.append(eq)
        
        # 助行器
        for i in range(8):
            eq = Equipment(
                equipment_type_id=walker_type.id,
                serial_number=f'WK{i+1:04d}',
                name=f'助行器 - {i+1}号',
                status='available',
                purchase_date=date(2024, 2, 20)
            )
            equipment_list.append(eq)
        
        # 护理床
        for i in range(3):
            eq = Equipment(
                equipment_type_id=bed_type.id,
                serial_number=f'BD{i+1:04d}',
                name=f'护理床 - {i+1}号',
                status='available',
                purchase_date=date(2024, 3, 10)
            )
            equipment_list.append(eq)
        
        db.session.add_all(equipment_list)
        db.session.flush()
        
        # 创建库存记录 - 将设备分配到两个站点
        inventory_list = []
        
        # 轮椅 - 3台在阳光社区，2台在幸福社区
        for i in range(3):
            inv = Inventory(
                site_id=site1.id,
                equipment_id=equipment_list[i].id,
                quantity=1,
                available_quantity=1,
                location=f'设备区-{i+1}'
            )
            inventory_list.append(inv)
        
        for i in range(3, 5):
            inv = Inventory(
                site_id=site2.id,
                equipment_id=equipment_list[i].id,
                quantity=1,
                available_quantity=1,
                location=f'设备区-{i-2}'
            )
            inventory_list.append(inv)
        
        # 助行器 - 5台在阳光社区，3台在幸福社区
        for i in range(5, 10):
            inv = Inventory(
                site_id=site1.id,
                equipment_id=equipment_list[i].id,
                quantity=1,
                available_quantity=1,
                location=f'设备区-{i-4}'
            )
            inventory_list.append(inv)
        
        for i in range(10, 13):
            inv = Inventory(
                site_id=site2.id,
                equipment_id=equipment_list[i].id,
                quantity=1,
                available_quantity=1,
                location=f'设备区-{i-9}'
            )
            inventory_list.append(inv)
        
        # 护理床 - 2台在阳光社区，1台在幸福社区
        for i in range(13, 15):
            inv = Inventory(
                site_id=site1.id,
                equipment_id=equipment_list[i].id,
                quantity=1,
                available_quantity=1,
                location=f'设备区-{i-12}'
            )
            inventory_list.append(inv)
        
        inv = Inventory(
            site_id=site2.id,
            equipment_id=equipment_list[15].id,
            quantity=1,
            available_quantity=1,
            location='设备区-1'
        )
        inventory_list.append(inv)
        
        db.session.add_all(inventory_list)
        
        # 创建会员
        member1 = Member(
            member_number='M20240001',
            name='王大爷',
            id_card='110101195001151234',
            phone='13800138001',
            address='北京市朝阳区阳光小区1号楼1单元101室',
            gender='男',
            birth_date=date(1950, 1, 15),
            is_blacklisted=False
        )
        
        member2 = Member(
            member_number='M20240002',
            name='李奶奶',
            id_card='110102195505204321',
            phone='13900139002',
            address='北京市海淀区幸福小区2号楼3单元202室',
            gender='女',
            birth_date=date(1955, 5, 20),
            is_blacklisted=False
        )
        
        member3 = Member(
            member_number='M20240003',
            name='张先生',
            id_card='110103197008105678',
            phone='13700137003',
            address='北京市朝阳区阳光小区3号楼2单元303室',
            gender='男',
            birth_date=date(1970, 8, 10),
            is_blacklisted=True,
            blacklist_reason='多次逾期未还设备，且拒绝沟通'
        )
        
        db.session.add_all([member1, member2, member3])
        
        db.session.commit()
        
        print('示例数据创建成功！')
        print(f'创建了 {len([site1, site2])} 个站点')
        print(f'创建了 {len([wheelchair_type, walker_type, bed_type])} 种设备类型')
        print(f'创建了 {len(equipment_list)} 台设备')
        print(f'创建了 {len(inventory_list)} 条库存记录')
        print(f'创建了 {len([member1, member2, member3])} 名会员')

if __name__ == '__main__':
    create_sample_data()

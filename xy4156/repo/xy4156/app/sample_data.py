from app import db
from app.models import (
    ReagentLedger, Batch, Bottle, Cabinet, WasteBucket,
    HazardClass, WasteStatus
)
from datetime import datetime, timedelta


def create_sample_cabinets():
    cabinets_data = [
        {
            'cabinet_code': 'CAB-001',
            'name': '易燃品柜A',
            'location': '实验室A区',
            'hazard_class': HazardClass.FLAMMABLE,
            'is_low_temp': False
        },
        {
            'cabinet_code': 'CAB-002',
            'name': '氧化剂柜',
            'location': '实验室A区',
            'hazard_class': HazardClass.OXIDIZING,
            'is_low_temp': False
        },
        {
            'cabinet_code': 'CAB-003',
            'name': '腐蚀品柜',
            'location': '实验室B区',
            'hazard_class': HazardClass.CORROSIVE,
            'is_low_temp': False
        },
        {
            'cabinet_code': 'CAB-004',
            'name': '低温冷藏柜-1',
            'location': '实验室B区',
            'hazard_class': None,
            'is_low_temp': True,
            'min_temp': -20.0,
            'max_temp': 4.0
        },
        {
            'cabinet_code': 'CAB-005',
            'name': '普通试剂柜',
            'location': '实验室C区',
            'hazard_class': HazardClass.ORDINARY,
            'is_low_temp': False
        }
    ]
    
    for data in cabinets_data:
        existing = Cabinet.query.filter_by(cabinet_code=data['cabinet_code']).first()
        if not existing:
            cabinet = Cabinet(**data)
            db.session.add(cabinet)
    
    db.session.commit()
    print("示例柜位数据已创建")


def create_sample_ledgers():
    ledgers_data = [
        {
            'reagent_name': '乙醇',
            'cas_number': '64-17-5',
            'hazard_class': HazardClass.FLAMMABLE,
            'hazard_details': '易燃液体，闪点12°C',
            'incompatible_with': '强氧化剂、酸类、酸酐、碱金属、胺类',
            'is_low_temp': False
        },
        {
            'reagent_name': '过氧化氢',
            'cas_number': '7722-84-1',
            'hazard_class': HazardClass.OXIDIZING,
            'hazard_details': '强氧化剂，浓度30%',
            'incompatible_with': '易燃物、还原剂、金属粉末',
            'is_low_temp': True,
            'min_temp': 2.0,
            'max_temp': 8.0
        },
        {
            'reagent_name': '浓硫酸',
            'cas_number': '7664-93-9',
            'hazard_class': HazardClass.CORROSIVE,
            'hazard_details': '强腐蚀性，浓度98%',
            'incompatible_with': '碱类、活泼金属、水',
            'is_low_temp': False
        },
        {
            'reagent_name': '丙酮',
            'cas_number': '67-64-1',
            'hazard_class': HazardClass.FLAMMABLE,
            'hazard_details': '易燃液体，闪点-20°C',
            'incompatible_with': '强氧化剂、强碱、强还原剂',
            'is_low_temp': False
        },
        {
            'reagent_name': '氯化钠',
            'cas_number': '7647-14-5',
            'hazard_class': HazardClass.ORDINARY,
            'hazard_details': '普通试剂，无特殊危害',
            'incompatible_with': None,
            'is_low_temp': False
        }
    ]
    
    for data in ledgers_data:
        existing = ReagentLedger.query.filter_by(reagent_name=data['reagent_name']).first()
        if not existing:
            ledger = ReagentLedger(**data)
            db.session.add(ledger)
    
    db.session.commit()
    print("示例试剂台账数据已创建")


def create_sample_batches():
    ledgers = ReagentLedger.query.all()
    ledger_map = {l.reagent_name: l.id for l in ledgers}
    
    batches_data = [
        {
            'batch_number': 'ETH-2024-001',
            'reagent_name': '乙醇',
            'total_volume': 5000.0,
            'unit': 'mL',
            'supplier': '国药集团',
            'manufactured_date': (datetime.now() - timedelta(days=30)).date(),
            'expiry_date': (datetime.now() + timedelta(days=365)).date()
        },
        {
            'batch_number': 'H2O2-2024-001',
            'reagent_name': '过氧化氢',
            'total_volume': 1000.0,
            'unit': 'mL',
            'supplier': '阿拉丁试剂',
            'manufactured_date': (datetime.now() - timedelta(days=15)).date(),
            'expiry_date': (datetime.now() + timedelta(days=180)).date()
        },
        {
            'batch_number': 'H2SO4-2024-001',
            'reagent_name': '浓硫酸',
            'total_volume': 2500.0,
            'unit': 'mL',
            'supplier': '西陇化工',
            'manufactured_date': (datetime.now() - timedelta(days=60)).date(),
            'expiry_date': (datetime.now() + timedelta(days=730)).date()
        },
        {
            'batch_number': 'ACE-2024-001',
            'reagent_name': '丙酮',
            'total_volume': 3000.0,
            'unit': 'mL',
            'supplier': '国药集团',
            'manufactured_date': (datetime.now() - timedelta(days=45)).date(),
            'expiry_date': (datetime.now() + timedelta(days=365)).date()
        }
    ]
    
    for data in batches_data:
        existing = Batch.query.filter_by(batch_number=data['batch_number']).first()
        if not existing and data['reagent_name'] in ledger_map:
            batch = Batch(
                batch_number=data['batch_number'],
                ledger_id=ledger_map[data['reagent_name']],
                total_volume=data['total_volume'],
                remaining_volume=data['total_volume'],
                unit=data['unit'],
                supplier=data['supplier'],
                manufactured_date=data['manufactured_date'],
                expiry_date=data['expiry_date']
            )
            db.session.add(batch)
    
    db.session.commit()
    print("示例批次数据已创建")


def create_sample_bottles():
    batches = Batch.query.all()
    cabinets = Cabinet.query.all()
    
    batch_map = {b.batch_number: b for b in batches}
    cabinet_map = {c.cabinet_code: c for c in cabinets}
    
    bottles_data = [
        {
            'bottle_code': 'BOT-ETH-001',
            'batch_number': 'ETH-2024-001',
            'volume': 500.0,
            'unit': 'mL',
            'cabinet_code': 'CAB-001'
        },
        {
            'bottle_code': 'BOT-ETH-002',
            'batch_number': 'ETH-2024-001',
            'volume': 500.0,
            'unit': 'mL',
            'cabinet_code': 'CAB-001'
        },
        {
            'bottle_code': 'BOT-H2O2-001',
            'batch_number': 'H2O2-2024-001',
            'volume': 500.0,
            'unit': 'mL',
            'cabinet_code': 'CAB-004'
        },
        {
            'bottle_code': 'BOT-H2SO4-001',
            'batch_number': 'H2SO4-2024-001',
            'volume': 500.0,
            'unit': 'mL',
            'cabinet_code': 'CAB-003'
        },
        {
            'bottle_code': 'BOT-ACE-001',
            'batch_number': 'ACE-2024-001',
            'volume': 500.0,
            'unit': 'mL',
            'cabinet_code': 'CAB-001'
        }
    ]
    
    for data in bottles_data:
        existing = Bottle.query.filter_by(bottle_code=data['bottle_code']).first()
        if not existing and data['batch_number'] in batch_map:
            batch = batch_map[data['batch_number']]
            cabinet = cabinet_map.get(data['cabinet_code'])
            
            bottle = Bottle(
                bottle_code=data['bottle_code'],
                ledger_id=batch.ledger_id,
                batch_id=batch.id,
                volume=data['volume'],
                unit=data['unit'],
                cabinet_id=cabinet.id if cabinet else None,
                status='在库'
            )
            db.session.add(bottle)
    
    db.session.commit()
    print("示例瓶码数据已创建")


def create_sample_waste_buckets():
    buckets_data = [
        {
            'bucket_code': 'WB-ORG-001',
            'waste_type': '有机溶剂废液',
            'hazard_class': HazardClass.FLAMMABLE,
            'max_volume': 20.0,
            'current_volume': 5.5,
            'unit': 'L',
            'start_date': (datetime.now() - timedelta(days=30)).date(),
            'expiry_days': 90
        },
        {
            'bucket_code': 'WB-ACID-001',
            'waste_type': '酸性废液',
            'hazard_class': HazardClass.CORROSIVE,
            'max_volume': 20.0,
            'current_volume': 12.0,
            'unit': 'L',
            'start_date': (datetime.now() - timedelta(days=60)).date(),
            'expiry_days': 90
        },
        {
            'bucket_code': 'WB-ORG-002',
            'waste_type': '有机溶剂废液',
            'hazard_class': HazardClass.FLAMMABLE,
            'max_volume': 20.0,
            'current_volume': 0.0,
            'unit': 'L',
            'start_date': datetime.now().date(),
            'expiry_days': 90
        }
    ]
    
    for data in buckets_data:
        existing = WasteBucket.query.filter_by(bucket_code=data['bucket_code']).first()
        if not existing:
            bucket = WasteBucket(
                bucket_code=data['bucket_code'],
                waste_type=data['waste_type'],
                hazard_class=data['hazard_class'],
                max_volume=data['max_volume'],
                current_volume=data['current_volume'],
                unit=data['unit'],
                start_date=data['start_date'],
                expiry_days=data['expiry_days'],
                status=WasteStatus.ACTIVE
            )
            db.session.add(bucket)
    
    db.session.commit()
    print("示例废液桶数据已创建")


def load_all_sample_data():
    create_sample_cabinets()
    create_sample_ledgers()
    create_sample_batches()
    create_sample_bottles()
    create_sample_waste_buckets()
    print("\n所有示例数据加载完成！")


if __name__ == '__main__':
    from app import create_app
    
    app = create_app()
    with app.app_context():
        load_all_sample_data()

import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from models import Pottery, SpliceGroup, PotteryGroupAssociation


def get_sample_data_dir():
    return os.path.dirname(os.path.abspath(__file__))


def load_pottery_data():
    pottery_file = os.path.join(get_sample_data_dir(), 'pottery_samples.json')
    with open(pottery_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def load_group_data():
    group_file = os.path.join(get_sample_data_dir(), 'group_samples.json')
    with open(group_file, 'r', encoding='utf-8') as f:
        return json.load(f)


def init_sample_data(app=None):
    if app is None:
        app = create_app('development')
    
    with app.app_context():
        print("=" * 50)
        print("初始化示例数据...")
        print("=" * 50)
        
        pottery_data = load_pottery_data()
        group_data = load_group_data()
        
        pottery_map = {}
        
        print(f"\n导入陶片数据...")
        for item in pottery_data:
            pottery_id = item['pottery_id']
            
            existing = Pottery.query.filter_by(pottery_id=pottery_id).first()
            
            if existing:
                print(f"  [跳过] 陶片 {pottery_id} 已存在")
                pottery_map[pottery_id] = existing
                continue
            
            pottery = Pottery(
                pottery_id=pottery_id,
                trench=item['trench'],
                layer=item['layer'],
                square=item.get('square'),
                length=item.get('length'),
                width=item.get('width'),
                thickness=item.get('thickness'),
                weight=item.get('weight'),
                decoration=item.get('decoration'),
                paste_type=item.get('paste_type'),
                color=item.get('color'),
                photo_path=item.get('photo_path'),
                photo_hash=item.get('photo_hash'),
                status=item.get('status', 'pending'),
                notes=item.get('notes'),
                created_by='system',
                updated_by='system'
            )
            
            db.session.add(pottery)
            db.session.flush()
            pottery_map[pottery_id] = pottery
            print(f"  [成功] 创建陶片: {pottery_id}")
        
        print(f"\n导入拼接组数据...")
        for item in group_data:
            group_id = item['group_id']
            
            existing = SpliceGroup.query.filter_by(group_id=group_id).first()
            
            if existing:
                print(f"  [跳过] 拼接组 {group_id} 已存在")
                continue
            
            group = SpliceGroup(
                group_id=group_id,
                name=item.get('name'),
                description=item.get('description'),
                status=item.get('status', 'draft'),
                guess_evidence=item.get('guess_evidence'),
                created_by='system',
                updated_by='system'
            )
            
            db.session.add(group)
            db.session.flush()
            
            pottery_ids = item.get('pottery_ids', [])
            for pottery_id in pottery_ids:
                if pottery_id in pottery_map:
                    assoc = PotteryGroupAssociation(
                        pottery_id=pottery_map[pottery_id].id,
                        group_id=group.id
                    )
                    db.session.add(assoc)
                    print(f"  [关联] {pottery_id} -> {group_id}")
            
            print(f"  [成功] 创建拼接组: {group_id}")
        
        db.session.commit()
        
        print("\n" + "=" * 50)
        print("示例数据初始化完成！")
        print("=" * 50)
        print(f"\n统计:")
        print(f"  陶片总数: {Pottery.query.count()}")
        print(f"  拼接组总数: {SpliceGroup.query.count()}")
        print(f"  关联总数: {PotteryGroupAssociation.query.count()}")
        
        print("\n示例数据说明:")
        print("  1. TP-T01-L03-001~004: T01探方L03层红陶绳纹罐残片")
        print("  2. TP-T01-L03-003: T01探方L03层蓝纹灰陶")
        print("  3. TP-T01-L04-001: T01探方L04层大型灰陶瓮")
        print("  4. TP-T02-L02-001: T02探方L02层素面红陶（无照片，用于测试照片缺失检测）")
        print("  5. TP-T01-L02-001: T01探方L02层黑陶方格纹")
        print("\n测试拼接组:")
        print("  - SG-TEST-LAYER-001: 不同层位陶片组合（测试层位冲突检测）")
        print("  - SG-TEST-TAG-001: 不同纹饰/胎土陶片组合（测试标签冲突检测）")


if __name__ == '__main__':
    init_sample_data()

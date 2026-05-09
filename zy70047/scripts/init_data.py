import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import SparePart, PartSubstitution
from app.services.part_service import create_or_update_part, add_substitution

app = create_app()

sample_parts = [
    {
        'part_code': 'BEARING-001',
        'part_name': '深沟球轴承 6205',
        'category': '轴承',
        'unit': '个',
        'unit_price': 58.50,
        'total_stock': 50,
        'min_stock': 20,
        'safety_stock': 30,
        'location': 'A-01-03',
        'supplier': 'SKF',
        'lead_time_days': 7
    },
    {
        'part_code': 'BEARING-002',
        'part_name': '深沟球轴承 6206',
        'category': '轴承',
        'unit': '个',
        'unit_price': 72.30,
        'total_stock': 5,
        'min_stock': 20,
        'safety_stock': 30,
        'location': 'A-01-04',
        'supplier': 'SKF',
        'lead_time_days': 7
    },
    {
        'part_code': 'SEAL-001',
        'part_name': '密封圈 NBR-50',
        'category': '密封件',
        'unit': '个',
        'unit_price': 12.80,
        'total_stock': 100,
        'min_stock': 50,
        'safety_stock': 70,
        'location': 'B-02-01',
        'supplier': 'NOK',
        'lead_time_days': 5
    },
    {
        'part_code': 'BELT-001',
        'part_name': '同步带 8M-500',
        'category': '传动件',
        'unit': '条',
        'unit_price': 185.00,
        'total_stock': 15,
        'min_stock': 10,
        'safety_stock': 20,
        'location': 'C-03-02',
        'supplier': 'GATES',
        'lead_time_days': 10
    },
    {
        'part_code': 'BELT-002',
        'part_name': '同步带 8M-520',
        'category': '传动件',
        'unit': '条',
        'unit_price': 195.00,
        'total_stock': 8,
        'min_stock': 10,
        'safety_stock': 20,
        'location': 'C-03-03',
        'supplier': 'GATES',
        'lead_time_days': 10
    },
    {
        'part_code': 'FILTER-001',
        'part_name': '液压过滤器 HF-01',
        'category': '过滤件',
        'unit': '个',
        'unit_price': 320.00,
        'total_stock': 25,
        'min_stock': 15,
        'safety_stock': 20,
        'location': 'D-04-01',
        'supplier': 'PALL',
        'lead_time_days': 14
    },
    {
        'part_code': 'LUB-001',
        'part_name': '润滑油 ISO-VG68',
        'category': '润滑材料',
        'unit': '桶',
        'unit_price': 850.00,
        'total_stock': 12,
        'min_stock': 10,
        'safety_stock': 15,
        'location': 'E-05-01',
        'supplier': 'Shell',
        'lead_time_days': 3
    }
]

sample_substitutions = [
    ('BELT-001', 'BELT-002', 1),
    ('BELT-002', 'BELT-001', 1)
]

def init_demo_data():
    with app.app_context():
        print('=== 初始化示例数据 ===')
        
        for part_data in sample_parts:
            existing = SparePart.query.filter_by(part_code=part_data['part_code']).first()
            if not existing:
                create_or_update_part(part_data, operator='system_init')
                print(f'创建备件: {part_data["part_code"]} - {part_data["part_name"]}')
            else:
                print(f'跳过(已存在): {part_data["part_code"]}')
        
        for original, substitute, priority in sample_substitutions:
            existing = PartSubstitution.query.filter_by(
                original_part_code=original,
                substitute_part_code=substitute
            ).first()
            if not existing:
                add_substitution(original, substitute, priority, operator='system_init')
                print(f'创建替代关系: {original} -> {substitute}')
        
        db.session.commit()
        
        print('\n=== 初始化完成 ===')
        print(f'共 {SparePart.query.count()} 个备件')
        print(f'共 {PartSubstitution.query.count()} 个替代关系')


if __name__ == '__main__':
    init_demo_data()

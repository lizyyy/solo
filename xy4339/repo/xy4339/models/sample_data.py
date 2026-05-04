from extensions import db
from models import PaperSpec, PaperStock
from datetime import datetime

def init_sample_data():
    if PaperSpec.query.first() is not None:
        return
    
    specs = [
        {'name': 'A0', 'width': 841, 'height': 1189, 'description': '国际标准A0'},
        {'name': 'A1', 'width': 594, 'height': 841, 'description': '国际标准A1'},
        {'name': 'A2', 'width': 420, 'height': 594, 'description': '国际标准A2'},
        {'name': 'A3', 'width': 297, 'height': 420, 'description': '国际标准A3'},
        {'name': '大度纸', 'width': 889, 'height': 1194, 'description': '印刷常用大度纸'},
        {'name': '正度纸', 'width': 787, 'height': 1092, 'description': '印刷常用正度纸'},
        {'name': '特规纸A', 'width': 900, 'height': 1200, 'description': '特殊规格纸'},
    ]
    
    for spec_data in specs:
        spec = PaperSpec(**spec_data)
        db.session.add(spec)
    
    db.session.commit()
    
    a1_spec = PaperSpec.query.filter_by(name='A1').first()
    a2_spec = PaperSpec.query.filter_by(name='A2').first()
    dadu_spec = PaperSpec.query.filter_by(name='大度纸').first()
    zhengdu_spec = PaperSpec.query.filter_by(name='正度纸').first()
    
    stocks = [
        {
            'spec_id': dadu_spec.id,
            'paper_type': 'coated',
            'weight': 157,
            'color': '白色',
            'unit_price': 2.5,
            'quantity': 500,
            'min_quantity': 50,
            'batch_number': 'B2024001',
            'supplier': '纸业有限公司A',
            'notes': '优质铜版纸'
        },
        {
            'spec_id': dadu_spec.id,
            'paper_type': 'coated',
            'weight': 200,
            'color': '白色',
            'unit_price': 3.2,
            'quantity': 300,
            'min_quantity': 50,
            'batch_number': 'B2024002',
            'supplier': '纸业有限公司A',
            'notes': '高克重铜版纸'
        },
        {
            'spec_id': dadu_spec.id,
            'paper_type': 'uncoated',
            'weight': 80,
            'color': '米白',
            'unit_price': 1.8,
            'quantity': 800,
            'min_quantity': 100,
            'batch_number': 'B2024003',
            'supplier': '纸业有限公司B',
            'notes': '书写纸'
        },
        {
            'spec_id': dadu_spec.id,
            'paper_type': 'uncoated',
            'weight': 100,
            'color': '白色',
            'unit_price': 2.0,
            'quantity': 200,
            'min_quantity': 50,
            'batch_number': 'B2024004',
            'supplier': '纸业有限公司B',
            'notes': '双胶纸'
        },
        {
            'spec_id': dadu_spec.id,
            'paper_type': 'art',
            'weight': 250,
            'color': '白色',
            'unit_price': 4.5,
            'quantity': 100,
            'min_quantity': 20,
            'batch_number': 'B2024005',
            'supplier': '特种纸业',
            'notes': '名片纸'
        },
        {
            'spec_id': zhengdu_spec.id,
            'paper_type': 'coated',
            'weight': 128,
            'color': '白色',
            'unit_price': 2.2,
            'quantity': 400,
            'min_quantity': 50,
            'batch_number': 'B2024006',
            'supplier': '纸业有限公司C',
            'notes': '普通铜版纸'
        },
        {
            'spec_id': a2_spec.id,
            'paper_type': 'cardboard',
            'weight': 300,
            'color': '灰白色',
            'unit_price': 3.5,
            'quantity': 150,
            'min_quantity': 30,
            'batch_number': 'B2024007',
            'supplier': '纸板厂',
            'notes': '灰底白板纸'
        },
    ]
    
    for stock_data in stocks:
        stock = PaperStock(**stock_data)
        db.session.add(stock)
    
    db.session.commit()

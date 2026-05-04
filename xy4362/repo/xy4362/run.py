from app import create_app, db
from app.models import Tank, FillRecord, OxygenTarget, DivePlan, DivePlanTank, RiskAssessment, Review

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'Tank': Tank,
        'FillRecord': FillRecord,
        'OxygenTarget': OxygenTarget,
        'DivePlan': DivePlan,
        'DivePlanTank': DivePlanTank,
        'RiskAssessment': RiskAssessment,
        'Review': Review
    }

@app.cli.command('init-db')
def init_db():
    db.create_all()
    print('数据库初始化完成！')

@app.cli.command('seed-data')
def seed_data():
    from datetime import datetime, timedelta
    
    tank1 = Tank(
        serial_number='T001',
        volume=12.0,
        tank_type='aluminum',
        current_pressure=200,
        inspection_expiry_date=(datetime.now().date() + timedelta(days=365))
    )
    
    tank2 = Tank(
        serial_number='T002',
        volume=12.0,
        tank_type='steel',
        current_pressure=180,
        inspection_expiry_date=(datetime.now().date() + timedelta(days=180))
    )
    
    tank3 = Tank(
        serial_number='T003',
        volume=10.0,
        tank_type='aluminum',
        current_pressure=50,
        inspection_expiry_date=(datetime.now().date() - timedelta(days=30))
    )
    
    tank4 = Tank(
        serial_number='T004',
        volume=12.0,
        tank_type='aluminum',
        current_pressure=200,
        inspection_expiry_date=(datetime.now().date() + timedelta(days=300))
    )
    
    db.session.add_all([tank1, tank2, tank3, tank4])
    db.session.commit()
    
    fill1 = FillRecord(
        tank_id=tank1.id,
        oxygen_partial_pressure=1.2,
        fill_pressure=200,
        operator='张教练',
        notes='常规空气填充'
    )
    
    fill2 = FillRecord(
        tank_id=tank2.id,
        oxygen_partial_pressure=1.5,
        fill_pressure=180,
        operator='李教练',
        notes='高氧混合气填充'
    )
    
    fill3 = FillRecord(
        tank_id=tank4.id,
        oxygen_partial_pressure=1.3,
        fill_pressure=200,
        operator='王教练',
        notes='空气填充'
    )
    
    db.session.add_all([fill1, fill2, fill3])
    db.session.commit()
    
    target1 = OxygenTarget(
        depth=18,
        max_oxygen_partial_pressure=1.4,
        description='休闲潜水标准限制'
    )
    
    target2 = OxygenTarget(
        depth=30,
        max_oxygen_partial_pressure=1.4,
        description='深度潜水限制'
    )
    
    db.session.add_all([target1, target2])
    db.session.commit()
    
    print('示例数据已填充！')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

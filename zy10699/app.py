from app import create_app, db
from app.models import DataTable, QualityRule, RuleSilence, Alert
from datetime import datetime, timedelta

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'DataTable': DataTable, 'QualityRule': QualityRule, 
            'RuleSilence': RuleSilence, 'Alert': Alert}

@app.cli.command('init-db')
def init_db():
    db.create_all()
    print('Database initialized.')

@app.cli.command('seed-data')
def seed_data():
    table1 = DataTable(
        database_name='production',
        schema_name='public',
        table_name='user_profiles',
        description='User profile data'
    )
    table2 = DataTable(
        database_name='production',
        schema_name='public',
        table_name='orders',
        description='Order transaction data'
    )
    db.session.add_all([table1, table2])
    db.session.flush()
    
    rule1 = QualityRule(
        rule_code='NULL_CHECK_001',
        rule_name='Email not null check',
        rule_type='null_check',
        table_id=table1.id,
        column_name='email',
        expression='email IS NULL',
        threshold=0,
        severity='critical'
    )
    rule2 = QualityRule(
        rule_code='UNIQUE_CHECK_001',
        rule_name='User ID uniqueness check',
        rule_type='unique_check',
        table_id=table1.id,
        column_name='user_id',
        expression='COUNT(DISTINCT user_id) != COUNT(user_id)',
        threshold=0,
        severity='high'
    )
    rule3 = QualityRule(
        rule_code='RANGE_CHECK_001',
        rule_name='Order amount range check',
        rule_type='range_check',
        table_id=table2.id,
        column_name='amount',
        expression='amount < 0 OR amount > 1000000',
        threshold=0.01,
        severity='warning'
    )
    db.session.add_all([rule1, rule2, rule3])
    db.session.flush()
    
    alert1 = Alert(
        rule_id=rule1.id,
        table_id=table1.id,
        alert_type='null_violation',
        severity='critical',
        message='Found 15 NULL values in email column'
    )
    alert2 = Alert(
        rule_id=rule2.id,
        table_id=table1.id,
        alert_type='unique_violation',
        severity='high',
        message='Found 3 duplicate user IDs'
    )
    db.session.add_all([alert1, alert2])
    
    db.session.commit()
    print('Sample data seeded.')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)

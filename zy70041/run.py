from app import create_app, db
from models import InspectionItem

app = create_app(start_background_jobs=True)

with app.app_context():
    db.create_all()

    if not InspectionItem.query.first():
        items = [
            InspectionItem(
                name='电机温度检查',
                equipment='生产流水线A-01',
                description='检查电机运行温度是否在正常范围内（40-70°C）'
            ),
            InspectionItem(
                name='传送带张力',
                equipment='生产流水线A-01',
                description='检查传送带张紧度，确保运行平稳'
            ),
            InspectionItem(
                name='液压油位',
                equipment='液压机B-02',
                description='检查液压系统油位，低于最低线需补充'
            ),
            InspectionItem(
                name='紧急停止按钮',
                equipment='冲压机C-03',
                description='确认紧急停止按钮功能正常'
            ),
            InspectionItem(
                name='冷却系统压力',
                equipment='注塑机D-04',
                description='检查冷却回路压力，确保不低于 0.3MPa'
            ),
        ]
        for item in items:
            db.session.add(item)
        db.session.commit()
        print('已初始化 5 个点检项')
    else:
        print('数据库中已有点检项数据，跳过初始化')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)

from app import create_app, db
from app.demo_data import create_demo_data
import os

app = create_app()

@app.cli.command('init-demo')
def init_demo():
    """初始化演示数据"""
    with app.app_context():
        current_period = create_demo_data()
        print(f'\n演示数据初始化完成! 当前计费周期: {current_period}')

@app.cli.command('reset-db')
def reset_db():
    """重置数据库"""
    with app.app_context():
        db.drop_all()
        db.create_all()
        print('数据库已重置!')

if __name__ == '__main__':
    print('=' * 60)
    print('水电抄表纠错 API')
    print('=' * 60)
    
    if not os.path.exists('water_elec.db'):
        print('\n数据库不存在，正在初始化演示数据...')
        with app.app_context():
            create_demo_data()
    
    print('\n启动参数:')
    print('  - 环境: 开发模式')
    print('  - 端口: 5001')
    print('  - 数据库: SQLite (water_elec.db)')
    print('\n主要API路径:')
    print('  GET  /api/health          - 健康检查')
    print('  POST /api/meters          - 创建设备')
    print('  POST /api/meters/<id>/readings - 抄表录入')
    print('  POST /api/meters/<id>/estimated-reading - 估读')
    print('  POST /api/meters/<id>/update-estimated - 补录真实读数')
    print('  GET  /api/meters/<id>/history - 表计历史')
    print('  GET  /api/abnormals       - 异常列表')
    print('  POST /api/abnormals/<id>/review - 复核异常')
    print('  POST /api/bills           - 生成账单')
    print('  POST /api/bills/<id>/issue - 出账')
    print('  POST /api/bills/<id>/pay   - 缴费')
    print('  POST /api/bills/<id>/correct - 账单纠错')
    print('  POST /api/bills/<id>/reissue - 重新出账')
    print('  GET  /api/report          - 收费报告(JSON)')
    print('  GET  /api/export/report   - 收费报告(文本)')
    print('\n初始化演示数据命令: flask init-demo')
    print('重置数据库命令: flask reset-db')
    print('=' * 60)
    
    app.run(host='0.0.0.0', port=5001, debug=True)

from datetime import datetime, timedelta
from app import app
from models import db, Team, Service, Quota

with app.app_context():
    db.drop_all()
    db.create_all()
    
    teams = [
        {'name': '交易平台团队', 'description': '负责核心交易系统开发与维护'},
        {'name': '数据智能团队', 'description': '负责数据分析和机器学习平台'},
        {'name': '支付网关团队', 'description': '负责支付网关和资金清算'},
        {'name': '用户中心团队', 'description': '负责用户账户和权限管理'}
    ]
    
    for t_data in teams:
        team = Team(**t_data)
        db.session.add(team)
    
    services = [
        {'name': '统一认证服务', 'description': 'OAuth2.0 身份认证与授权'},
        {'name': '订单查询服务', 'description': '订单数据查询与统计分析'},
        {'name': '消息推送服务', 'description': '多渠道消息推送系统'},
        {'name': '风控评估服务', 'description': '实时风险评估与决策'}
    ]
    
    for s_data in services:
        service = Service(**s_data)
        db.session.add(service)
    
    db.session.commit()
    
    current_month = datetime.utcnow().strftime('%Y-%m')
    
    quotas = [
        {'team_name': '交易平台团队', 'service_name': '统一认证服务', 'monthly_quota': 50000},
        {'team_name': '交易平台团队', 'service_name': '订单查询服务', 'monthly_quota': 100000},
        {'team_name': '交易平台团队', 'service_name': '消息推送服务', 'monthly_quota': 20000},
        {'team_name': '数据智能团队', 'service_name': '统一认证服务', 'monthly_quota': 30000},
        {'team_name': '数据智能团队', 'service_name': '订单查询服务', 'monthly_quota': 80000},
        {'team_name': '数据智能团队', 'service_name': '风控评估服务', 'monthly_quota': 15000},
        {'team_name': '支付网关团队', 'service_name': '统一认证服务', 'monthly_quota': 40000},
        {'team_name': '支付网关团队', 'service_name': '风控评估服务', 'monthly_quota': 50000},
        {'team_name': '用户中心团队', 'service_name': '统一认证服务', 'monthly_quota': 60000},
        {'team_name': '用户中心团队', 'service_name': '消息推送服务', 'monthly_quota': 25000}
    ]
    
    for q_data in quotas:
        team = Team.query.filter_by(name=q_data['team_name']).first()
        service = Service.query.filter_by(name=q_data['service_name']).first()
        
        quota = Quota(
            team_id=team.id,
            service_id=service.id,
            monthly_quota=q_data['monthly_quota'],
            month=current_month
        )
        db.session.add(quota)
    
    db.session.commit()
    
    print('初始化完成！')
    print('\n已创建团队：')
    for team in Team.query.all():
        print(f'  ID: {team.id} - {team.name}')
    
    print('\n已创建服务：')
    for service in Service.query.all():
        print(f'  ID: {service.id} - {service.name}')
    
    print(f'\n当前月份: {current_month}')

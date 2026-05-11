#!/usr/bin/env python3
"""
净水站滤芯寿命预测器 - 命令行工具
"""

import argparse
import sys
from datetime import datetime

from app.database import SessionLocal
from app.models import Filter, FilterPrediction, Complaint
from app.predictor import FilterLifePredictor

def cmd_predict(args):
    """预测滤芯寿命"""
    db = SessionLocal()
    predictor = FilterLifePredictor(db)
    
    try:
        if args.filter_id:
            result = predictor.predict(args.filter_id)
            if 'error' in result:
                print(f"❌ 错误: {result['error']}")
                return 1
            
            print("\n" + "="*60)
            print(f"滤芯寿命预测结果 - {args.filter_id}")
            print("="*60)
            print(f"\n健康评分: {result['health_score']:.1f}/100")
            print(f"风险等级: {result['risk_level'].upper()}")
            print(f"剩余天数: {result['predicted_remaining_days']} 天")
            print(f"剩余水量: {result['predicted_remaining_liters']:,.0f} 升")
            print(f"置信度: {(result['confidence']*100):.0f}%")
            print(f"\n建议: {result['recommendation']}")
            print(f"\n详细解释:")
            print(f"  {result['explanation']}")
            
            print(f"\n影响因素分析:")
            factors = result['factors']
            print(f"  - 使用时间: {factors['age']['usage_percentage']:.1f}% (评分: {factors['age']['score']*100:.1f})")
            print(f"  - 用水量: {factors['volume']['usage_percentage']:.1f}% (评分: {factors['volume']['score']*100:.1f})")
            print(f"  - 水质: {factors['quality']['score']*100:.1f} 分")
            
            if 'factors' in factors['complaints'] and factors['complaints']['factors'].get('count', 0) > 0:
                print(f"  - 投诉: {factors['complaints']['factors']['count']} 起 (评分: {factors['complaints']['score']*100:.1f})")
            
            print("\n" + "="*60)
            
            if result['risk_level'] in ['critical', 'high']:
                print("\n⚠️  关键判断: 该滤芯需要立即关注！")
                complaints = db.query(Complaint).filter(
                    Complaint.filter_id == args.filter_id,
                    Complaint.status == 'open'
                ).all()
                if complaints:
                    print(f"   关联未解决投诉: {len(complaints)} 起")
                    for c in complaints:
                        print(f"   - [{c.severity.upper()}] {c.complaint_type}: {c.description[:50]}...")
            
        else:
            filters = db.query(Filter).filter(Filter.status == 'active').all()
            print(f"\n批量预测 {len(filters)} 个滤芯...\n")
            
            print(f"{'滤芯ID':<15} {'健康分':<10} {'风险等级':<10} {'剩余天数':<10} {'建议'}")
            print("-"*80)
            
            critical_count = 0
            for f in filters:
                result = predictor.predict(f.filter_id)
                if 'error' not in result:
                    risk_display = result['risk_level'].upper()
                    if result['risk_level'] in ['critical', 'high']:
                        risk_display = '⚠️ ' + risk_display
                        critical_count += 1
                    
                    print(f"{f.filter_id:<15} {result['health_score']:<10.1f} {risk_display:<12} "
                          f"{result['predicted_remaining_days']:<10} {result['recommendation'][:20]}...")
            
            print("\n" + "="*60)
            print(f"预测完成: {len(filters)} 个滤芯")
            if critical_count > 0:
                print(f"⚠️  高风险滤芯: {critical_count} 个需要立即处理！")
            else:
                print("✓ 所有滤芯状态正常")
            print("="*60)
    
    finally:
        db.close()
    
    return 0

def cmd_list(args):
    """列出滤芯"""
    db = SessionLocal()
    
    try:
        query = db.query(Filter)
        if args.status:
            query = query.filter(Filter.status == args.status)
        
        filters = query.all()
        
        print(f"\n{'滤芯ID':<15} {'净水站':<20} {'类型':<10} {'状态':<10} {'安装日期'}")
        print("-"*70)
        
        for f in filters:
            status_display = '在用' if f.status == 'active' else '已更换'
            print(f"{f.filter_id:<15} {f.station_name:<20} {f.filter_type:<10} "
                  f"{status_display:<10} {f.install_date.strftime('%Y-%m-%d')}")
        
        print(f"\n共 {len(filters)} 个滤芯")
    
    finally:
        db.close()
    
    return 0

def cmd_risk(args):
    """风险概览"""
    db = SessionLocal()
    
    try:
        active_filters = db.query(Filter).filter(Filter.status == 'active').count()
        
        latest_predictions = db.query(
            FilterPrediction.filter_id,
            FilterPrediction.risk_level,
            FilterPrediction.health_score,
            FilterPrediction.recommendation
        ).distinct(FilterPrediction.filter_id).order_by(
            FilterPrediction.filter_id,
            FilterPrediction.prediction_date.desc()
        ).all()
        
        risk_counts = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'normal': 0}
        health_scores = []
        
        for p in latest_predictions:
            if p.risk_level in risk_counts:
                risk_counts[p.risk_level] += 1
            health_scores.append(p.health_score)
        
        print("\n" + "="*60)
        print("风险概览")
        print("="*60)
        
        print(f"\n在用滤芯: {active_filters}")
        print(f"已有预测: {len(latest_predictions)}")
        if health_scores:
            print(f"平均健康分: {sum(health_scores)/len(health_scores):.1f}")
        
        print(f"\n风险分布:")
        print(f"  🔴 严重 (critical): {risk_counts['critical']}")
        print(f"  🟠 高 (high):     {risk_counts['high']}")
        print(f"  🟡 中 (medium):   {risk_counts['medium']}")
        print(f"  🟢 低 (low):      {risk_counts['low']}")
        print(f"  🔵 正常 (normal): {risk_counts['normal']}")
        
        if risk_counts['critical'] + risk_counts['high'] > 0:
            print(f"\n⚠️  关键判断: 需要立即处理 {risk_counts['critical'] + risk_counts['high']} 个高风险滤芯！")
            
            print("\n高风险滤芯列表:")
            print(f"{'滤芯ID':<15} {'风险等级':<12} {'健康分':<10} {'建议'}")
            print("-"*60)
            
            for p in latest_predictions:
                if p.risk_level in ['critical', 'high']:
                    f = db.query(Filter).filter(Filter.filter_id == p.filter_id).first()
                    complaints = db.query(Complaint).filter(
                        Complaint.filter_id == p.filter_id,
                        Complaint.status == 'open'
                    ).count()
                    
                    risk_display = '🔴 ' + p.risk_level.upper() if p.risk_level == 'critical' else '🟠 ' + p.risk_level.upper()
                    complaint_info = f" (含{complaints}投诉)" if complaints > 0 else ""
                    print(f"{p.filter_id:<15} {risk_display:<12} {p.health_score:<10.1f} {p.recommendation[:25]}...{complaint_info}")
        else:
            print("\n✓ 所有滤芯风险等级正常，继续监控即可。")
        
        print("\n" + "="*60)
    
    finally:
        db.close()
    
    return 0

def main():
    parser = argparse.ArgumentParser(
        description='净水站滤芯寿命预测器 - 命令行工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py predict                    # 批量预测所有滤芯
  python cli.py predict --filter-id F001   # 预测单个滤芯
  python cli.py list                       # 列出所有滤芯
  python cli.py list --status active       # 只列出在用滤芯
  python cli.py risk                       # 查看风险概览
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    predict_parser = subparsers.add_parser('predict', help='预测滤芯寿命')
    predict_parser.add_argument('--filter-id', help='指定滤芯ID（不指定则批量预测）')
    
    list_parser = subparsers.add_parser('list', help='列出滤芯')
    list_parser.add_argument('--status', choices=['active', 'replaced'], help='按状态筛选')
    
    subparsers.add_parser('risk', help='风险概览')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 0
    
    if args.command == 'predict':
        return cmd_predict(args)
    elif args.command == 'list':
        return cmd_list(args)
    elif args.command == 'risk':
        return cmd_risk(args)
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

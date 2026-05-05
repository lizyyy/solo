import json
from datetime import datetime
from flask import Blueprint, request, jsonify, Response
from app import db
from app.models import (
    ConstructionApplication, UndergroundPipeline, BusStop, 
    CalendarEvent, RiskAssessment, ReviewRecord
)

export_bp = Blueprint('export', __name__)

def generate_meeting_note(application, risks, reviews):
    """生成 Markdown 格式的会签单"""
    
    # 计算总体风险等级
    if not risks:
        overall_risk = '低'
    else:
        levels = [r.risk_level for r in risks]
        if 'critical' in levels:
            overall_risk = '极高'
        elif 'high' in levels:
            overall_risk = '高'
        elif 'medium' in levels:
            overall_risk = '中'
        else:
            overall_risk = '低'
    
    # 风险类型映射
    risk_type_map = {
        'duplicate_excavation': '重复开挖风险',
        'pipeline_buffer_violation': '管线缓冲区冲突',
        'bus_stop_notification': '公交站点未通知',
        'schedule_conflict': '工期冲突'
    }
    
    risk_level_map = {
        'critical': '极高',
        'high': '高',
        'medium': '中',
        'low': '低'
    }
    
    decision_map = {
        'approve': '同意',
        'reject': '驳回',
        'modify': '需修改',
        'dismiss': '驳回风险',
        'pending': '待审核'
    }
    
    # 生成 Markdown 内容
    md = f"""# 市政道路开挖审批会签单

---

## 一、项目基本信息

| 项目名称 | {application.project_name} |
|----------|-----------------------------|
| 申请编号 | {application.application_id} |
| 道路名称 | {application.road_name} |
| 路段范围 | {application.road_section} |
| 施工类型 | {application.construction_type or '未指定'} |
| 申请单位 | {application.applicant or '未指定'} |
| 联系方式 | {application.contact_info or '未提供'} |
| 施工工期 | {application.start_date.isoformat()} 至 {application.end_date.isoformat()} |
| 总体风险 | **{overall_risk}** |

---

## 二、风险评估详情

本次评估共发现 **{len(risks)}** 个风险点：

"""
    
    # 按风险类型分组
    risk_groups = {}
    for risk in risks:
        risk_type = risk.risk_type
        if risk_type not in risk_groups:
            risk_groups[risk_type] = []
        risk_groups[risk_type].append(risk)
    
    for risk_type, type_risks in risk_groups.items():
        type_name = risk_type_map.get(risk_type, risk_type)
        md += f"\n### {type_name} ({len(type_risks)} 项)\n\n"
        
        for i, risk in enumerate(type_risks, 1):
            level_name = risk_level_map.get(risk.risk_level, risk.risk_level)
            md += f"**{i}. [{level_name}] {risk.description}**\n\n"
            
            # 受影响元素
            if risk.affected_elements:
                try:
                    affected = json.loads(risk.affected_elements)
                    if affected:
                        md += "   受影响元素：\n"
                        for item in affected:
                            if isinstance(item, dict):
                                name = item.get('project_name') or item.get('pipeline_type') or item.get('stop_name') or item.get('event_name', '未知')
                                md += f"   - {name}\n"
                            else:
                                md += f"   - {item}\n"
                        md += "\n"
                except:
                    pass
            
            # 复核状态
            if risk.reviewed:
                decision_name = decision_map.get(risk.review_decision, risk.review_decision)
                md += f"   复核状态：已复核 - **{decision_name}**\n"
                if risk.review_comment:
                    md += f"   复核意见：{risk.review_comment}\n"
                if risk.reviewer:
                    md += f"   复核人：{risk.reviewer}\n"
                md += "\n"
            else:
                md += "   复核状态：**待复核**\n\n"
    
    # 复核记录
    md += """---

## 三、复核记录

"""
    
    if reviews:
        for i, review in enumerate(reviews, 1):
            decision_name = decision_map.get(review.decision, review.decision)
            md += f"### 复核记录 {i}\n\n"
            md += f"| 复核人 | {review.reviewer} |\n"
            md += f"| 复核时间 | {review.review_date.isoformat()} |\n"
            md += f"| 复核决定 | **{decision_name}** |\n\n"
            
            if review.comments:
                md += f"**复核意见：** {review.comments}\n\n"
            
            if review.next_steps:
                md += f"**下一步措施：** {review.next_steps}\n\n"
    else:
        md += "暂无复核记录。\n\n"
    
    # 会签栏
    md += """---

## 四、会签栏

| 部门 | 签字 | 日期 |
|------|------|------|
| 路政管理科 | ____________ | ____________ |
| 管线协调科 | ____________ | ____________ |
| 公交管理科 | ____________ | ____________ |
| 审批负责人 | ____________ | ____________ |

---

**生成时间：** """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + "\n"
    
    return md

@export_bp.route('/meeting-note/<int:application_id>', methods=['GET'])
def export_meeting_note(application_id):
    """导出 Markdown 格式的会签单"""
    application = ConstructionApplication.query.get_or_404(application_id)
    
    try:
        # 获取风险评估
        risks = RiskAssessment.query.filter_by(application_id=application.id).all()
        
        # 获取复核记录
        reviews = ReviewRecord.query.filter_by(application_id=application.id).order_by(
            ReviewRecord.review_date.desc()
        ).all()
        
        # 生成 Markdown
        markdown_content = generate_meeting_note(application, risks, reviews)
        
        # 返回为 Markdown 文件下载
        filename = f"会签单_{application.application_id}_{datetime.now().strftime('%Y%m%d')}.md"
        
        return Response(
            markdown_content,
            mimetype='text/markdown',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        return jsonify({'error': f'导出会签单失败: {str(e)}'}), 500

@export_bp.route('/audit-package/<int:application_id>', methods=['GET'])
def export_audit_package(application_id):
    """导出 JSON 格式的审计包"""
    application = ConstructionApplication.query.get_or_404(application_id)
    
    try:
        # 获取风险评估
        risks = RiskAssessment.query.filter_by(application_id=application.id).all()
        
        # 获取复核记录
        reviews = ReviewRecord.query.filter_by(application_id=application.id).order_by(
            ReviewRecord.review_date.desc()
        ).all()
        
        # 构建审计包
        audit_package = {
            'version': '1.0',
            'export_time': datetime.now().isoformat(),
            'application': {
                'id': application.id,
                'application_id': application.application_id,
                'project_name': application.project_name,
                'road_name': application.road_name,
                'road_section': application.road_section,
                'start_date': application.start_date.isoformat(),
                'end_date': application.end_date.isoformat(),
                'construction_type': application.construction_type,
                'applicant': application.applicant,
                'contact_info': application.contact_info,
                'description': application.description,
                'created_at': application.created_at.isoformat(),
                'updated_at': application.updated_at.isoformat()
            },
            'risk_assessments': [],
            'review_records': [],
            'risk_summary': {}
        }
        
        # 添加风险评估
        for risk in risks:
            audit_package['risk_assessments'].append({
                'id': risk.id,
                'risk_type': risk.risk_type,
                'risk_level': risk.risk_level,
                'description': risk.description,
                'affected_elements': json.loads(risk.affected_elements) if risk.affected_elements else [],
                'reviewed': risk.reviewed,
                'review_decision': risk.review_decision,
                'review_comment': risk.review_comment,
                'reviewed_at': risk.reviewed_at.isoformat() if risk.reviewed_at else None,
                'reviewer': risk.reviewer,
                'created_at': risk.created_at.isoformat()
            })
        
        # 添加复核记录
        for review in reviews:
            audit_package['review_records'].append({
                'id': review.id,
                'reviewer': review.reviewer,
                'review_date': review.review_date.isoformat(),
                'decision': review.decision,
                'comments': review.comments,
                'next_steps': review.next_steps,
                'created_at': review.created_at.isoformat()
            })
        
        # 计算风险汇总
        risk_levels = [r.risk_level for r in risks]
        risk_types = [r.risk_type for r in risks]
        reviewed_count = sum(1 for r in risks if r.reviewed)
        
        audit_package['risk_summary'] = {
            'total_risks': len(risks),
            'reviewed_risks': reviewed_count,
            'by_level': {
                'critical': risk_levels.count('critical'),
                'high': risk_levels.count('high'),
                'medium': risk_levels.count('medium'),
                'low': risk_levels.count('low')
            },
            'by_type': {}
        }
        
        for risk_type in set(risk_types):
            audit_package['risk_summary']['by_type'][risk_type] = risk_types.count(risk_type)
        
        # 计算总体风险等级
        if not risks:
            overall_risk = 'low'
        else:
            if 'critical' in risk_levels:
                overall_risk = 'critical'
            elif 'high' in risk_levels:
                overall_risk = 'high'
            elif 'medium' in risk_levels:
                overall_risk = 'medium'
            else:
                overall_risk = 'low'
        
        audit_package['risk_summary']['overall_risk'] = overall_risk
        
        # 返回为 JSON 文件下载
        filename = f"审计包_{application.application_id}_{datetime.now().strftime('%Y%m%d')}.json"
        
        return Response(
            json.dumps(audit_package, ensure_ascii=False, indent=2),
            mimetype='application/json',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        return jsonify({'error': f'导出审计包失败: {str(e)}'}), 500

@export_bp.route('/batch/audit-package', methods=['GET'])
def export_batch_audit_package():
    """批量导出所有申请的审计包"""
    try:
        applications = ConstructionApplication.query.all()
        
        if not applications:
            return jsonify({'error': '没有找到施工申请'}), 404
        
        # 构建批量审计包
        batch_package = {
            'version': '1.0',
            'export_time': datetime.now().isoformat(),
            'total_applications': len(applications),
            'applications': []
        }
        
        for application in applications:
            # 获取风险评估
            risks = RiskAssessment.query.filter_by(application_id=application.id).all()
            
            # 获取复核记录
            reviews = ReviewRecord.query.filter_by(application_id=application.id).all()
            
            # 计算风险汇总
            risk_levels = [r.risk_level for r in risks]
            reviewed_count = sum(1 for r in risks if r.reviewed)
            
            if not risks:
                overall_risk = 'low'
            else:
                if 'critical' in risk_levels:
                    overall_risk = 'critical'
                elif 'high' in risk_levels:
                    overall_risk = 'high'
                elif 'medium' in risk_levels:
                    overall_risk = 'medium'
                else:
                    overall_risk = 'low'
            
            batch_package['applications'].append({
                'id': application.id,
                'application_id': application.application_id,
                'project_name': application.project_name,
                'road_name': application.road_name,
                'road_section': application.road_section,
                'start_date': application.start_date.isoformat(),
                'end_date': application.end_date.isoformat(),
                'overall_risk': overall_risk,
                'total_risks': len(risks),
                'reviewed_risks': reviewed_count,
                'risk_count_by_level': {
                    'critical': risk_levels.count('critical'),
                    'high': risk_levels.count('high'),
                    'medium': risk_levels.count('medium'),
                    'low': risk_levels.count('low')
                }
            })
        
        # 返回为 JSON 文件下载
        filename = f"批量审计包_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        return Response(
            json.dumps(batch_package, ensure_ascii=False, indent=2),
            mimetype='application/json',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        
    except Exception as e:
        return jsonify({'error': f'批量导出失败: {str(e)}'}), 500

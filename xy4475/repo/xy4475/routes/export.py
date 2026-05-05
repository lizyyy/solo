from flask import Blueprint, jsonify, request, make_response
from extensions import db
from models import Case, Evidence, SealRecord, Inspection, InventoryLog, RiskReview
from datetime import datetime
import json
import os
import urllib.parse

export_bp = Blueprint('export', __name__)

# 确保导出目录
EXPORTS_DIR = 'exports'
os.makedirs(EXPORTS_DIR, exist_ok=True)

@export_bp.route('/markdown/case/<int:case_id>', methods=['GET'])
def export_case_markdown(case_id):
    """导出案件的Markdown交接单"""
    # 获取案件信息
    case = Case.query.get_or_404(case_id)
    
    # 获取证物信息
    evidences = Evidence.query.filter_by(case_id=case_id).all()
    
    # 获取检验记录
    inspections = Inspection.query.filter_by(case_id=case_id).order_by(Inspection.inspection_step).all()
    
    # 获取取还库日志
    inventory_logs = InventoryLog.query.filter_by(case_id=case_id).order_by(InventoryLog.operation_time.desc()).all()
    
    # 获取风险复核记录
    risk_reviews = RiskReview.query.filter_by(case_id=case_id).order_by(RiskReview.review_time.desc()).all()
    
    # 生成Markdown内容
    md_content = f"""# 司法鉴定所案件交接单

## 基本信息

| 项目 | 内容 |
|------|------|
| 案件编号 | {case.case_number} |
| 案件名称 | {case.case_name} |
| 案件类型 | {case.case_type} |
| 委托单位 | {case.entrusted_by} |
| 委托日期 | {case.entrust_date.isoformat() if case.entrust_date else '无'} |
| 截止日期 | {case.deadline.isoformat() if case.deadline else '无'} |
| 案件状态 | {case.case_status} |
| 创建时间 | {case.create_time.strftime('%Y-%m-%d %H:%M:%S') if case.create_time else '无'} |
| 更新时间 | {case.update_time.strftime('%Y-%m-%d %H:%M:%S') if case.update_time else '无'} |

---

## 证物清单

"""
    
    if evidences:
        md_content += "| 序号 | 证物编号 | 证物名称 | 证物类型 | 封签编号 |\n"
        md_content += "|------|----------|----------|----------|----------|\n"
        for i, evidence in enumerate(evidences, 1):
            md_content += f"| {i} | {evidence.evidence_number} | {evidence.evidence_name} | {evidence.evidence_type} | {evidence.seal_number} |\n"
        
        # 添加封签历史
        md_content += "\n### 封签历史\n\n"
        for evidence in evidences:
            seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
            if seal_records:
                md_content += f"#### 证物: {evidence.evidence_name} ({evidence.evidence_number})\n\n"
                md_content += "| 序号 | 操作类型 | 封签编号 | 操作人 | 操作时间 | 地点 | 封签链完整 |\n"
                md_content += "|------|----------|----------|--------|----------|------|------------|\n"
                for j, record in enumerate(seal_records, 1):
                    chain_status = "✓ 完整" if record.is_chain_complete else "✗ 断链"
                    md_content += f"| {j} | {record.operation} | {record.seal_number} | {record.operator} | {record.operation_time.strftime('%Y-%m-%d %H:%M:%S') if record.operation_time else '无'} | {record.location} | {chain_status} |\n"
                md_content += "\n"
    else:
        md_content += "**暂无证物记录**\n"
    
    md_content += """---

## 检验步骤记录

"""
    
    if inspections:
        md_content += "| 步骤号 | 步骤名称 | 检验人 | 开始时间 | 结束时间 | 状态 | 超期 |\n"
        md_content += "|--------|----------|--------|----------|----------|------|------|\n"
        for inspection in inspections:
            start_time = inspection.start_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.start_time else '无'
            end_time = inspection.end_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.end_time else '进行中'
            overdue_status = "✓ 正常" if not inspection.is_overdue else "✗ 超期"
            md_content += f"| {inspection.inspection_step} | {inspection.step_name} | {inspection.inspector} | {start_time} | {end_time} | {inspection.status} | {overdue_status} |\n"
        
        # 添加检验详情
        md_content += "\n### 检验详情\n\n"
        for inspection in inspections:
            md_content += f"#### 步骤 {inspection.inspection_step}: {inspection.step_name}\n\n"
            md_content += f"- **检验人**: {inspection.inspector}\n"
            md_content += f"- **开始时间**: {inspection.start_time.strftime('%Y-%m-%d %H:%M:%S') if inspection.start_time else '无'}\n"
            if inspection.end_time:
                md_content += f"- **结束时间**: {inspection.end_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            md_content += f"- **状态**: {inspection.status}\n"
            md_content += f"- **超期状态**: {'✓ 正常' if not inspection.is_overdue else '✗ 超期'}\n"
            if inspection.result:
                md_content += f"- **检验结果**: {inspection.result}\n"
            md_content += "\n"
    else:
        md_content += "**暂无检验记录**\n"
    
    md_content += """---

## 取还库日志

"""
    
    if inventory_logs:
        md_content += "| 序号 | 操作类型 | 操作人 | 借阅人 | 操作时间 | 地点 | 状态 | 超期 |\n"
        md_content += "|------|----------|--------|--------|----------|------|------|------|\n"
        for i, log in enumerate(inventory_logs, 1):
            borrower = log.borrower if log.borrower else '-'
            status = "✓ 已归还" if log.is_returned else "✗ 未归还"
            overdue_status = "✓ 正常" if not log.is_overdue else "✗ 超期"
            md_content += f"| {i} | {log.operation_type} | {log.operator} | {borrower} | {log.operation_time.strftime('%Y-%m-%d %H:%M:%S') if log.operation_time else '无'} | {log.location} | {status} | {overdue_status} |\n"
    else:
        md_content += "**暂无取还库记录**\n"
    
    md_content += """---

## 风险复核记录

"""
    
    if risk_reviews:
        md_content += "| 序号 | 风险类型 | 风险级别 | 描述 | 复核人 | 复核时间 | 状态 |\n"
        md_content += "|------|----------|----------|------|--------|----------|------|\n"
        for i, review in enumerate(risk_reviews, 1):
            status = "✓ 已解决" if review.is_resolved else "✗ 未解决"
            md_content += f"| {i} | {review.risk_type} | {review.risk_level} | {review.risk_description[:50]}... | {review.reviewer} | {review.review_time.strftime('%Y-%m-%d %H:%M:%S') if review.review_time else '无'} | {status} |\n"
    else:
        md_content += "**暂无风险复核记录**\n"
    
    md_content += f"""

---

## 生成信息

- **生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
- **案件编号**: {case.case_number}
- **案件状态**: {case.case_status}

---

*此交接单由司法鉴定所管理系统自动生成*
"""
    
    # 保存文件
    filename = f"交接单_{case.case_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    filepath = os.path.join(EXPORTS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    # 返回下载响应
    response = make_response(md_content)
    response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
    # 使用RFC 5987格式处理中文文件名
    encoded_filename = urllib.parse.quote(filename, encoding='utf-8')
    response.headers['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded_filename}"
    
    return response

@export_bp.route('/json/case/<int:case_id>', methods=['GET'])
def export_case_json(case_id):
    """导出案件的JSON审计包"""
    # 获取案件信息
    case = Case.query.get_or_404(case_id)
    
    # 获取证物信息
    evidences = Evidence.query.filter_by(case_id=case_id).all()
    evidence_list = []
    for evidence in evidences:
        # 获取证物的封签历史
        seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
        
        # 获取证物的取还库日志
        inventory_logs = InventoryLog.query.filter_by(evidence_id=evidence.id).order_by(InventoryLog.operation_time.desc()).all()
        
        evidence_list.append({
            'evidence': evidence.to_dict(),
            'seal_records': [record.to_dict() for record in seal_records],
            'inventory_logs': [log.to_dict() for log in inventory_logs]
        })
    
    # 获取检验记录
    inspections = Inspection.query.filter_by(case_id=case_id).order_by(Inspection.inspection_step).all()
    
    # 获取取还库日志（按案件）
    inventory_logs = InventoryLog.query.filter_by(case_id=case_id).order_by(InventoryLog.operation_time.desc()).all()
    
    # 获取风险复核记录
    risk_reviews = RiskReview.query.filter_by(case_id=case_id).order_by(RiskReview.review_time.desc()).all()
    
    # 统计风险信息
    unresolved_risks = RiskReview.query.filter_by(case_id=case_id, is_resolved=False).count()
    high_risk_risks = RiskReview.query.filter_by(case_id=case_id, risk_level='高', is_resolved=False).count()
    
    # 统计封签链状态
    broken_chain = False
    for evidence in evidences:
        seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).all()
        for record in seal_records:
            if not record.is_chain_complete:
                broken_chain = True
                break
        if broken_chain:
            break
    
    # 统计检验超期
    overdue_inspections = Inspection.query.filter_by(case_id=case_id, is_overdue=True, status='进行中').count()
    
    # 统计借阅未归还
    unreturned_items = InventoryLog.query.filter_by(case_id=case_id, is_returned=False).count()
    overdue_items = InventoryLog.query.filter_by(case_id=case_id, is_returned=False, is_overdue=True).count()
    
    # 构建审计包
    audit_package = {
        'audit_info': {
            'package_type': 'forensic_case_audit',
            'version': '1.0',
            'export_time': datetime.now().isoformat(),
            'case_number': case.case_number,
            'export_user': request.args.get('user', 'system')
        },
        'case': case.to_dict(),
        'evidences': evidence_list,
        'inspections': [inspection.to_dict() for inspection in inspections],
        'inventory_logs': [log.to_dict() for log in inventory_logs],
        'risk_reviews': [review.to_dict() for review in risk_reviews],
        'statistics': {
            'evidence_count': len(evidences),
            'inspection_count': len(inspections),
            'inventory_log_count': len(inventory_logs),
            'risk_review_count': len(risk_reviews),
            'unresolved_risks': unresolved_risks,
            'high_risk_risks': high_risk_risks,
            'broken_chain': broken_chain,
            'overdue_inspections': overdue_inspections,
            'unreturned_items': unreturned_items,
            'overdue_items': overdue_items
        }
    }
    
    # 保存文件
    filename = f"审计包_{case.case_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(EXPORTS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(audit_package, f, ensure_ascii=False, indent=2)
    
    # 返回下载响应
    response = make_response(json.dumps(audit_package, ensure_ascii=False, indent=2))
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    # 使用RFC 5987格式处理中文文件名
    encoded_filename = urllib.parse.quote(filename, encoding='utf-8')
    response.headers['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded_filename}"
    
    return response

@export_bp.route('/json/all', methods=['GET'])
def export_all_json():
    """导出所有案件的JSON审计包"""
    # 获取所有案件
    cases = Case.query.all()
    
    all_cases_data = []
    
    for case in cases:
        # 获取证物信息
        evidences = Evidence.query.filter_by(case_id=case.id).all()
        evidence_list = []
        for evidence in evidences:
            # 获取证物的封签历史
            seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).order_by(SealRecord.operation_time).all()
            
            # 获取证物的取还库日志
            inventory_logs = InventoryLog.query.filter_by(evidence_id=evidence.id).order_by(InventoryLog.operation_time.desc()).all()
            
            evidence_list.append({
                'evidence': evidence.to_dict(),
                'seal_records': [record.to_dict() for record in seal_records],
                'inventory_logs': [log.to_dict() for log in inventory_logs]
            })
        
        # 获取检验记录
        inspections = Inspection.query.filter_by(case_id=case.id).order_by(Inspection.inspection_step).all()
        
        # 获取取还库日志（按案件）
        inventory_logs = InventoryLog.query.filter_by(case_id=case.id).order_by(InventoryLog.operation_time.desc()).all()
        
        # 获取风险复核记录
        risk_reviews = RiskReview.query.filter_by(case_id=case.id).order_by(RiskReview.review_time.desc()).all()
        
        # 统计风险信息
        unresolved_risks = RiskReview.query.filter_by(case_id=case.id, is_resolved=False).count()
        high_risk_risks = RiskReview.query.filter_by(case_id=case.id, risk_level='高', is_resolved=False).count()
        
        # 统计封签链状态
        broken_chain = False
        for evidence in evidences:
            seal_records = SealRecord.query.filter_by(evidence_id=evidence.id).all()
            for record in seal_records:
                if not record.is_chain_complete:
                    broken_chain = True
                    break
            if broken_chain:
                break
        
        # 统计检验超期
        overdue_inspections = Inspection.query.filter_by(case_id=case.id, is_overdue=True, status='进行中').count()
        
        # 统计借阅未归还
        unreturned_items = InventoryLog.query.filter_by(case_id=case.id, is_returned=False).count()
        overdue_items = InventoryLog.query.filter_by(case_id=case.id, is_returned=False, is_overdue=True).count()
        
        case_data = {
            'case': case.to_dict(),
            'evidences': evidence_list,
            'inspections': [inspection.to_dict() for inspection in inspections],
            'inventory_logs': [log.to_dict() for log in inventory_logs],
            'risk_reviews': [review.to_dict() for review in risk_reviews],
            'statistics': {
                'evidence_count': len(evidences),
                'inspection_count': len(inspections),
                'inventory_log_count': len(inventory_logs),
                'risk_review_count': len(risk_reviews),
                'unresolved_risks': unresolved_risks,
                'high_risk_risks': high_risk_risks,
                'broken_chain': broken_chain,
                'overdue_inspections': overdue_inspections,
                'unreturned_items': unreturned_items,
                'overdue_items': overdue_items
            }
        }
        
        all_cases_data.append(case_data)
    
    # 构建完整审计包
    full_audit_package = {
        'audit_info': {
            'package_type': 'forensic_full_audit',
            'version': '1.0',
            'export_time': datetime.now().isoformat(),
            'case_count': len(cases),
            'export_user': request.args.get('user', 'system')
        },
        'cases': all_cases_data
    }
    
    # 保存文件
    filename = f"完整审计包_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    filepath = os.path.join(EXPORTS_DIR, filename)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(full_audit_package, f, ensure_ascii=False, indent=2)
    
    # 返回下载响应
    response = make_response(json.dumps(full_audit_package, ensure_ascii=False, indent=2))
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    # 使用RFC 5987格式处理中文文件名
    encoded_filename = urllib.parse.quote(filename, encoding='utf-8')
    response.headers['Content-Disposition'] = f"attachment; filename*=UTF-8''{encoded_filename}"
    
    return response

@export_bp.route('/list', methods=['GET'])
def list_exports():
    """列出所有导出的文件"""
    files = []
    for filename in os.listdir(EXPORTS_DIR):
        filepath = os.path.join(EXPORTS_DIR, filename)
        if os.path.isfile(filepath):
            file_stat = os.stat(filepath)
            files.append({
                'filename': filename,
                'size': file_stat.st_size,
                'modified_time': datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            })
    
    # 按修改时间排序
    files.sort(key=lambda x: x['modified_time'], reverse=True)
    
    return jsonify({
        'total': len(files),
        'files': files
    })

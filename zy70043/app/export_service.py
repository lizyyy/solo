import csv
import os
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from .models import SubstitutionRequest, AffectedFormula, ApprovalRecord, ExecutionTrace
from .config import EXPORT_DIR


def ensure_export_dir():
    if not os.path.exists(EXPORT_DIR):
        os.makedirs(EXPORT_DIR, exist_ok=True)


def export_substitution_detail(
    db: Session,
    request_no: str
) -> Optional[str]:
    ensure_export_dir()
    
    substitution = db.query(SubstitutionRequest).filter(
        SubstitutionRequest.request_no == request_no
    ).first()
    
    if not substitution:
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"替代申请复核_{request_no}_{timestamp}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    affected_items = db.query(AffectedFormula).filter(
        AffectedFormula.substitution_id == substitution.id
    ).all()
    
    approvals = db.query(ApprovalRecord).filter(
        ApprovalRecord.substitution_id == substitution.id
    ).all()
    
    traces = db.query(ExecutionTrace).filter(
        ExecutionTrace.substitution_id == substitution.id
    ).all()
    
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        
        writer.writerow(["【原料替代申请复核单】"])
        writer.writerow([])
        
        writer.writerow(["一、申请基本信息"])
        writer.writerow(["申请单号", substitution.request_no])
        writer.writerow(["当前状态", substitution.status.value])
        writer.writerow(["创建人", substitution.created_by])
        writer.writerow(["创建时间", substitution.created_at.strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["完成时间", substitution.completed_at.strftime("%Y-%m-%d %H:%M:%S") if substitution.completed_at else "未完成"])
        writer.writerow([])
        
        writer.writerow(["二、原料替代信息"])
        writer.writerow(["原原料", f"{substitution.original_material_code} - {substitution.original_material_name}"])
        writer.writerow(["替代原料", f"{substitution.substitute_material_code} - {substitution.substitute_material_name}"])
        writer.writerow(["替代比例", f"{substitution.substitute_ratio * 100}%"])
        writer.writerow(["是否临时替代", "是" if substitution.is_temporary else "否"])
        writer.writerow(["替代原因", substitution.reason])
        writer.writerow([])
        
        writer.writerow(["三、成本核算对比"])
        writer.writerow(["项目", "金额", "说明"])
        writer.writerow(["原配方总成本", f"{substitution.original_cost} 元", "使用原原料的配方总成本"])
        writer.writerow(["替代后总成本", f"{substitution.substitute_cost} 元", "使用替代原料的配方总成本"])
        writer.writerow(["成本差额", f"{substitution.cost_diff_amount} 元", "正数表示成本增加，负数表示成本减少"])
        writer.writerow(["成本差异率", f"{substitution.cost_diff_percent}%", "与原成本的差异比例"])
        writer.writerow(["是否超出成本阈值", "是" if substitution.exceeds_threshold else "否", "阈值为 10%，超出需额外审批"])
        writer.writerow([])
        
        writer.writerow(["四、受影响配方列表"])
        writer.writerow(["配方编码", "配方名称", "原原料用量", "处理状态", "新版本号", "错误信息"])
        for item in affected_items:
            status_display = {
                "pending": "待处理",
                "success": "已更新",
                "failed": "更新失败"
            }.get(item.processing_status, item.processing_status)
            
            writer.writerow([
                item.formula_code,
                item.formula_name,
                f"{item.original_usage} kg",
                status_display,
                f"v{item.new_version_id}" if item.new_version_id else "-",
                item.error_message or ""
            ])
        writer.writerow([])
        
        writer.writerow(["五、审批记录"])
        writer.writerow(["审批级别", "审批结果", "审批人", "审批时间", "审批意见"])
        for approval in approvals:
            writer.writerow([
                approval.approval_level.value,
                approval.result.value,
                approval.approver,
                approval.approved_at.strftime("%Y-%m-%d %H:%M:%S"),
                approval.comment or ""
            ])
        if not approvals:
            writer.writerow(["-", "-", "-", "暂无审批记录", "-"])
        writer.writerow([])
        
        writer.writerow(["六、执行追溯日志"])
        writer.writerow(["序号", "执行步骤", "执行描述", "执行结果", "错误信息", "执行时间"])
        for idx, trace in enumerate(traces, 1):
            writer.writerow([
                idx,
                trace.step_name,
                trace.step_description or "",
                "成功" if trace.is_success else "失败",
                trace.error_message or "",
                trace.executed_at.strftime("%Y-%m-%d %H:%M:%S")
            ])
        if not traces:
            writer.writerow(["1", "-", "-", "尚未执行", "-", "-"])
        writer.writerow([])
        
        writer.writerow(["【导出说明】"])
        writer.writerow(["1. 此文件用于业务复核，可直接用 Excel 打开"])
        writer.writerow(["2. 成本差额正数表示成本上升，需关注"])
        writer.writerow(["3. 处理状态为'更新失败'的配方，可通过重试接口再次执行"])
        writer.writerow(["4. 导出时间：" + datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
    
    return filepath


def export_formula_history(
    db: Session,
    formula_code: str
) -> Optional[str]:
    from .models import Formula, FormulaVersion, FormulaItem
    
    ensure_export_dir()
    
    formula = db.query(Formula).filter(Formula.code == formula_code).first()
    if not formula:
        return None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"配方版本历史_{formula_code}_{timestamp}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        
        writer.writerow(["【配方版本历史复核单】"])
        writer.writerow([])
        
        writer.writerow(["配方信息"])
        writer.writerow(["配方编码", formula.code])
        writer.writerow(["配方名称", formula.name])
        writer.writerow(["产品编码", formula.product_code])
        writer.writerow(["产品名称", formula.product_name])
        writer.writerow(["当前版本号", f"v{formula.current_version}"])
        writer.writerow([])
        
        writer.writerow(["各版本详情"])
        writer.writerow(["版本号", "生效状态", "生效开始", "生效结束", "创建人", "变更原因", "原料编码", "原料名称", "用量", "单位", "单价", "是否替代"])
        
        for version in sorted(formula.versions, key=lambda v: v.version_number):
            for idx, item in enumerate(version.items):
                writer.writerow([
                    f"v{version.version_number}" if idx == 0 else "",
                    "当前生效" if version.is_effective else "已失效",
                    version.effective_from.strftime("%Y-%m-%d %H:%M:%S") if version.effective_from else "-",
                    version.effective_to.strftime("%Y-%m-%d %H:%M:%S") if version.effective_to else "-",
                    version.created_by if idx == 0 else "",
                    version.reason if idx == 0 else "",
                    item.raw_material_code,
                    item.raw_material_name,
                    item.quantity,
                    item.unit,
                    item.unit_price,
                    "是（替代原料）" if item.is_substituted else "否"
                ])
            writer.writerow([])
    
    return filepath


def export_requests_summary(
    db: Session,
    limit: int = 100
) -> str:
    from .models import SubstitutionRequest
    
    ensure_export_dir()
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"替代申请汇总_{timestamp}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    
    requests = db.query(SubstitutionRequest).order_by(
        SubstitutionRequest.created_at.desc()
    ).limit(limit).all()
    
    with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        
        writer.writerow(["【原料替代申请汇总表】"])
        writer.writerow([])
        
        writer.writerow([
            "申请单号", "状态", "原原料", "替代原料", "受影响配方数",
            "原成本(元)", "替代后成本(元)", "成本差额(元)", "差异率", "是否超阈值",
            "创建人", "创建时间", "完成时间"
        ])
        
        for r in requests:
            writer.writerow([
                r.request_no,
                r.status.value,
                f"{r.original_material_code}-{r.original_material_name}",
                f"{r.substitute_material_code}-{r.substitute_material_name}",
                r.affected_formula_count,
                r.original_cost,
                r.substitute_cost,
                r.cost_diff_amount,
                f"{r.cost_diff_percent}%",
                "是" if r.exceeds_threshold else "否",
                r.created_by,
                r.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                r.completed_at.strftime("%Y-%m-%d %H:%M:%S") if r.completed_at else ""
            ])
    
    return filepath

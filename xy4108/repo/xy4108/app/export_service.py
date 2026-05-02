import csv
import io
import json
from typing import List, Dict, Optional
from datetime import date, datetime
from sqlalchemy.orm import Session
from .models import Child, MenuItem, Ingredient, SubstitutionRequest, AuditLog, BlockRecord


class ExportService:
    @staticmethod
    def to_csv(data: List[Dict], fieldnames: List[str]) -> str:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for row in data:
            writer.writerow({k: str(v) if v else '' for k, v in row.items()})
        return output.getvalue()

    @staticmethod
    def to_json(data: Dict) -> str:
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def generate_meal_plan_markdown(meal_plan: Dict) -> str:
        lines = []
        lines.append(f"# 每日分餐计划 - {meal_plan.get('date', '未知日期')}")
        lines.append("")
        
        if not meal_plan.get('has_menu', True):
            lines.append("⚠️ 未找到当日菜单数据")
            return "\n".join(lines)

        summary = meal_plan.get('summary', {})
        lines.append("## 概览")
        lines.append("")
        lines.append(f"- 儿童总数: {summary.get('total_children', 0)}")
        lines.append(f"- 菜品总数: {summary.get('total_dishes', 0)}")
        lines.append(f"- 安全分餐: {summary.get('safe_assignments', 0)}")
        lines.append(f"- 阻断分餐: {summary.get('blocked_assignments', 0)}")
        lines.append(f"- 需替餐: {summary.get('substitutions_needed', 0)}")
        
        if summary.get('has_recalled_batches'):
            lines.append("- ⚠️ **存在召回批次，请查看详细报告**")
        if summary.get('has_expired_batches'):
            lines.append("- ⚠️ **存在过期批次，请查看详细报告**")
        
        lines.append("")

        for meal in meal_plan.get('meal_plans', []):
            lines.append(f"## {meal.get('meal_type', '未知餐次')}")
            lines.append("")

            if meal.get('batch_warnings'):
                lines.append("### ⚠️ 批次警告")
                for warning in meal['batch_warnings']:
                    lines.append(f"- **{warning.get('dish')}**: {warning.get('type')}")
                lines.append("")

            for dish in meal.get('dishes', []):
                dish_name = dish.get('dish_name', '未知菜品')
                lines.append(f"### {dish_name}")
                lines.append("")
                
                if dish.get('allergens'):
                    lines.append(f"⚠️ 过敏原提示: {dish['allergens']}")
                if dish.get('ingredients'):
                    lines.append(f"食材: {dish['ingredients']}")
                lines.append("")

                batch_check = dish.get('batch_check', {})
                if batch_check and not batch_check.get('is_safe', True):
                    lines.append("#### ⚠️ 批次问题")
                    if batch_check.get('recalled_ingredients'):
                        lines.append("**召回食材:**")
                        for ing in batch_check['recalled_ingredients']:
                            lines.append(f"- {ing.get('name')} (批次: {ing.get('batch_number')}) - {ing.get('reason')}")
                    if batch_check.get('expired_ingredients'):
                        lines.append("**过期食材:**")
                        for ing in batch_check['expired_ingredients']:
                            lines.append(f"- {ing.get('name')} (批次: {ing.get('batch_number')}) - 过期: {ing.get('expiry_date')}")
                    lines.append("")

                blocked = dish.get('blocked_children', [])
                assigned = dish.get('assigned_children', [])

                if assigned:
                    lines.append(f"#### ✅ 可分配 ({len(assigned)}人)")
                    for child in assigned:
                        lines.append(f"- {child.get('child_name')} ({child.get('student_id')}, {child.get('class_name')})")
                    lines.append("")

                if blocked:
                    lines.append(f"#### ❌ 禁止分配 ({len(blocked)}人)")
                    for child in blocked:
                        reason = child.get('block_reason', '未知原因')
                        matched = child.get('matched_allergens', [])
                        if matched:
                            reason = f"过敏原冲突: {', '.join(matched)}"
                        lines.append(f"- **{child.get('child_name')}** ({child.get('student_id')}, {child.get('class_name')}) - {reason}")
                    lines.append("")

        lines.append("")
        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)

    @staticmethod
    def generate_block_list_markdown(block_list: List[Dict]) -> str:
        lines = []
        lines.append("# 阻断清单")
        lines.append("")
        
        if not block_list:
            lines.append("当前无阻断记录")
            return "\n".join(lines)

        lines.append(f"共 {len(block_list)} 条阻断记录")
        lines.append("")

        for record in block_list:
            lines.append(f"## {record.get('block_date', '未知日期')} - {record.get('dish_name', '未知菜品')}")
            lines.append("")
            lines.append(f"- **儿童**: {record.get('child_name')} ({record.get('student_id')}, {record.get('class_name')})")
            lines.append(f"- **餐次**: {record.get('meal_type')}")
            lines.append(f"- **阻断原因**: {record.get('reason')}")
            if record.get('allergens_found'):
                lines.append(f"- **发现过敏原**: {record.get('allergens_found')}")
            if record.get('is_substituted'):
                lines.append(f"- **替餐状态**: 已替餐 (申请ID: {record.get('substitution_id')})")
            else:
                lines.append("- **替餐状态**: 未替餐")
            lines.append("")

        lines.append("")
        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)

    @staticmethod
    def generate_audit_log_markdown(audit_logs: List[Dict]) -> str:
        lines = []
        lines.append("# 审计流水")
        lines.append("")
        
        if not audit_logs:
            lines.append("当前无审计记录")
            return "\n".join(lines)

        lines.append(f"共 {len(audit_logs)} 条审计记录")
        lines.append("")

        for log in audit_logs:
            lines.append(f"## [{log.get('timestamp', '未知时间')}] {log.get('action', '未知操作')}")
            lines.append("")
            lines.append(f"- **实体类型**: {log.get('entity_type')}")
            lines.append(f"- **实体ID**: {log.get('entity_id', '无')}")
            lines.append(f"- **操作人**: {log.get('operator', '系统')}")
            if log.get('details'):
                lines.append(f"- **详情**: {log.get('details')}")
            lines.append("")

        lines.append("")
        lines.append("---")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)

    @staticmethod
    def export_children_csv(db: Session) -> str:
        children = db.query(Child).all()
        data = []
        for child in children:
            data.append({
                "ID": child.id,
                "姓名": child.name,
                "学号": child.student_id,
                "班级": child.class_name,
                "过敏原": child.allergens or "",
                "禁忌食材": child.forbidden_foods or "",
                "状态": "活跃" if child.is_active else "禁用",
                "创建时间": child.created_at.strftime("%Y-%m-%d %H:%M:%S") if child.created_at else ""
            })
        
        fieldnames = ["ID", "姓名", "学号", "班级", "过敏原", "禁忌食材", "状态", "创建时间"]
        return ExportService.to_csv(data, fieldnames)

    @staticmethod
    def export_menu_csv(db: Session, menu_date: Optional[date] = None) -> str:
        query = db.query(MenuItem)
        if menu_date:
            query = query.filter(MenuItem.menu_date == menu_date)
        menu_items = query.order_by(MenuItem.menu_date.desc(), MenuItem.meal_type).all()
        
        data = []
        for item in menu_items:
            data.append({
                "ID": item.id,
                "日期": item.menu_date.strftime("%Y-%m-%d") if item.menu_date else "",
                "餐次": item.meal_type,
                "菜品名称": item.dish_name,
                "食材": item.ingredients or "",
                "过敏原提示": item.allergens or "",
                "备注": item.notes or "",
                "创建时间": item.created_at.strftime("%Y-%m-%d %H:%M:%S") if item.created_at else ""
            })
        
        fieldnames = ["ID", "日期", "餐次", "菜品名称", "食材", "过敏原提示", "备注", "创建时间"]
        return ExportService.to_csv(data, fieldnames)

    @staticmethod
    def export_ingredients_csv(db: Session) -> str:
        ingredients = db.query(Ingredient).all()
        data = []
        for ing in ingredients:
            data.append({
                "ID": ing.id,
                "食材名称": ing.name,
                "批次号": ing.batch_number,
                "供应商": ing.supplier or "",
                "生产日期": ing.production_date.strftime("%Y-%m-%d") if ing.production_date else "",
                "有效期至": ing.expiry_date.strftime("%Y-%m-%d") if ing.expiry_date else "",
                "过敏原": ing.allergens or "",
                "配料表": ing.ingredients_list or "",
                "状态": ing.status.value if ing.status else "",
                "召回原因": ing.recall_reason or "",
                "创建时间": ing.created_at.strftime("%Y-%m-%d %H:%M:%S") if ing.created_at else ""
            })
        
        fieldnames = ["ID", "食材名称", "批次号", "供应商", "生产日期", "有效期至", "过敏原", "配料表", "状态", "召回原因", "创建时间"]
        return ExportService.to_csv(data, fieldnames)

    @staticmethod
    def export_substitutions_csv(db: Session) -> str:
        substitutions = db.query(SubstitutionRequest).order_by(
            SubstitutionRequest.created_at.desc()
        ).all()
        
        data = []
        for req in substitutions:
            child = db.query(Child).get(req.child_id)
            data.append({
                "ID": req.id,
                "儿童姓名": child.name if child else "未知",
                "学号": child.student_id if child else "未知",
                "申请日期": req.request_date.strftime("%Y-%m-%d") if req.request_date else "",
                "原菜品": req.original_dish,
                "替餐菜品": req.substitution_dish or "",
                "申请原因": req.reason,
                "状态": req.status.value if req.status else "",
                "审批人": req.approver or "",
                "审批备注": req.approval_notes or "",
                "创建时间": req.created_at.strftime("%Y-%m-%d %H:%M:%S") if req.created_at else ""
            })
        
        fieldnames = ["ID", "儿童姓名", "学号", "申请日期", "原菜品", "替餐菜品", "申请原因", "状态", "审批人", "审批备注", "创建时间"]
        return ExportService.to_csv(data, fieldnames)

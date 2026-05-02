import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from src.storage.database import DAOFactory
from src.models.models import (
    Team, Material, BorrowRecord, BorrowItem,
    ReturnRecord, ReturnItem, DamageRecord, AnomalyRecord,
    AuditLog, MaterialStatus, ReturnStatus
)


@dataclass
class ExportResult:
    success: bool
    output_path: str = ""
    records_count: int = 0
    errors: List[str] = None
    
    def __post_init__(self):
        if self.errors is None:
            self.errors = []


class MarkdownExporter:
    def __init__(self):
        self.dao_factory = DAOFactory
    
    def export_settlement_by_team(
        self,
        team_id: int,
        output_path: str
    ) -> ExportResult:
        result = ExportResult(success=False)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        team_dao = self.dao_factory.get_team_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        return_dao = self.dao_factory.get_return_record_dao()
        return_item_dao = self.dao_factory.get_return_item_dao()
        damage_dao = self.dao_factory.get_damage_record_dao()
        anomaly_dao = self.dao_factory.get_anomaly_record_dao()
        
        try:
            team = team_dao.get_by_id(team_id)
            if not team:
                result.errors.append(f"队伍 ID {team_id} 不存在")
                return result
            
            borrow_records = borrow_dao.get_by_team(team_id)
            
            markdown_content = self._generate_settlement_markdown(
                team=team,
                borrow_records=borrow_records,
                borrow_item_dao=borrow_item_dao,
                return_dao=return_dao,
                return_item_dao=return_item_dao,
                damage_dao=damage_dao,
                anomaly_dao=anomaly_dao
            )
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(markdown_content)
            
            result.success = True
            result.output_path = str(path)
            result.records_count = len(borrow_records)
            return result
            
        except Exception as e:
            result.errors.append(f"导出失败: {str(e)}")
            return result
    
    def _generate_settlement_markdown(
        self,
        team: Team,
        borrow_records: List[BorrowRecord],
        borrow_item_dao,
        return_dao,
        return_item_dao,
        damage_dao,
        anomaly_dao
    ) -> str:
        material_dao = self.dao_factory.get_material_dao()
        
        lines = []
        lines.append("# 物资回收结算单")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 基本信息")
        lines.append("")
        lines.append(f"| 项目 | 内容 |")
        lines.append(f"|------|------|")
        lines.append(f"| 队伍编号 | {team.team_code} |")
        lines.append(f"| 队伍名称 | {team.team_name} |")
        lines.append(f"| 摊位号 | {team.booth_number or '-'} |")
        lines.append(f"| 联系人 | {team.contact_person or '-'} |")
        lines.append(f"| 联系电话 | {team.contact_phone or '-'} |")
        lines.append("")
        
        total_borrowed = 0
        total_returned = 0
        total_deposit = 0.0
        total_damage_cost = 0.0
        
        for borrow_record in borrow_records:
            borrow_items = borrow_item_dao.get_by_borrow_record(borrow_record.id)
            return_records = return_dao.get_by_borrow_record(borrow_record.id)
            
            borrowed_count = sum(item.quantity for item in borrow_items)
            returned_count = sum(item.returned_quantity for item in borrow_items)
            
            total_borrowed += borrowed_count
            total_returned += returned_count
            total_deposit += borrow_record.deposit_amount or 0.0
            
            for ret_record in return_records:
                damages = damage_dao.get_by_return_record(ret_record.id)
                for damage in damages:
                    total_damage_cost += damage.estimated_cost or 0.0
        
        lines.append("## 汇总统计")
        lines.append("")
        lines.append(f"| 统计项 | 数值 |")
        lines.append(f"|--------|------|")
        lines.append(f"| 借出记录数 | {len(borrow_records)} |")
        lines.append(f"| 总借出物资数 | {total_borrowed} |")
        lines.append(f"| 已归还物资数 | {total_returned} |")
        lines.append(f"| 未归还物资数 | {total_borrowed - total_returned} |")
        lines.append(f"| 总押金金额 | ¥{total_deposit:.2f} |")
        lines.append(f"| 破损预估费用 | ¥{total_damage_cost:.2f} |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 借出记录详情")
        lines.append("")
        
        for idx, borrow_record in enumerate(borrow_records, 1):
            lines.append(f"### 借出记录 {idx}: {borrow_record.borrow_code}")
            lines.append("")
            lines.append(f"- 借出时间: {borrow_record.borrow_date.strftime('%Y-%m-%d %H:%M')}")
            lines.append(f"- 预计归还: {borrow_record.expected_return_date.strftime('%Y-%m-%d %H:%M') if borrow_record.expected_return_date else '-'}")
            lines.append(f"- 押金金额: ¥{borrow_record.deposit_amount:.2f}")
            lines.append(f"- 押金条编号: {borrow_record.deposit_slip_code or '-'}")
            lines.append(f"- 借出人: {borrow_record.borrower_name or '-'}")
            lines.append(f"- 状态: **{borrow_record.status.value}**")
            lines.append("")
            
            borrow_items = borrow_item_dao.get_by_borrow_record(borrow_record.id)
            if borrow_items:
                lines.append("#### 借出物资")
                lines.append("")
                lines.append("| 条形码 | 物资名称 | 类型 | 借出数量 | 已归还数量 | 状态 |")
                lines.append("|--------|----------|------|----------|------------|------|")
                for item in borrow_items:
                    material = material_dao.get_by_id(item.material_id)
                    if material:
                        status = "已归还" if item.is_returned else "未归还"
                        lines.append(f"| {material.barcode} | {material.material_name} | {material.material_type} | {item.quantity} | {item.returned_quantity} | {status} |")
                lines.append("")
            
            return_records = return_dao.get_by_borrow_record(borrow_record.id)
            if return_records:
                lines.append("#### 归还记录")
                lines.append("")
                for ret_idx, ret_record in enumerate(return_records, 1):
                    lines.append(f"##### 归还 {ret_idx}: {ret_record.return_code}")
                    lines.append("")
                    lines.append(f"- 归还时间: {ret_record.return_date.strftime('%Y-%m-%d %H:%M')}")
                    lines.append(f"- 总重量: {ret_record.total_weight_kg} kg")
                    lines.append(f"- 实退押金: ¥{ret_record.deposit_returned:.2f}")
                    lines.append(f"- 接收人: {ret_record.receiver_name or '-'}")
                    lines.append("")
                    
                    return_items = return_item_dao.get_by_return_record(ret_record.id)
                    if return_items:
                        lines.append("| 条形码 | 物资名称 | 归还数量 | 重量(kg) | 破损 | 备注 |")
                        lines.append("|--------|----------|----------|----------|------|------|")
                        for ret_item in return_items:
                            material = material_dao.get_by_id(ret_item.material_id)
                            if material:
                                damage = "是" if ret_item.has_damage else "否"
                                lines.append(f"| {material.barcode} | {material.material_name} | {ret_item.quantity} | {ret_item.weight_kg} | {damage} | {ret_item.remarks or '-'} |")
                        lines.append("")
                    
                    damages = damage_dao.get_by_return_record(ret_record.id)
                    if damages:
                        lines.append("###### 破损记录")
                        lines.append("")
                        lines.append("| 物资名称 | 破损类型 | 描述 | 预估费用 | 责任人 |")
                        lines.append("|----------|----------|------|----------|--------|")
                        for damage in damages:
                            material = material_dao.get_by_id(damage.material_id)
                            mat_name = material.material_name if material else "未知"
                            lines.append(f"| {mat_name} | {damage.damage_type or '-'} | {damage.damage_description} | ¥{damage.estimated_cost:.2f} | {damage.responsible_person or '-'} |")
                        lines.append("")
            
            lines.append("---")
            lines.append("")
        
        anomalies = anomaly_dao.get_by_team(team_id)
        if anomalies:
            lines.append("## 异常记录")
            lines.append("")
            lines.append("| 类型 | 描述 | 状态 | 创建时间 |")
            lines.append("|------|------|------|----------|")
            for anomaly in anomalies:
                status = "已解决" if anomaly.is_resolved else "未解决"
                lines.append(f"| {anomaly.anomaly_type} | {anomaly.description} | {status} | {anomaly.created_at.strftime('%Y-%m-%d %H:%M')} |")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本结算单由系统自动生成，如有疑问请联系后勤组*")
        
        return "\n".join(lines)


class CSVExporter:
    def __init__(self):
        self.dao_factory = DAOFactory
    
    def export_anomalies(self, output_path: str, only_unresolved: bool = False) -> ExportResult:
        result = ExportResult(success=False)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        anomaly_dao = self.dao_factory.get_anomaly_record_dao()
        team_dao = self.dao_factory.get_team_dao()
        
        try:
            if only_unresolved:
                anomalies = anomaly_dao.get_unresolved()
            else:
                anomalies = anomaly_dao.get_all()
            
            with open(path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    'ID', '异常类型', '队伍编号', '队伍名称', '借出编号', '归还编号',
                    '描述', '状态', '解决人', '解决时间', '创建时间', '备注'
                ])
                
                for anomaly in anomalies:
                    team = team_dao.get_by_id(anomaly.team_id) if anomaly.team_id else None
                    
                    writer.writerow([
                        anomaly.id,
                        anomaly.anomaly_type,
                        team.team_code if team else '-',
                        team.team_name if team else '-',
                        anomaly.borrow_record_id or '-',
                        anomaly.return_record_id or '-',
                        anomaly.description,
                        '已解决' if anomaly.is_resolved else '未解决',
                        anomaly.resolved_by or '-',
                        anomaly.resolved_at.strftime('%Y-%m-%d %H:%M') if anomaly.resolved_at else '-',
                        anomaly.created_at.strftime('%Y-%m-%d %H:%M'),
                        anomaly.remarks or '-'
                    ])
            
            result.success = True
            result.output_path = str(path)
            result.records_count = len(anomalies)
            return result
            
        except Exception as e:
            result.errors.append(f"导出失败: {str(e)}")
            return result
    
    def export_return_summary(self, output_path: str) -> ExportResult:
        result = ExportResult(success=False)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        return_dao = self.dao_factory.get_return_record_dao()
        team_dao = self.dao_factory.get_team_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        
        try:
            return_records = return_dao.get_all()
            
            with open(path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                writer.writerow([
                    '归还编号', '队伍编号', '队伍名称', '借出编号', '归还时间',
                    '总重量(kg)', '实退押金', '接收人', '状态', '备注'
                ])
                
                for ret_record in return_records:
                    team = team_dao.get_by_id(ret_record.team_id)
                    borrow = borrow_dao.get_by_id(ret_record.borrow_record_id)
                    
                    writer.writerow([
                        ret_record.return_code,
                        team.team_code if team else '-',
                        team.team_name if team else '-',
                        borrow.borrow_code if borrow else '-',
                        ret_record.return_date.strftime('%Y-%m-%d %H:%M'),
                        ret_record.total_weight_kg,
                        ret_record.deposit_returned,
                        ret_record.receiver_name or '-',
                        ret_record.status.value,
                        ret_record.remarks or '-'
                    ])
            
            result.success = True
            result.output_path = str(path)
            result.records_count = len(return_records)
            return result
            
        except Exception as e:
            result.errors.append(f"导出失败: {str(e)}")
            return result


class JSONExporter:
    def __init__(self):
        self.dao_factory = DAOFactory
    
    def export_audit_package(self, output_path: str) -> ExportResult:
        result = ExportResult(success=False)
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        team_dao = self.dao_factory.get_team_dao()
        material_dao = self.dao_factory.get_material_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        return_dao = self.dao_factory.get_return_record_dao()
        return_item_dao = self.dao_factory.get_return_item_dao()
        damage_dao = self.dao_factory.get_damage_record_dao()
        anomaly_dao = self.dao_factory.get_anomaly_record_dao()
        audit_dao = self.dao_factory.get_audit_log_dao()
        
        try:
            audit_package = {
                "package_info": {
                    "export_time": datetime.now().isoformat(),
                    "version": "1.0.0",
                    "description": "物资回收审计包"
                },
                "teams": [],
                "materials": [],
                "borrow_records": [],
                "return_records": [],
                "damage_records": [],
                "anomaly_records": [],
                "audit_logs": []
            }
            
            teams = team_dao.get_all()
            for team in teams:
                audit_package["teams"].append({
                    "id": team.id,
                    "team_code": team.team_code,
                    "team_name": team.team_name,
                    "booth_number": team.booth_number,
                    "contact_person": team.contact_person,
                    "contact_phone": team.contact_phone,
                    "created_at": team.created_at.isoformat() if team.created_at else None
                })
            
            materials = material_dao.get_all()
            for material in materials:
                audit_package["materials"].append({
                    "id": material.id,
                    "barcode": material.barcode,
                    "material_type": material.material_type,
                    "material_name": material.material_name,
                    "specification": material.specification,
                    "weight_kg": material.weight_kg,
                    "status": material.status.value,
                    "description": material.description
                })
            
            borrow_records = borrow_dao.get_all()
            for borrow in borrow_records:
                items = borrow_item_dao.get_by_borrow_record(borrow.id)
                audit_package["borrow_records"].append({
                    "id": borrow.id,
                    "borrow_code": borrow.borrow_code,
                    "team_id": borrow.team_id,
                    "borrow_date": borrow.borrow_date.isoformat() if borrow.borrow_date else None,
                    "expected_return_date": borrow.expected_return_date.isoformat() if borrow.expected_return_date else None,
                    "deposit_amount": borrow.deposit_amount,
                    "deposit_slip_code": borrow.deposit_slip_code,
                    "borrower_name": borrow.borrower_name,
                    "status": borrow.status.value,
                    "items": [{
                        "material_id": item.material_id,
                        "quantity": item.quantity,
                        "returned_quantity": item.returned_quantity,
                        "is_returned": item.is_returned
                    } for item in items]
                })
            
            return_records = return_dao.get_all()
            for ret in return_records:
                items = return_item_dao.get_by_return_record(ret.id)
                audit_package["return_records"].append({
                    "id": ret.id,
                    "return_code": ret.return_code,
                    "borrow_record_id": ret.borrow_record_id,
                    "team_id": ret.team_id,
                    "return_date": ret.return_date.isoformat() if ret.return_date else None,
                    "total_weight_kg": ret.total_weight_kg,
                    "deposit_returned": ret.deposit_returned,
                    "is_deposit_settled": ret.is_deposit_settled,
                    "receiver_name": ret.receiver_name,
                    "status": ret.status.value,
                    "items": [{
                        "material_id": item.material_id,
                        "quantity": item.quantity,
                        "weight_kg": item.weight_kg,
                        "has_damage": item.has_damage,
                        "remarks": item.remarks
                    } for item in items]
                })
            
            damages = damage_dao.get_all()
            for damage in damages:
                audit_package["damage_records"].append({
                    "id": damage.id,
                    "return_record_id": damage.return_record_id,
                    "material_id": damage.material_id,
                    "damage_type": damage.damage_type,
                    "damage_description": damage.damage_description,
                    "photo_path": damage.photo_path,
                    "responsible_person": damage.responsible_person,
                    "estimated_cost": damage.estimated_cost,
                    "is_approved": damage.is_approved,
                    "created_at": damage.created_at.isoformat() if damage.created_at else None
                })
            
            anomalies = anomaly_dao.get_all()
            for anomaly in anomalies:
                audit_package["anomaly_records"].append({
                    "id": anomaly.id,
                    "anomaly_type": anomaly.anomaly_type,
                    "borrow_record_id": anomaly.borrow_record_id,
                    "return_record_id": anomaly.return_record_id,
                    "material_id": anomaly.material_id,
                    "team_id": anomaly.team_id,
                    "description": anomaly.description,
                    "is_resolved": anomaly.is_resolved,
                    "resolved_by": anomaly.resolved_by,
                    "resolved_at": anomaly.resolved_at.isoformat() if anomaly.resolved_at else None,
                    "created_at": anomaly.created_at.isoformat() if anomaly.created_at else None
                })
            
            audit_logs = audit_dao.get_recent(limit=1000)
            for log in audit_logs:
                audit_package["audit_logs"].append({
                    "id": log.id,
                    "operation_type": log.operation_type,
                    "entity_type": log.entity_type,
                    "entity_id": log.entity_id,
                    "operation_data": log.operation_data,
                    "before_data": log.before_data,
                    "after_data": log.after_data,
                    "operator": log.operator,
                    "is_undone": log.is_undone,
                    "created_at": log.created_at.isoformat() if log.created_at else None
                })
            
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(audit_package, f, ensure_ascii=False, indent=2)
            
            result.success = True
            result.output_path = str(path)
            result.records_count = (
                len(audit_package["teams"]) +
                len(audit_package["materials"]) +
                len(audit_package["borrow_records"]) +
                len(audit_package["return_records"])
            )
            return result
            
        except Exception as e:
            result.errors.append(f"导出失败: {str(e)}")
            return result


def get_markdown_exporter() -> MarkdownExporter:
    return MarkdownExporter()


def get_csv_exporter() -> CSVExporter:
    return CSVExporter()


def get_json_exporter() -> JSONExporter:
    return JSONExporter()

from typing import Optional, Dict, Any
from datetime import datetime
import json
import hashlib
import uuid

from models.case import Case
from .base_exporter import BaseExporter, ExportResult


class JSONAuditExporter(BaseExporter):
    """
    JSON审计包导出器
    导出完整的审计信息，包含所有数据和操作历史
    """
    
    def __init__(self):
        super().__init__()
    
    def export(self, case: Case, output_path: str = None) -> ExportResult:
        """
        导出JSON审计包
        
        Args:
            case: 病例对象
            output_path: 输出文件路径
            
        Returns:
            导出结果
        """
        self.result = ExportResult()
        
        try:
            # 生成默认文件名
            if output_path is None:
                output_path = self._generate_default_filename(case, "audit.json")
            
            # 确保输出目录存在
            output_path_obj = self._ensure_output_dir(output_path)
            
            # 生成审计包
            audit_package = self._generate_audit_package(case)
            
            # 写入文件
            with open(output_path_obj, 'w', encoding='utf-8') as f:
                json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)
            
            # 设置结果
            self.result.file_path = str(output_path_obj)
            self.result.file_size = self._get_file_size(str(output_path_obj))
            
        except Exception as e:
            self.result.add_error(f"导出JSON审计包失败: {str(e)}")
        
        return self.result
    
    def _generate_audit_package(self, case: Case) -> Dict[str, Any]:
        """
        生成审计包
        """
        export_time = datetime.now()
        
        # 计算数据哈希用于完整性验证
        case_dict = case.to_dict()
        data_hash = self._calculate_hash(json.dumps(case_dict, ensure_ascii=False, sort_keys=True))
        
        # 构建审计包
        audit_package = {
            # 元数据
            "metadata": {
                "version": "1.0",
                "export_time": export_time.isoformat(),
                "export_id": str(uuid.uuid4()),
                "data_hash": data_hash,
                "hash_algorithm": "SHA-256"
            },
            
            # 病例基本信息
            "case_info": {
                "case_id": case.case_id,
                "patient_name": case.patient_name,
                "patient_id": case.patient_id,
                "species": case.species,
                "breed": case.breed,
                "age": case.age,
                "weight": case.weight,
                "procedure": case.procedure,
                "anesthesiologist": case.anesthesiologist,
                "status": case.status.value if case.status else None,
                "created_at": case.created_at.isoformat() if case.created_at else None,
                "updated_at": case.updated_at.isoformat() if case.updated_at else None,
                "notes": case.notes
            },
            
            # 时间范围
            "time_range": {},
            
            # 生命体征数据
            "vital_signs": None,
            
            # 给药记录
            "medications": None,
            
            # 风险数据
            "risks": [],
            
            # 复核记录
            "review_history": [],
            
            # 统计信息
            "statistics": {},
            
            # 导出摘要
            "summary": {}
        }
        
        # 添加时间范围
        start_time, end_time = case.get_time_range()
        if start_time and end_time:
            audit_package["time_range"] = {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_minutes": (end_time - start_time).total_seconds() / 60
            }
        
        # 添加生命体征数据
        if case.vital_signs:
            audit_package["vital_signs"] = {
                "case_id": case.vital_signs.case_id,
                "patient_id": case.vital_signs.patient_id,
                "patient_name": case.vital_signs.patient_name,
                "species": case.vital_signs.species,
                "breed": case.vital_signs.breed,
                "age": case.vital_signs.age,
                "weight": case.vital_signs.weight,
                "procedure": case.vital_signs.procedure,
                "anesthesiologist": case.vital_signs.anesthesiologist,
                "start_time": case.vital_signs.start_time.isoformat() if case.vital_signs.start_time else None,
                "end_time": case.vital_signs.end_time.isoformat() if case.vital_signs.end_time else None,
                "record_count": len(case.vital_signs.records),
                "records": [record.to_dict() for record in case.vital_signs.records]
            }
        
        # 添加给药记录
        if case.medication:
            audit_package["medications"] = {
                "case_id": case.medication.case_id,
                "record_count": len(case.medication.records),
                "records": [record.to_dict() for record in case.medication.records]
            }
        
        # 添加风险数据
        for risk in case.risks:
            audit_package["risks"].append(risk.to_dict())
        
        # 添加复核记录
        if case.review:
            audit_package["review_history"] = {
                "case_id": case.review.case_id,
                "record_count": len(case.review.records),
                "records": [record.to_dict() for record in case.review.records]
            }
        
        # 添加统计信息
        audit_package["statistics"] = self._generate_statistics(case)
        
        # 添加摘要
        audit_package["summary"] = self._generate_summary(case)
        
        return audit_package
    
    def _generate_statistics(self, case: Case) -> Dict[str, Any]:
        """
        生成统计信息
        """
        stats = {
            "vital_signs": {
                "total_records": 0,
                "parameters_available": []
            },
            "medications": {
                "total_records": 0,
                "by_type": {},
                "by_route": {}
            },
            "risks": {
                "total": 0,
                "by_status": {
                    "PENDING": 0,
                    "CONFIRMED": 0,
                    "DISMISSED": 0
                },
                "by_severity": {
                    "MILD": 0,
                    "MODERATE": 0,
                    "SEVERE": 0,
                    "CRITICAL": 0
                },
                "by_type": {}
            },
            "review": {
                "total_actions": 0,
                "by_action": {}
            }
        }
        
        # 生命体征统计
        if case.vital_signs and case.vital_signs.records:
            stats["vital_signs"]["total_records"] = len(case.vital_signs.records)
            
            # 检测可用的参数
            params = set()
            for record in case.vital_signs.records:
                if record.heart_rate is not None:
                    params.add("heart_rate")
                if record.systolic_bp is not None or record.diastolic_bp is not None:
                    params.add("blood_pressure")
                if record.spo2 is not None:
                    params.add("spo2")
                if record.temperature is not None:
                    params.add("temperature")
                if record.respiratory_rate is not None:
                    params.add("respiratory_rate")
                if record.etco2 is not None:
                    params.add("etco2")
            
            stats["vital_signs"]["parameters_available"] = list(params)
        
        # 给药记录统计
        if case.medication and case.medication.records:
            stats["medications"]["total_records"] = len(case.medication.records)
            
            for record in case.medication.records:
                # 按类型统计
                type_code = record.medication_type.name
                if type_code not in stats["medications"]["by_type"]:
                    stats["medications"]["by_type"][type_code] = 0
                stats["medications"]["by_type"][type_code] += 1
                
                # 按途径统计
                route_code = record.route.name
                if route_code not in stats["medications"]["by_route"]:
                    stats["medications"]["by_route"][route_code] = 0
                stats["medications"]["by_route"][route_code] += 1
        
        # 风险统计
        for risk in case.risks:
            stats["risks"]["total"] += 1
            
            # 按状态
            status_code = risk.status.name
            if status_code in stats["risks"]["by_status"]:
                stats["risks"]["by_status"][status_code] += 1
            
            # 按严重程度
            severity_code = risk.severity.name
            if severity_code in stats["risks"]["by_severity"]:
                stats["risks"]["by_severity"][severity_code] += 1
            
            # 按类型
            type_code = risk.risk_type.name
            if type_code not in stats["risks"]["by_type"]:
                stats["risks"]["by_type"][type_code] = 0
            stats["risks"]["by_type"][type_code] += 1
        
        # 复核统计
        if case.review and case.review.records:
            stats["review"]["total_actions"] = len(case.review.records)
            
            for record in case.review.records:
                action_code = record.action.name
                if action_code not in stats["review"]["by_action"]:
                    stats["review"]["by_action"][action_code] = 0
                stats["review"]["by_action"][action_code] += 1
        
        return stats
    
    def _generate_summary(self, case: Case) -> Dict[str, Any]:
        """
        生成摘要信息
        """
        summary = {
            "case_overview": "",
            "key_findings": [],
            "risk_highlights": [],
            "review_status": "",
            "recommendations": []
        }
        
        # 病例概述
        overview_parts = []
        if case.patient_name:
            overview_parts.append(f"患者: {case.patient_name}")
        if case.species:
            overview_parts.append(f"物种: {case.species}")
        if case.procedure:
            overview_parts.append(f"手术/操作: {case.procedure}")
        
        summary["case_overview"] = "，".join(overview_parts) if overview_parts else "无详细信息"
        
        # 关键发现
        if case.risks:
            critical_risks = [r for r in case.risks if r.severity.name in ["SEVERE", "CRITICAL"]]
            if critical_risks:
                summary["key_findings"].append(f"检测到 {len(critical_risks)} 个严重/危急风险")
            
            confirmed_risks = [r for r in case.risks if r.status.name == "CONFIRMED"]
            if confirmed_risks:
                summary["key_findings"].append(f"已确认 {len(confirmed_risks)} 个风险")
        
        # 风险亮点
        for risk in case.risks[:5]:  # 只显示前5个
            summary["risk_highlights"].append({
                "type": risk.risk_type.value,
                "severity": risk.severity.value,
                "status": risk.status.value,
                "description": risk.description[:100] + "..." if len(risk.description) > 100 else risk.description
            })
        
        # 复核状态
        total_risks = len(case.risks)
        pending = len([r for r in case.risks if r.status.name == "PENDING"])
        confirmed = len([r for r in case.risks if r.status.name == "CONFIRMED"])
        dismissed = len([r for r in case.risks if r.status.name == "DISMISSED"])
        
        if total_risks == 0:
            summary["review_status"] = "无风险待复核"
        elif pending == 0:
            summary["review_status"] = f"复核完成: 已确认{confirmed}个, 已驳回{dismissed}个"
        else:
            summary["review_status"] = f"复核中: 待复核{pending}个, 已确认{confirmed}个, 已驳回{dismissed}个"
        
        # 建议
        unique_recommendations = set()
        for risk in case.risks:
            if risk.status.name == "CONFIRMED" and risk.recommendation:
                unique_recommendations.add(risk.recommendation)
        
        summary["recommendations"] = list(unique_recommendations)[:10]  # 最多显示10条
        
        return summary
    
    def _calculate_hash(self, data: str) -> str:
        """
        计算数据哈希
        """
        return hashlib.sha256(data.encode('utf-8')).hexdigest()

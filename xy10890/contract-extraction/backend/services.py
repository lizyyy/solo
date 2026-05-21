import asyncio
import json
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
import uuid

from models import Contract, Clause, ContractStatus, RiskLevel
from schemas import ClauseCreate
from crud import (
    create_clause, update_contract_status, add_timeline_event,
    get_contract, get_clauses_by_contract
)
from config import settings


class ExtractionService:
    @staticmethod
    async def extract_clauses_async(contract_id: int, db: Session):
        try:
            contract = get_contract(db, contract_id)
            if not contract:
                return
            
            contract.status = ContractStatus.EXTRACTING
            db.commit()
            
            await asyncio.sleep(3)
            
            mock_clauses = [
                ClauseCreate(
                    clause_title="合同主体",
                    original_text="甲方：XX科技有限公司，乙方：YY贸易有限公司",
                    extracted_text="甲方：XX科技有限公司，乙方：YY贸易有限公司",
                    risk_level=RiskLevel.LOW,
                    confidence_score=0.95
                ),
                ClauseCreate(
                    clause_title="付款条款",
                    original_text="乙方应在收到货物后30日内支付全部货款，逾期按每日0.1%支付违约金",
                    extracted_text="付款期限：收货后30日内，违约金：每日0.1%",
                    risk_level=RiskLevel.MEDIUM,
                    risk_reason="违约金比例较高",
                    confidence_score=0.88
                ),
                ClauseCreate(
                    clause_title="违约责任",
                    original_text="任何一方违约，应向对方支付合同总金额20%的违约金，并承担由此造成的全部损失",
                    extracted_text="违约金比例：合同总金额的20%",
                    risk_level=RiskLevel.HIGH,
                    risk_reason="违约金比例过高，可能存在不合理风险",
                    confidence_score=0.92
                ),
                ClauseCreate(
                    clause_title="保密条款",
                    original_text="双方应对合同内容及商业秘密严格保密，保密期限为合同终止后5年",
                    extracted_text="保密期限：合同终止后5年",
                    risk_level=RiskLevel.LOW,
                    confidence_score=0.98
                ),
            ]
            
            for clause_data in mock_clauses:
                create_clause(db, contract_id, clause_data)
            
            from crud import recalculate_contract_overall_risk, create_contract_version
            
            contract.status = ContractStatus.EXTRACTED
            contract.extracted_at = datetime.now()
            db.commit()
            db.refresh(contract)
            
            recalculate_contract_overall_risk(db, contract_id)
            db.refresh(contract)
            
            create_contract_version(db, contract, None, "抽取完成")
            
            add_timeline_event(db, contract_id, "extraction_completed",
                              json.dumps({"clause_count": len(mock_clauses)}))
            
        except Exception as e:
            contract = get_contract(db, contract_id)
            if contract:
                contract.status = ContractStatus.FAILED
                contract.error_message = str(e)
                db.commit()
                add_timeline_event(db, contract_id, "extraction_failed",
                                  json.dumps({"error": str(e)}))
            raise
    
    @staticmethod
    def _calculate_overall_risk(clauses: List[ClauseCreate]) -> RiskLevel:
        risk_scores = {
            RiskLevel.LOW: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.HIGH: 3,
            RiskLevel.CRITICAL: 4
        }
        
        if not clauses:
            return RiskLevel.LOW
        
        max_risk = max(risk_scores[c.risk_level] for c in clauses)
        for level, score in risk_scores.items():
            if score == max_risk:
                return level
        
        return RiskLevel.LOW


class ExportService:
    @staticmethod
    def export_contracts(db: Session, contract_ids: List[int], export_format: str = "excel",
                        include_clauses: bool = True, include_revisions: bool = False) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"contracts_export_{timestamp}.{export_format}"
        export_path = settings.EXPORT_DIR / filename
        
        settings.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        
        contracts_data = []
        for contract_id in contract_ids:
            contract = get_contract(db, contract_id)
            if not contract:
                continue
            
            contract_data = {
                "合同ID": contract.id,
                "文件名": contract.filename,
                "合同名称": contract.contract_name,
                "甲方": contract.party_a,
                "乙方": contract.party_b,
                "状态": contract.status.value,
                "整体风险": contract.overall_risk.value,
                "创建时间": contract.created_at.strftime("%Y-%m-%d %H:%M:%S") if contract.created_at else None
            }
            
            if include_clauses:
                clauses = get_clauses_by_contract(db, contract_id)
                for i, clause in enumerate(clauses, 1):
                    contract_data[f"条款{i}_标题"] = clause.clause_title
                    contract_data[f"条款{i}_原文"] = clause.original_text
                    contract_data[f"条款{i}_抽取内容"] = clause.extracted_text
                    contract_data[f"条款{i}_修订内容"] = clause.revised_text
                    contract_data[f"条款{i}_风险等级"] = clause.risk_level.value
                    contract_data[f"条款{i}_风险原因"] = clause.risk_reason
            
            contracts_data.append(contract_data)
        
        df = pd.DataFrame(contracts_data)
        
        if export_format == "excel":
            df.to_excel(export_path, index=False, engine="openpyxl")
        elif export_format == "csv":
            df.to_csv(export_path, index=False, encoding="utf-8-sig")
        elif export_format == "json":
            df.to_json(export_path, orient="records", force_ascii=False, indent=2)
        else:
            raise ValueError(f"Unsupported export format: {export_format}")
        
        return str(export_path)


class DataCleanupService:
    @staticmethod
    def validate_contract_data(contract_data: Dict[str, Any]) -> List[str]:
        errors = []
        
        if not contract_data.get("filename"):
            errors.append("文件名不能为空")
        
        if contract_data.get("file_size") and contract_data["file_size"] > 50 * 1024 * 1024:
            errors.append("文件大小不能超过50MB")
        
        if contract_data.get("party_a") and len(contract_data["party_a"]) > 255:
            errors.append("甲方名称过长")
        
        if contract_data.get("party_b") and len(contract_data["party_b"]) > 255:
            errors.append("乙方名称过长")
        
        return errors
    
    @staticmethod
    def validate_clause_data(clause_data: Dict[str, Any]) -> List[str]:
        errors = []
        
        if not clause_data.get("original_text"):
            errors.append("条款原文不能为空")
        
        if clause_data.get("confidence_score") is not None:
            score = clause_data["confidence_score"]
            if not (0 <= score <= 1):
                errors.append("置信度分数必须在0-1之间")
        
        return errors
    
    @staticmethod
    def sanitize_text(text: Optional[str]) -> Optional[str]:
        if not text:
            return None
        
        text = text.strip()
        text = text.replace("\x00", "")
        text = text.replace("\r\n", "\n")
        text = text.replace("\r", "\n")
        
        return text if text else None


class VersionCompareService:
    @staticmethod
    def _get_clause_text(clause_data: Any) -> str:
        if isinstance(clause_data, dict):
            return clause_data.get("revised_text") or clause_data.get("extracted_text") or ""
        return clause_data.revised_text or clause_data.extracted_text or ""

    @staticmethod
    def _get_clause_title(clause_data: Any) -> str:
        if isinstance(clause_data, dict):
            return clause_data.get("clause_title") or ""
        return clause_data.clause_title or ""

    @staticmethod
    def compare_contract_versions(clauses_v1: List[Any], clauses_v2: List[Any]) -> Dict[str, Any]:
        changes = {
            "added": [],
            "removed": [],
            "modified": []
        }
        
        v1_titles = {VersionCompareService._get_clause_title(c): c for c in clauses_v1 if VersionCompareService._get_clause_title(c)}
        v2_titles = {VersionCompareService._get_clause_title(c): c for c in clauses_v2 if VersionCompareService._get_clause_title(c)}
        
        for title in v2_titles:
            if title not in v1_titles:
                changes["added"].append({"title": title, "clause": v2_titles[title]})
            elif VersionCompareService._get_clause_text(v1_titles[title]) != VersionCompareService._get_clause_text(v2_titles[title]):
                changes["modified"].append({
                    "title": title,
                    "old_text": VersionCompareService._get_clause_text(v1_titles[title]),
                    "new_text": VersionCompareService._get_clause_text(v2_titles[title])
                })
        
        for title in v1_titles:
            if title not in v2_titles:
                changes["removed"].append({"title": title, "clause": v1_titles[title]})
        
        return changes

    @staticmethod
    def get_version_clauses_snapshot(db: Session, contract_id: int, version_number: int) -> List[Dict[str, Any]]:
        from models import ContractVersion
        
        version = db.query(ContractVersion).filter(
            ContractVersion.contract_id == contract_id,
            ContractVersion.version_number == version_number
        ).first()
        
        if not version:
            return []
        
        return version.clauses_snapshot or []

    @staticmethod
    def compare_versions_by_number(db: Session, contract_id: int, version_a: int, version_b: int) -> Dict[str, Any]:
        from models import ContractVersion
        
        contract = get_contract(db, contract_id)
        if not contract:
            raise ValueError("合同不存在")
        
        v1 = db.query(ContractVersion).filter(
            ContractVersion.contract_id == contract_id,
            ContractVersion.version_number == version_a
        ).first()
        
        v2 = db.query(ContractVersion).filter(
            ContractVersion.contract_id == contract_id,
            ContractVersion.version_number == version_b
        ).first()
        
        if not v1 or not v2:
            raise ValueError("指定的版本不存在")
        
        clauses_v1 = v1.clauses_snapshot or []
        clauses_v2 = v2.clauses_snapshot or []
        changes = VersionCompareService.compare_contract_versions(clauses_v1, clauses_v2)
        
        contract_changes = {}
        if v1.status != v2.status:
            contract_changes["status"] = {
                "old": v1.status.value,
                "new": v2.status.value
            }
        if v1.overall_risk != v2.overall_risk:
            contract_changes["overall_risk"] = {
                "old": v1.overall_risk.value,
                "new": v2.overall_risk.value
            }
        if v1.change_log:
            contract_changes["change_log"] = v2.change_log
        
        return {
            "contract_id": contract_id,
            "version_a": version_a,
            "version_b": version_b,
            "added_clauses": [
                {
                    "clause_title": c["title"],
                    "new_text": VersionCompareService._get_clause_text(c["clause"]),
                    "change_type": "added"
                }
                for c in changes["added"]
            ],
            "removed_clauses": [
                {
                    "clause_title": c["title"],
                    "old_text": VersionCompareService._get_clause_text(c["clause"]),
                    "change_type": "removed"
                }
                for c in changes["removed"]
            ],
            "modified_clauses": [
                {
                    "clause_title": c["title"],
                    "old_text": c["old_text"],
                    "new_text": c["new_text"],
                    "change_type": "modified"
                }
                for c in changes["modified"]
            ],
            "contract_changes": contract_changes
        }


class CompensationService:
    @staticmethod
    def handle_failed_extraction(db: Session, contract_id: int) -> Dict[str, Any]:
        contract = get_contract(db, contract_id)
        if not contract:
            return {"success": False, "message": "合同不存在"}
        
        if contract.retry_count >= 3:
            return {
                "success": False,
                "message": "已达到最大重试次数，请手动处理",
                "retry_count": contract.retry_count
            }
        
        from crud import retry_extraction
        retry_extraction(db, contract_id)
        
        return {
            "success": True,
            "message": "已触发重试",
            "retry_count": contract.retry_count + 1,
            "contract_id": contract_id
        }
    
    @staticmethod
    def bulk_retry_failed_extractions(db: Session) -> Dict[str, Any]:
        from models import ContractStatus
        from crud import get_contracts, retry_extraction
        
        failed_contracts = get_contracts(db, status=ContractStatus.FAILED)
        retried = []
        
        for contract in failed_contracts:
            if contract.retry_count < 3:
                retry_extraction(db, contract.id)
                retried.append(contract.id)
        
        return {
            "success": True,
            "retried_count": len(retried),
            "retried_ids": retried
        }

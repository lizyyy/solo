import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from .database import (
    Batch, EnvSnapshot, ActionLog, ErrorSample, Supplier,
    RiskType, ActionType, Status, get_db
)
from .signature import SignatureService


class EnvSnapshotService:
    def __init__(self, db: Session):
        self.db = db
        self.signature_service = SignatureService()

    def create_batch(self, operator: str, description: str = "") -> str:
        batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"
        batch = Batch(
            batch_id=batch_id,
            operator=operator,
            description=description,
            status=Status.PENDING.value
        )
        self.db.add(batch)
        self.db.commit()
        return batch_id

    def add_supplier(self, name: str, algorithm: str = "SHA256", 
                     contact_info: str = "", public_key: str = "", 
                     notes: str = "") -> Tuple[bool, Dict[str, Any]]:
        existing = self.db.query(Supplier).filter(Supplier.name == name).first()
        if existing:
            return False, {"error": "供应商已存在", "supplier_id": existing.id}

        if algorithm not in SignatureService.SUPPORTED_ALGORITHMS:
            return False, {"error": f"不支持的算法: {algorithm}"}

        supplier = Supplier(
            name=name,
            algorithm=algorithm,
            contact_info=contact_info,
            public_key=public_key,
            notes=notes
        )
        self.db.add(supplier)
        self.db.commit()
        return True, {"supplier_id": supplier.id, "name": name, "algorithm": algorithm}

    def batch_add_suppliers(self, suppliers_data: List[Dict], operator: str, 
                            preview_only: bool = False) -> Dict[str, Any]:
        results = {
            "preview_only": preview_only,
            "total": len(suppliers_data),
            "to_add": [],
            "to_skip": [],
            "algorithm_warnings": []
        }

        for data in suppliers_data:
            name = data.get("name")
            algorithm = data.get("algorithm", "SHA256")
            
            existing = self.db.query(Supplier).filter(Supplier.name == name).first()
            if existing:
                results["to_skip"].append({
                    "name": name,
                    "reason": "已存在",
                    "existing_algorithm": existing.algorithm
                })
            else:
                if algorithm not in SignatureService.SUPPORTED_ALGORITHMS:
                    results["algorithm_warnings"].append({
                        "name": name,
                        "algorithm": algorithm,
                        "warning": f"算法 {algorithm} 不在支持列表中"
                    })
                results["to_add"].append({
                    "name": name,
                    "algorithm": algorithm,
                    "contact_info": data.get("contact_info", "")
                })

        if not preview_only:
            batch_id = self.create_batch(operator, f"批量补录供应商 x{len(results['to_add'])}")
            batch = self.db.query(Batch).filter(Batch.batch_id == batch_id).first()
            
            for item in results["to_add"]:
                success, result = self.add_supplier(
                    name=item["name"],
                    algorithm=item["algorithm"],
                    contact_info=item["contact_info"]
                )
                
                action = ActionLog(
                    batch_id=batch.id,
                    action_type=ActionType.ADD_SUPPLIER.value,
                    input_data=json.dumps(item),
                    output_data=json.dumps(result),
                    conclusion="成功" if success else "失败",
                    operator=operator,
                    status=Status.EXECUTED.value if success else Status.FAILED.value
                )
                self.db.add(action)
            
            batch.status = Status.EXECUTED.value
            self.db.commit()
            results["batch_id"] = batch_id

        return results

    def create_snapshot(self, supplier_name: str, env_vars: Dict[str, str],
                        signature: str, algorithm: str, operator: str,
                        batch_id: Optional[str] = None) -> Tuple[bool, Dict[str, Any]]:
        supplier = self.db.query(Supplier).filter(Supplier.name == supplier_name).first()
        
        expected_algorithm = supplier.algorithm if supplier else "SHA256"
        is_valid, verify_result = self.signature_service.verify(
            env_vars, signature, algorithm, expected_algorithm,
            supplier.public_key if supplier else None
        )

        snapshot_id = f"SNAP-{uuid.uuid4().hex[:8].upper()}"
        rerun_marker = f"RERUN-{datetime.now().strftime('%Y%m%d')}-{snapshot_id}"
        
        batch = None
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.batch_id == batch_id).first()

        material_summary = (
            f"环境变量数: {len(env_vars)}, 供应商: {supplier_name}, "
            f"算法: {algorithm}, 期望算法: {expected_algorithm}"
        )

        snapshot = EnvSnapshot(
            snapshot_id=snapshot_id,
            batch_id=batch.id if batch else None,
            supplier_name=supplier_name,
            env_vars=json.dumps(env_vars),
            signature=signature,
            algorithm=algorithm,
            operator=operator,
            material_summary=material_summary,
            conclusion="验证通过" if is_valid else "验证失败",
            rerun_marker=rerun_marker
        )
        self.db.add(snapshot)
        self.db.flush()

        for error in verify_result.get("errors", []):
            error_sample = ErrorSample(
                snapshot_id=snapshot.id,
                risk_type=error["type"],
                description=error["message"],
                sample_data=json.dumps({
                    "env_vars": env_vars,
                    "signature": signature,
                    "algorithm": algorithm,
                    "expected_algorithm": expected_algorithm
                }),
                severity="HIGH" if error["type"] == "algorithm_mismatch" else "MEDIUM"
            )
            self.db.add(error_sample)

        self.db.commit()
        return is_valid, {
            "snapshot_id": snapshot_id,
            "supplier_name": supplier_name,
            "verification_result": verify_result,
            "error_count": len(verify_result.get("errors", []))
        }

    def query_history(self, batch_id: Optional[str] = None, 
                      operator: Optional[str] = None,
                      risk_type: Optional[str] = None,
                      limit: int = 100) -> List[Dict[str, Any]]:
        query = self.db.query(EnvSnapshot)
        
        if batch_id:
            batch = self.db.query(Batch).filter(Batch.batch_id == batch_id).first()
            if batch:
                query = query.filter(EnvSnapshot.batch_id == batch.id)
        
        if operator:
            query = query.filter(EnvSnapshot.operator == operator)
        
        if risk_type:
            query = query.join(ErrorSample).filter(ErrorSample.risk_type == risk_type)
        
        snapshots = query.order_by(EnvSnapshot.created_at.desc()).limit(limit).all()
        
        results = []
        for snap in snapshots:
            errors = self.db.query(ErrorSample).filter(ErrorSample.snapshot_id == snap.id).all()
            results.append({
                "snapshot_id": snap.snapshot_id,
                "supplier_name": snap.supplier_name,
                "algorithm": snap.algorithm,
                "operator": snap.operator,
                "created_at": snap.created_at.isoformat(),
                "conclusion": snap.conclusion,
                "material_summary": snap.material_summary,
                "rerun_marker": snap.rerun_marker,
                "error_count": len(errors),
                "errors": [{"type": e.risk_type, "description": e.description} for e in errors]
            })
        
        return results

    def get_suppliers(self) -> List[Dict[str, Any]]:
        suppliers = self.db.query(Supplier).all()
        return [
            {
                "id": s.id,
                "name": s.name,
                "algorithm": s.algorithm,
                "contact_info": s.contact_info,
                "created_at": s.created_at.isoformat()
            }
            for s in suppliers
        ]

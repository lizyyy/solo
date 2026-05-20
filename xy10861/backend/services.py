import json
import csv
from io import StringIO
from datetime import datetime
from sqlalchemy.orm import Session
from models import Environment, EnvVariable, DiffSnapshot, ChangeRequest, SyncRecord
from security import encrypt_value, decrypt_value, mask_value
from typing import List, Dict, Any, Optional

class EnvDiffService:
    def __init__(self, db: Session):
        self.db = db
    
    def mask_sensitive_value(self, value: str, mask_char: str = "*", visible_chars: int = 4) -> str:
        return mask_value(value, mask_char, visible_chars)
    
    def get_decrypted_value(self, var: EnvVariable) -> str:
        if var.is_sensitive:
            return decrypt_value(var.value)
        return var.value
    
    def mask_variables(self, variables: List[EnvVariable]) -> List[Dict[str, Any]]:
        result = []
        for var in variables:
            display_value = self.get_decrypted_value(var)
            var_dict = {
                "id": var.id,
                "environment_id": var.environment_id,
                "environment_name": var.environment.name if var.environment else None,
                "key": var.key,
                "value": self.mask_sensitive_value(display_value) if var.is_sensitive else display_value,
                "is_sensitive": var.is_sensitive,
                "description": var.description,
                "created_at": var.created_at.isoformat() if var.created_at else None,
                "updated_at": var.updated_at.isoformat() if var.updated_at else None
            }
            result.append(var_dict)
        return result
    
    def mask_change_request(self, cr: ChangeRequest) -> Dict[str, Any]:
        proposed_val = decrypt_value(cr.proposed_value) if cr.is_sensitive else cr.proposed_value
        return {
            "id": cr.id,
            "title": cr.title,
            "description": cr.description,
            "source_env_id": cr.source_env_id,
            "source_env_name": cr.source_env.name if cr.source_env else None,
            "target_env_id": cr.target_env_id,
            "target_env_name": cr.target_env.name if cr.target_env else None,
            "variable_key": cr.variable_key,
            "source_value": self.mask_sensitive_value(cr.source_value) if cr.is_sensitive else cr.source_value,
            "target_value": self.mask_sensitive_value(cr.target_value) if cr.is_sensitive else cr.target_value,
            "proposed_value": self.mask_sensitive_value(proposed_val) if cr.is_sensitive else proposed_val,
            "is_sensitive": cr.is_sensitive,
            "status": cr.status,
            "requested_by": cr.requested_by,
            "approved_by": cr.approved_by,
            "approved_at": cr.approved_at.isoformat() if cr.approved_at else None,
            "created_at": cr.created_at.isoformat() if cr.created_at else None
        }
    
    def get_change_request_real_proposed_value(self, cr: ChangeRequest) -> str:
        if cr.is_sensitive:
            return decrypt_value(cr.proposed_value)
        return cr.proposed_value
    
    def compare_environments(self, env1_id: int, env2_id: int, created_by: str = "system") -> Dict[str, Any]:
        env1 = self.db.query(Environment).filter(Environment.id == env1_id).first()
        env2 = self.db.query(Environment).filter(Environment.id == env2_id).first()
        
        if not env1 or not env2:
            raise ValueError("One or both environments not found")
        
        vars1 = {v.key: v for v in env1.variables}
        vars2 = {v.key: v for v in env2.variables}
        
        all_keys = set(vars1.keys()) | set(vars2.keys())
        
        differences = []
        matches = []
        only_in_env1 = []
        only_in_env2 = []
        
        for key in all_keys:
            var1 = vars1.get(key)
            var2 = vars2.get(key)
            
            if var1 and not var2:
                val1_decrypted = self.get_decrypted_value(var1)
                only_in_env1.append({
                    "key": key,
                    "value": self.mask_sensitive_value(val1_decrypted) if var1.is_sensitive else val1_decrypted,
                    "is_sensitive": var1.is_sensitive
                })
            elif var2 and not var1:
                val2_decrypted = self.get_decrypted_value(var2)
                only_in_env2.append({
                    "key": key,
                    "value": self.mask_sensitive_value(val2_decrypted) if var2.is_sensitive else val2_decrypted,
                    "is_sensitive": var2.is_sensitive
                })
            else:
                val1_decrypted = self.get_decrypted_value(var1)
                val2_decrypted = self.get_decrypted_value(var2)
                if val1_decrypted != val2_decrypted:
                    differences.append({
                        "key": key,
                        "env1_value": self.mask_sensitive_value(val1_decrypted) if var1.is_sensitive else val1_decrypted,
                        "env2_value": self.mask_sensitive_value(val2_decrypted) if var2.is_sensitive else val2_decrypted,
                        "is_sensitive": var1.is_sensitive or var2.is_sensitive
                    })
                else:
                    matches.append({
                        "key": key,
                        "value": self.mask_sensitive_value(val1_decrypted) if var1.is_sensitive else val1_decrypted,
                        "is_sensitive": var1.is_sensitive
                    })
        
        result = {
            "env1_name": env1.name,
            "env2_name": env2.name,
            "env1_id": env1_id,
            "env2_id": env2_id,
            "summary": {
                "total_keys": len(all_keys),
                "differences": len(differences),
                "matches": len(matches),
                "only_in_env1": len(only_in_env1),
                "only_in_env2": len(only_in_env2)
            },
            "differences": differences,
            "matches": matches,
            "only_in_env1": only_in_env1,
            "only_in_env2": only_in_env2,
            "compared_at": datetime.utcnow().isoformat()
        }
        
        snapshot = DiffSnapshot(
            env1_id=env1_id,
            env2_id=env2_id,
            diff_data=json.dumps(result),
            created_by=created_by
        )
        self.db.add(snapshot)
        self.db.commit()
        
        return result
    
    def create_change_request(self, title: str, description: str, source_env_id: int, 
                            target_env_id: int, variable_key: str, proposed_value: str,
                            requested_by: str) -> ChangeRequest:
        source_var = self.db.query(EnvVariable).filter(
            EnvVariable.environment_id == source_env_id,
            EnvVariable.key == variable_key
        ).first()
        
        target_var = self.db.query(EnvVariable).filter(
            EnvVariable.environment_id == target_env_id,
            EnvVariable.key == variable_key
        ).first()
        
        is_sensitive = (source_var and source_var.is_sensitive) or (target_var and target_var.is_sensitive)
        
        source_val = self.get_decrypted_value(source_var) if source_var else None
        target_val = self.get_decrypted_value(target_var) if target_var else None
        
        if is_sensitive:
            proposed_val_stored = encrypt_value(proposed_value)
        else:
            proposed_val_stored = proposed_value
        
        cr = ChangeRequest(
            title=title,
            description=description,
            source_env_id=source_env_id,
            target_env_id=target_env_id,
            variable_key=variable_key,
            source_value=source_val,
            target_value=target_val,
            proposed_value=proposed_val_stored,
            is_sensitive=is_sensitive,
            status="pending",
            requested_by=requested_by
        )
        self.db.add(cr)
        self.db.commit()
        self.db.refresh(cr)
        return cr
    
    def approve_change_request(self, cr_id: int, approved_by: str) -> ChangeRequest:
        cr = self.db.query(ChangeRequest).filter(ChangeRequest.id == cr_id).first()
        if not cr:
            raise ValueError("Change request not found")
        if cr.status != "pending":
            raise ValueError("Only pending requests can be approved")
        
        cr.status = "approved"
        cr.approved_by = approved_by
        cr.approved_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(cr)
        return cr
    
    def reject_change_request(self, cr_id: int, rejected_by: str, reason: str) -> ChangeRequest:
        cr = self.db.query(ChangeRequest).filter(ChangeRequest.id == cr_id).first()
        if not cr:
            raise ValueError("Change request not found")
        if cr.status != "pending":
            raise ValueError("Only pending requests can be rejected")
        
        cr.status = "rejected"
        cr.approved_by = rejected_by
        cr.description = (cr.description or "") + f"\n\nRejection reason: {reason}"
        self.db.commit()
        self.db.refresh(cr)
        return cr
    
    def sync_variable(self, cr_id: Optional[int], source_env_id: int, target_env_id: int,
                     variable_key: str, new_value: str, synced_by: str) -> SyncRecord:
        target_var = self.db.query(EnvVariable).filter(
            EnvVariable.environment_id == target_env_id,
            EnvVariable.key == variable_key
        ).first()
        
        source_var = self.db.query(EnvVariable).filter(
            EnvVariable.environment_id == source_env_id,
            EnvVariable.key == variable_key
        ).first()
        
        is_sensitive = (source_var and source_var.is_sensitive) or (target_var and target_var.is_sensitive)
        
        old_value = self.get_decrypted_value(target_var) if target_var else None
        
        value_to_store = encrypt_value(new_value) if is_sensitive else new_value
        
        old_value_display = self.mask_sensitive_value(old_value) if is_sensitive and old_value else old_value
        new_value_display = self.mask_sensitive_value(new_value) if is_sensitive else new_value
        
        try:
            if target_var:
                target_var.value = value_to_store
            else:
                target_var = EnvVariable(
                    environment_id=target_env_id,
                    key=variable_key,
                    value=value_to_store,
                    is_sensitive=is_sensitive,
                    description=source_var.description if source_var else None
                )
                self.db.add(target_var)
            
            self.db.commit()
            
            sync_record = SyncRecord(
                change_request_id=cr_id,
                source_env_id=source_env_id,
                target_env_id=target_env_id,
                variable_key=variable_key,
                old_value=old_value_display,
                new_value=new_value_display,
                synced_by=synced_by,
                status="success"
            )
            self.db.add(sync_record)
            self.db.commit()
            self.db.refresh(sync_record)
            
            return sync_record
        except Exception as e:
            sync_record = SyncRecord(
                change_request_id=cr_id,
                source_env_id=source_env_id,
                target_env_id=target_env_id,
                variable_key=variable_key,
                old_value=old_value_display,
                new_value=new_value_display,
                synced_by=synced_by,
                status="failed",
                error_message=str(e)
            )
            self.db.add(sync_record)
            self.db.commit()
            return sync_record
    
    def export_differences(self, env1_id: int, env2_id: int, format: str = "json") -> tuple:
        diff_result = self.compare_environments(env1_id, env2_id)
        
        if format == "json":
            content = json.dumps(diff_result, indent=2, ensure_ascii=False)
            filename = f"diff_{diff_result['env1_name']}_vs_{diff_result['env2_name']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            return content, filename, "application/json"
        elif format == "csv":
            output = StringIO()
            writer = csv.writer(output)
            
            writer.writerow(["Key", "Type", f"Value in {diff_result['env1_name']}", f"Value in {diff_result['env2_name']}"])
            
            for item in diff_result["differences"]:
                writer.writerow([item["key"], "Difference", item["env1_value"], item["env2_value"]])
            
            for item in diff_result["only_in_env1"]:
                writer.writerow([item["key"], f"Only in {diff_result['env1_name']}", item["value"], ""])
            
            for item in diff_result["only_in_env2"]:
                writer.writerow([item["key"], f"Only in {diff_result['env2_name']}", "", item["value"]])
            
            content = output.getvalue()
            filename = f"diff_{diff_result['env1_name']}_vs_{diff_result['env2_name']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            return content, filename, "text/csv"
        else:
            raise ValueError(f"Unsupported format: {format}")

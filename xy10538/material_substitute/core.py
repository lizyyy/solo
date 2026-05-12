import os
import shutil
from typing import Any, Dict, List, Optional, Tuple
from .utils import load_json, save_json, get_current_time, generate_id, format_money


class MaterialSubstituteApp:
    def __init__(self, workspace: str = None):
        self.workspace = workspace or os.path.join(os.getcwd(), ".material-substitute")
        self.data_dir = os.path.join(self.workspace, "data")
        self.history_dir = os.path.join(self.workspace, "history")
        self.state_file = os.path.join(self.workspace, "state.json")
        self.settings_file = os.path.join(self.workspace, "settings.json")

    def is_initialized(self) -> bool:
        return os.path.exists(self.state_file)

    def init(self, force: bool = False) -> Dict[str, Any]:
        if self.is_initialized() and not force:
            return {
                "success": False,
                "message": "工作区已存在，使用 --force 重新初始化",
                "state": self._get_state()
            }

        if force and os.path.exists(self.workspace):
            shutil.rmtree(self.workspace)

        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(self.history_dir, exist_ok=True)

        initial_state = {
            "bom": {},
            "inventory": {},
            "substitute_relations": {},
            "customer_restrictions": {},
            "applications": {},
            "approvals": {},
            "next_id": 1,
            "history": [],
            "cost_threshold": 0.1,
            "cost_level2_threshold": 0.3,
            "initialized_at": get_current_time(),
            "last_modified_at": get_current_time()
        }

        settings = {
            "approver_level1": "生产经理",
            "approver_level2": "财务经理",
            "cost_threshold": 0.1,
            "cost_level2_threshold": 0.3,
            "auto_approve_same_cost": True
        }

        save_json(self.state_file, initial_state)
        save_json(self.settings_file, settings)

        return {
            "success": True,
            "message": "工作区初始化完成",
            "workspace": self.workspace
        }

    def _get_state(self) -> Dict[str, Any]:
        return load_json(self.state_file) or {}

    def _save_state(self, state: Dict[str, Any]) -> None:
        state["last_modified_at"] = get_current_time()
        save_json(self.state_file, state)

    def _add_history(self, action: str, details: Dict[str, Any], operator: str = "system") -> None:
        state = self._get_state()
        history_entry = {
            "id": f"HIST-{len(state.get('history', [])) + 1:04d}",
            "action": action,
            "details": details,
            "operator": operator,
            "timestamp": get_current_time()
        }
        state.setdefault("history", []).append(history_entry)
        self._save_state(state)

    def import_bom(self, bom_data: List[Dict[str, Any]], operator: str = "system") -> Dict[str, Any]:
        state = self._get_state()
        imported = []
        failed = []

        for item in bom_data:
            try:
                product_code = item["product_code"]
                component_code = item["component_code"]
                quantity = float(item["quantity"])

                if product_code not in state["bom"]:
                    state["bom"][product_code] = {
                        "product_code": product_code,
                        "product_name": item.get("product_name", product_code),
                        "components": {}
                    }

                state["bom"][product_code]["components"][component_code] = {
                    "component_code": component_code,
                    "component_name": item.get("component_name", component_code),
                    "quantity": quantity,
                    "unit": item.get("unit", "PCS")
                }
                imported.append(f"{product_code}/{component_code}")
            except Exception as e:
                failed.append({"item": item, "error": str(e)})

        self._save_state(state)
        self._add_history("import_bom", {
            "imported_count": len(imported),
            "failed_count": len(failed),
            "imported_items": imported[:10]
        }, operator)

        return {
            "success": len(failed) == 0,
            "imported": imported,
            "failed": failed,
            "message": f"导入成功 {len(imported)} 条，失败 {len(failed)} 条"
        }

    def import_inventory(self, inventory_data: List[Dict[str, Any]], operator: str = "system") -> Dict[str, Any]:
        state = self._get_state()
        imported = []
        failed = []

        for item in inventory_data:
            try:
                material_code = item["material_code"]
                state["inventory"][material_code] = {
                    "material_code": material_code,
                    "material_name": item.get("material_name", material_code),
                    "quantity": float(item["quantity"]),
                    "unit": item.get("unit", "PCS"),
                    "unit_cost": float(item.get("unit_cost", 0)),
                    "location": item.get("location", ""),
                    "batch_no": item.get("batch_no", "")
                }
                imported.append(material_code)
            except Exception as e:
                failed.append({"item": item, "error": str(e)})

        self._save_state(state)
        self._add_history("import_inventory", {
            "imported_count": len(imported),
            "failed_count": len(failed)
        }, operator)

        return {
            "success": len(failed) == 0,
            "imported": imported,
            "failed": failed,
            "message": f"库存导入成功 {len(imported)} 条，失败 {len(failed)} 条"
        }

    def import_substitute_relations(self, relations: List[Dict[str, Any]], operator: str = "system") -> Dict[str, Any]:
        state = self._get_state()
        imported = []
        failed = []

        for item in relations:
            try:
                original = item["original_material"]
                substitute = item["substitute_material"]

                if original not in state["substitute_relations"]:
                    state["substitute_relations"][original] = []

                existing = [r for r in state["substitute_relations"][original] if r["substitute_material"] == substitute]
                if existing:
                    failed.append({"item": item, "error": "替代关系已存在"})
                    continue

                relation = {
                    "original_material": original,
                    "substitute_material": substitute,
                    "substitute_name": item.get("substitute_name", substitute),
                    "priority": int(item.get("priority", 1)),
                    "effectivity_date": item.get("effectivity_date"),
                    "expiry_date": item.get("expiry_date"),
                    "created_at": get_current_time(),
                    "active": item.get("active", True)
                }
                state["substitute_relations"][original].append(relation)
                state["substitute_relations"][original].sort(key=lambda x: x["priority"])
                imported.append(f"{original} -> {substitute}")
            except Exception as e:
                failed.append({"item": item, "error": str(e)})

        self._save_state(state)
        self._add_history("import_substitute_relations", {
            "imported_count": len(imported),
            "failed_count": len(failed)
        }, operator)

        return {
            "success": len(failed) == 0,
            "imported": imported,
            "failed": failed,
            "message": f"替代关系导入成功 {len(imported)} 条，失败 {len(failed)} 条"
        }

    def import_customer_restrictions(self, restrictions: List[Dict[str, Any]], operator: str = "system") -> Dict[str, Any]:
        state = self._get_state()
        imported = []
        failed = []

        for item in restrictions:
            try:
                customer_code = item["customer_code"]
                key = f"{customer_code}_{item.get('material_code', '*')}"

                state["customer_restrictions"][key] = {
                    "customer_code": customer_code,
                    "customer_name": item.get("customer_name", customer_code),
                    "material_code": item.get("material_code", "*"),
                    "restriction_type": item.get("restriction_type", "FORBID_SUBSTITUTE"),
                    "reason": item.get("reason", ""),
                    "created_at": get_current_time()
                }
                imported.append(key)
            except Exception as e:
                failed.append({"item": item, "error": str(e)})

        self._save_state(state)
        self._add_history("import_customer_restrictions", {
            "imported_count": len(imported),
            "failed_count": len(failed)
        }, operator)

        return {
            "success": len(failed) == 0,
            "imported": imported,
            "failed": failed,
            "message": f"客户限制导入成功 {len(imported)} 条，失败 {len(failed)} 条"
        }

    def check_substitute(self, product_code: str, component_code: str, 
                         substitute_material: str, customer_code: str = None,
                         quantity_needed: float = 1.0) -> Dict[str, Any]:
        state = self._get_state()
        bom = state["bom"]
        inventory = state["inventory"]
        substitutes = state["substitute_relations"]
        restrictions = state["customer_restrictions"]

        result = {
            "product_code": product_code,
            "component_code": component_code,
            "substitute_material": substitute_material,
            "customer_code": customer_code,
            "checks": [],
            "can_substitute": True,
            "needs_approval": False,
            "approval_level": 0,
            "original_cost": 0,
            "substitute_cost": 0,
            "cost_difference": 0,
            "cost_difference_percent": 0,
            "reasons": []
        }

        bom_check = self._check_bom(bom, product_code, component_code)
        result["checks"].append(bom_check)
        if not bom_check["passed"]:
            result["can_substitute"] = False
            result["reasons"].append(bom_check["message"])

        rel_check = self._check_substitute_relation(substitutes, component_code, substitute_material)
        result["checks"].append(rel_check)
        if not rel_check["passed"]:
            result["can_substitute"] = False
            result["reasons"].append(rel_check["message"])

        inv_check = self._check_inventory(inventory, substitute_material, quantity_needed)
        result["checks"].append(inv_check)
        if not inv_check["passed"]:
            result["can_substitute"] = False
            result["reasons"].append(inv_check["message"])

        cust_check = self._check_customer_restriction(restrictions, customer_code, component_code, substitute_material)
        result["checks"].append(cust_check)
        if not cust_check["passed"]:
            result["can_substitute"] = False
            result["reasons"].append(cust_check["message"])

        cost_check = self._check_cost(inventory, component_code, substitute_material, 
                                      state.get("cost_threshold", 0.1), 
                                      state.get("cost_level2_threshold", 0.3))
        result["checks"].append(cost_check)
        result["original_cost"] = cost_check.get("original_cost", 0)
        result["substitute_cost"] = cost_check.get("substitute_cost", 0)
        result["cost_difference"] = cost_check.get("cost_difference", 0)
        result["cost_difference_percent"] = cost_check.get("cost_difference_percent", 0)

        if not cost_check["passed"]:
            result["needs_approval"] = True
            result["approval_level"] = cost_check.get("approval_level", 1)
            result["reasons"].append(cost_check["message"])

        return result

    def _check_bom(self, bom: Dict[str, Any], product_code: str, component_code: str) -> Dict[str, Any]:
        if product_code not in bom:
            return {"name": "BOM检查", "passed": False, "message": f"产品 {product_code} 不存在于BOM中"}
        if component_code not in bom[product_code]["components"]:
            return {"name": "BOM检查", "passed": False, "message": f"组件 {component_code} 不在产品 {product_code} 的BOM中"}
        return {"name": "BOM检查", "passed": True, "message": "BOM验证通过"}

    def _check_substitute_relation(self, substitutes: Dict[str, Any], original: str, substitute: str) -> Dict[str, Any]:
        if original not in substitutes:
            return {"name": "替代关系检查", "passed": False, "message": f"物料 {original} 没有定义替代关系"}
        
        relations = substitutes[original]
        active_relations = [r for r in relations if r.get("active", True)]
        if not active_relations:
            return {"name": "替代关系检查", "passed": False, "message": f"物料 {original} 没有有效的替代关系"}

        match = [r for r in active_relations if r["substitute_material"] == substitute]
        if not match:
            available = [r["substitute_material"] for r in active_relations]
            return {"name": "替代关系检查", "passed": False, 
                    "message": f"{substitute} 不是 {original} 的有效替代料，可用替代料：{', '.join(available)}"}

        return {"name": "替代关系检查", "passed": True, "message": "替代关系验证通过"}

    def _check_inventory(self, inventory: Dict[str, Any], material: str, quantity_needed: float) -> Dict[str, Any]:
        if material not in inventory:
            return {"name": "库存检查", "passed": False, "message": f"替代料 {material} 无库存记录"}
        
        inv = inventory[material]
        if inv["quantity"] < quantity_needed:
            return {"name": "库存检查", "passed": False, 
                    "message": f"替代料库存不足：需要 {quantity_needed} {inv['unit']}，现有 {inv['quantity']} {inv['unit']}"}
        
        return {"name": "库存检查", "passed": True, 
                "message": f"库存充足：{inv['quantity']} {inv['unit']}"}

    def _check_customer_restriction(self, restrictions: Dict[str, Any], customer_code: str, 
                                    original: str, substitute: str) -> Dict[str, Any]:
        if not customer_code:
            return {"name": "客户限制检查", "passed": True, "message": "未指定客户，跳过客户限制检查"}

        keys_to_check = [
            f"{customer_code}_{original}",
            f"{customer_code}_*"
        ]

        for key in keys_to_check:
            if key in restrictions:
                rest = restrictions[key]
                if rest["restriction_type"] == "FORBID_SUBSTITUTE":
                    return {"name": "客户限制检查", "passed": False, 
                            "message": f"客户 {customer_code} 禁止使用替代料：{rest.get('reason', '未指定原因')}"}
                elif rest["restriction_type"] == "ALLOW_SPECIFIC":
                    if substitute not in rest.get("allowed_substitutes", []):
                        return {"name": "客户限制检查", "passed": False, 
                                "message": f"客户 {customer_code} 仅允许特定替代料，{substitute} 不在允许列表中"}

        return {"name": "客户限制检查", "passed": True, "message": "无客户限制"}

    def _check_cost(self, inventory: Dict[str, Any], original: str, substitute: str, 
                    threshold: float, level2_threshold: float) -> Dict[str, Any]:
        original_cost = inventory.get(original, {}).get("unit_cost", 0)
        substitute_cost = inventory.get(substitute, {}).get("unit_cost", 0)

        if original_cost == 0:
            return {"name": "成本检查", "passed": True, "message": "原始物料无成本信息，跳过成本检查",
                    "original_cost": 0, "substitute_cost": substitute_cost, "cost_difference": 0, "cost_difference_percent": 0}

        cost_diff = substitute_cost - original_cost
        cost_diff_percent = (cost_diff / original_cost) * 100 if original_cost > 0 else 0

        if cost_diff_percent <= threshold * 100:
            return {"name": "成本检查", "passed": True, 
                    "message": f"成本变化 {format_money(cost_diff)} ({cost_diff_percent:.1f}%) 在阈值内",
                    "original_cost": original_cost, "substitute_cost": substitute_cost,
                    "cost_difference": cost_diff, "cost_difference_percent": cost_diff_percent}
        elif cost_diff_percent <= level2_threshold * 100:
            return {"name": "成本检查", "passed": False, 
                    "message": f"成本超阈值 {threshold*100:.0f}%，需要一级审批",
                    "approval_level": 1,
                    "original_cost": original_cost, "substitute_cost": substitute_cost,
                    "cost_difference": cost_diff, "cost_difference_percent": cost_diff_percent}
        else:
            return {"name": "成本检查", "passed": False, 
                    "message": f"成本超阈值 {level2_threshold*100:.0f}%，需要二级审批",
                    "approval_level": 2,
                    "original_cost": original_cost, "substitute_cost": substitute_cost,
                    "cost_difference": cost_diff, "cost_difference_percent": cost_diff_percent}

    def create_application(self, product_code: str, component_code: str, 
                          substitute_material: str, customer_code: str = None,
                          quantity: float = 1.0, reason: str = "", 
                          operator: str = "system") -> Dict[str, Any]:
        state = self._get_state()

        check_result = self.check_substitute(product_code, component_code, substitute_material, 
                                            customer_code, quantity)

        existing = [app for app in state["applications"].values() 
                   if app["product_code"] == product_code 
                   and app["component_code"] == component_code
                   and app["substitute_material"] == substitute_material
                   and app["status"] in ["PENDING", "APPROVED", "USED"]]

        if existing:
            return {
                "success": False,
                "message": "存在重复申请",
                "existing_application": existing[0],
                "check_result": check_result
            }

        app_id = f"APP-{state['next_id']:06d}"
        state["next_id"] += 1

        application = {
            "application_id": app_id,
            "product_code": product_code,
            "component_code": component_code,
            "substitute_material": substitute_material,
            "customer_code": customer_code,
            "quantity": quantity,
            "reason": reason,
            "status": "CREATED",
            "check_result": check_result,
            "created_at": get_current_time(),
            "created_by": operator,
            "approval_history": [],
            "manual_corrections": []
        }

        if check_result["can_substitute"] and not check_result["needs_approval"]:
            application["status"] = "AUTO_APPROVED"
            application["approval_history"].append({
                "level": 0,
                "action": "AUTO_APPROVE",
                "comment": "自动审批通过",
                "approver": "system",
                "timestamp": get_current_time()
            })
        elif check_result["can_substitute"] and check_result["needs_approval"]:
            application["status"] = "PENDING_LEVEL1"
            application["required_approval_level"] = check_result["approval_level"]

        state["applications"][app_id] = application
        self._save_state(state)
        self._add_history("create_application", {
            "application_id": app_id,
            "status": application["status"],
            "can_substitute": check_result["can_substitute"]
        }, operator)

        return {
            "success": True,
            "application": application,
            "check_result": check_result
        }

    def approve(self, application_id: str, level: int, operator: str, 
                comment: str = "") -> Dict[str, Any]:
        state = self._get_state()

        if application_id not in state["applications"]:
            return {"success": False, "message": f"申请 {application_id} 不存在"}

        app = state["applications"][application_id]

        if app["status"] == "APPROVED":
            return {"success": True, "message": "申请已审批通过（幂等性处理）", "application": app}

        if app["status"] == "REJECTED":
            return {"success": False, "message": "申请已被拒绝，无法审批", "application": app}

        if app["status"] == "USED":
            return {"success": False, "message": "申请已投料使用，无法审批", "application": app}

        required_level = app.get("required_approval_level", 1)
        if level < required_level:
            return {"success": False, 
                    "message": f"需要{required_level}级审批，当前是{level}级", 
                    "application": app}

        app["approval_history"].append({
            "level": level,
            "action": "APPROVE",
            "comment": comment,
            "approver": operator,
            "timestamp": get_current_time()
        })

        if level >= required_level:
            app["status"] = "APPROVED"
        else:
            app["status"] = f"PENDING_LEVEL{level + 1}"

        self._save_state(state)
        self._add_history("approve_application", {
            "application_id": application_id,
            "level": level,
            "new_status": app["status"]
        }, operator)

        return {
            "success": True,
            "message": "审批成功",
            "application": app
        }

    def reject(self, application_id: str, operator: str, comment: str = "") -> Dict[str, Any]:
        state = self._get_state()

        if application_id not in state["applications"]:
            return {"success": False, "message": f"申请 {application_id} 不存在"}

        app = state["applications"][application_id]

        if app["status"] == "REJECTED":
            return {"success": True, "message": "申请已被拒绝（幂等性处理）", "application": app}

        if app["status"] == "USED":
            return {"success": False, "message": "申请已投料使用，无法拒绝", "application": app}

        app["status"] = "REJECTED"
        app["approval_history"].append({
            "level": 1,
            "action": "REJECT",
            "comment": comment,
            "approver": operator,
            "timestamp": get_current_time()
        })

        self._save_state(state)
        self._add_history("reject_application", {
            "application_id": application_id
        }, operator)

        return {
            "success": True,
            "message": "申请已拒绝",
            "application": app
        }

    def use_application(self, application_id: str, operator: str) -> Dict[str, Any]:
        state = self._get_state()

        if application_id not in state["applications"]:
            return {"success": False, "message": f"申请 {application_id} 不存在"}

        app = state["applications"][application_id]

        if app["status"] == "USED":
            return {"success": True, "message": "申请已投料使用（幂等性处理）", "application": app}

        if app["status"] not in ["APPROVED", "AUTO_APPROVED"]:
            return {"success": False, "message": f"申请状态为 {app['status']}，无法投料使用", "application": app}

        original_status = app["status"]
        app["status"] = "USED"
        app["used_at"] = get_current_time()
        app["used_by"] = operator

        self._save_state(state)
        self._add_history("use_application", {
            "application_id": application_id,
            "original_status": original_status
        }, operator)

        return {
            "success": True,
            "message": "申请已标记为投料使用",
            "application": app
        }

    def revoke(self, application_id: str, operator: str, reason: str = "") -> Dict[str, Any]:
        state = self._get_state()

        if application_id not in state["applications"]:
            return {"success": False, "message": f"申请 {application_id} 不存在"}

        app = state["applications"][application_id]

        if app["status"] == "USED":
            return {"success": False, "message": "已投料的申请无法撤销", "application": app}

        if app["status"] in ["REVOKED", "CANCELLED"]:
            return {"success": True, "message": "申请已撤销（幂等性处理）", "application": app}

        app["status"] = "REVOKED"
        app["approval_history"].append({
            "level": 0,
            "action": "REVOKE",
            "comment": reason,
            "approver": operator,
            "timestamp": get_current_time()
        })

        self._save_state(state)
        self._add_history("revoke_application", {
            "application_id": application_id
        }, operator)

        return {
            "success": True,
            "message": "申请已撤销",
            "application": app
        }

    def manual_correct(self, application_id: str, field: str, 
                       old_value: Any, new_value: Any, operator: str,
                       reason: str = "") -> Dict[str, Any]:
        state = self._get_state()

        if application_id not in state["applications"]:
            return {"success": False, "message": f"申请 {application_id} 不存在"}

        app = state["applications"][application_id]

        correction = {
            "field": field,
            "old_value": old_value,
            "new_value": new_value,
            "reason": reason,
            "operator": operator,
            "timestamp": get_current_time()
        }

        app.setdefault("manual_corrections", []).append(correction)

        if field in app:
            app[field] = new_value
        elif field in app.get("check_result", {}):
            app["check_result"][field] = new_value

        self._save_state(state)
        self._add_history("manual_correct", {
            "application_id": application_id,
            "field": field
        }, operator)

        return {
            "success": True,
            "message": "人工修正已记录",
            "correction": correction,
            "application": app
        }

    def get_application_detail(self, application_id: str) -> Dict[str, Any]:
        state = self._get_state()

        if application_id not in state["applications"]:
            return {"success": False, "message": f"申请 {application_id} 不存在"}

        app = state["applications"][application_id]
        return {
            "success": True,
            "application": app
        }

    def get_history(self, application_id: str = None, limit: int = 50) -> Dict[str, Any]:
        state = self._get_state()
        history = state.get("history", [])

        if application_id:
            history = [h for h in history 
                      if h.get("details", {}).get("application_id") == application_id]

        return {
            "success": True,
            "history": history[-limit:]
        }

    def list_applications(self, status: str = None) -> Dict[str, Any]:
        state = self._get_state()
        apps = list(state["applications"].values())

        if status:
            apps = [a for a in apps if a["status"] == status]

        return {
            "success": True,
            "applications": apps
        }

    def generate_report(self, application_id: str = None) -> Dict[str, Any]:
        state = self._get_state()

        if application_id:
            if application_id not in state["applications"]:
                return {"success": False, "message": f"申请 {application_id} 不存在"}
            apps = [state["applications"][application_id]]
        else:
            apps = list(state["applications"].values())

        report_data = {
            "generated_at": get_current_time(),
            "summary": {
                "total": len(apps),
                "created": len([a for a in apps if a["status"] == "CREATED"]),
                "pending": len([a for a in apps if a["status"].startswith("PENDING")]),
                "approved": len([a for a in apps if a["status"] in ["APPROVED", "AUTO_APPROVED"]]),
                "used": len([a for a in apps if a["status"] == "USED"]),
                "rejected": len([a for a in apps if a["status"] == "REJECTED"]),
                "revoked": len([a for a in apps if a["status"] in ["REVOKED", "CANCELLED"]])
            },
            "applications": apps,
            "cost_analysis": self._analyze_costs(apps)
        }

        return {
            "success": True,
            "report": report_data
        }

    def _analyze_costs(self, apps: List[Dict[str, Any]]) -> Dict[str, Any]:
        total_original = 0
        total_substitute = 0
        cost_changes = []

        for app in apps:
            check = app.get("check_result", {})
            orig = check.get("original_cost", 0) * app.get("quantity", 1)
            sub = check.get("substitute_cost", 0) * app.get("quantity", 1)
            total_original += orig
            total_substitute += sub

            if orig != sub:
                cost_changes.append({
                    "application_id": app["application_id"],
                    "original": orig,
                    "substitute": sub,
                    "difference": sub - orig
                })

        return {
            "total_original_cost": total_original,
            "total_substitute_cost": total_substitute,
            "total_difference": total_substitute - total_original,
            "cost_changes": cost_changes
        }

    def load_sample_data(self, operator: str = "system") -> Dict[str, Any]:
        bom_data = [
            {"product_code": "SMART-TV-001", "product_name": "智能电视55寸",
             "component_code": "RES-001", "component_name": "10K电阻", "quantity": 50, "unit": "PCS"},
            {"product_code": "SMART-TV-001", "product_name": "智能电视55寸",
             "component_code": "CAP-001", "component_name": "100uF电容", "quantity": 20, "unit": "PCS"},
            {"product_code": "SMART-TV-001", "product_name": "智能电视55寸",
             "component_code": "BOX-001", "component_name": "包装箱", "quantity": 1, "unit": "PCS"},
            {"product_code": "SMART-TV-001", "product_name": "智能电视55寸",
             "component_code": "FRAME-001", "component_name": "塑料边框", "quantity": 4, "unit": "PCS"},
            {"product_code": "ROUTER-001", "product_name": "无线路由器",
             "component_code": "RES-001", "component_name": "10K电阻", "quantity": 30, "unit": "PCS"},
            {"product_code": "ROUTER-001", "product_name": "无线路由器",
             "component_code": "PCB-001", "component_name": "主电路板", "quantity": 1, "unit": "PCS"}
        ]

        inventory_data = [
            {"material_code": "RES-001", "material_name": "10K电阻", "quantity": 1000, "unit": "PCS", "unit_cost": 0.05, "location": "A-01-01"},
            {"material_code": "RES-002", "material_name": "10K电阻(替代)", "quantity": 500, "unit": "PCS", "unit_cost": 0.055, "location": "A-01-02"},
            {"material_code": "RES-003", "material_name": "10K电阻(高端)", "quantity": 200, "unit": "PCS", "unit_cost": 0.12, "location": "A-01-03"},
            {"material_code": "CAP-001", "material_name": "100uF电容", "quantity": 0, "unit": "PCS", "unit_cost": 0.15, "location": "A-02-01"},
            {"material_code": "CAP-002", "material_name": "100uF电容(替代)", "quantity": 300, "unit": "PCS", "unit_cost": 0.16, "location": "A-02-02"},
            {"material_code": "CAP-003", "material_name": "100uF电容(进口)", "quantity": 100, "unit": "PCS", "unit_cost": 0.50, "location": "A-02-03"},
            {"material_code": "BOX-001", "material_name": "标准包装箱", "quantity": 0, "unit": "PCS", "unit_cost": 5.00, "location": "B-01-01"},
            {"material_code": "BOX-002", "material_name": "简易包装箱", "quantity": 200, "unit": "PCS", "unit_cost": 3.50, "location": "B-01-02"},
            {"material_code": "FRAME-001", "material_name": "ABS塑料边框", "quantity": 50, "unit": "PCS", "unit_cost": 8.00, "location": "C-01-01"},
            {"material_code": "FRAME-002", "material_name": "PC塑料边框", "quantity": 100, "unit": "PCS", "unit_cost": 8.50, "location": "C-01-02"},
            {"material_code": "PCB-001", "material_name": "主电路板", "quantity": 20, "unit": "PCS", "unit_cost": 25.00, "location": "D-01-01"}
        ]

        substitute_relations = [
            {"original_material": "RES-001", "substitute_material": "RES-002", "substitute_name": "10K电阻(替代)", "priority": 1, "active": True},
            {"original_material": "RES-001", "substitute_material": "RES-003", "substitute_name": "10K电阻(高端)", "priority": 2, "active": True},
            {"original_material": "CAP-001", "substitute_material": "CAP-002", "substitute_name": "100uF电容(替代)", "priority": 1, "active": True},
            {"original_material": "CAP-001", "substitute_material": "CAP-003", "substitute_name": "100uF电容(进口)", "priority": 2, "active": True},
            {"original_material": "BOX-001", "substitute_material": "BOX-002", "substitute_name": "简易包装箱", "priority": 1, "active": True},
            {"original_material": "FRAME-001", "substitute_material": "FRAME-002", "substitute_name": "PC塑料边框", "priority": 1, "active": True}
        ]

        customer_restrictions = [
            {"customer_code": "CUST-001", "customer_name": "苹果公司", "material_code": "CAP-001", 
             "restriction_type": "FORBID_SUBSTITUTE", "reason": "指定必须使用原厂电容"},
            {"customer_code": "CUST-002", "customer_name": "华为技术", "material_code": "*", 
             "restriction_type": "FORBID_SUBSTITUTE", "reason": "所有物料禁止替代"}
        ]

        bom_result = self.import_bom(bom_data, operator)
        inv_result = self.import_inventory(inventory_data, operator)
        sub_result = self.import_substitute_relations(substitute_relations, operator)
        cust_result = self.import_customer_restrictions(customer_restrictions, operator)

        return {
            "success": all([bom_result["success"], inv_result["success"], 
                           sub_result["success"], cust_result["success"]]),
            "bom": bom_result,
            "inventory": inv_result,
            "substitutes": sub_result,
            "customer_restrictions": cust_result,
            "message": "样例数据加载完成"
        }

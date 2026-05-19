import json
import os
from datetime import datetime
from typing import Optional
from models import ApiDecommission, Caller, ExtensionRequest, TransformationStatus, ExtensionApprovalStatus
from rules import ApiDecommissionManager


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.manager_file = os.path.join(data_dir, "api_decommission.json")

    def save(self, manager: ApiDecommissionManager) -> bool:
        try:
            data = {
                "apis": {name: api.to_dict() for name, api in manager.apis.items()},
                "saved_at": datetime.now().isoformat()
            }
            with open(self.manager_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存数据失败: {e}")
            return False

    def load(self) -> Optional[ApiDecommissionManager]:
        if not os.path.exists(self.manager_file):
            return None

        try:
            with open(self.manager_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            manager = ApiDecommissionManager()

            for api_name, api_data in data.get("apis", {}).items():
                api = ApiDecommission(
                    api_name=api_data["api_name"],
                    decommission_date=api_data["decommission_date"],
                    created_at=datetime.fromisoformat(api_data["created_at"])
                )

                for caller_data in api_data["callers"]:
                    caller = Caller(
                        caller_name=caller_data["caller_name"],
                        api_name=caller_data["api_name"],
                        transformation_plan=caller_data["transformation_plan"],
                        planned_complete_date=caller_data["planned_complete_date"],
                        status=TransformationStatus(caller_data["status"]),
                        registered_at=datetime.fromisoformat(caller_data["registered_at"]),
                        remarks=caller_data["remarks"]
                    )
                    api.callers.append(caller)

                for ext_data in api_data["extension_requests"]:
                    ext = ExtensionRequest(
                        caller_name=ext_data["caller_name"],
                        api_name=ext_data["api_name"],
                        original_decommission_date=ext_data["original_decommission_date"],
                        requested_decommission_date=ext_data["requested_decommission_date"],
                        reason=ext_data["reason"],
                        approval_status=ExtensionApprovalStatus(ext_data["approval_status"]),
                        requested_at=datetime.fromisoformat(ext_data["requested_at"]),
                        approved_by=ext_data["approved_by"],
                        approved_at=datetime.fromisoformat(ext_data["approved_at"]) if ext_data["approved_at"] else None
                    )
                    api.extension_requests.append(ext)

                manager.apis[api_name] = api

            return manager
        except Exception as e:
            print(f"加载数据失败: {e}")
            return None

    def clear(self) -> bool:
        try:
            if os.path.exists(self.manager_file):
                os.remove(self.manager_file)
            return True
        except Exception as e:
            print(f"清除数据失败: {e}")
            return False

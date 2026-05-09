import httpx
import json
from typing import Optional, Dict, Any, List
from datetime import datetime

BASE_URL = "http://localhost:8000"


class PortApiClient:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.client = httpx.Client()

    def close(self):
        self.client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def health_check(self) -> Dict[str, Any]:
        resp = self.client.get(f"{self.base_url}/api/health")
        return resp.json()

    def enqueue_vehicle(
        self,
        plate_number: str,
        cargo_type: str,
        target_temp_low: float,
        target_temp_high: float,
        remark: Optional[str] = None
    ) -> Dict[str, Any]:
        data = {
            "plate_number": plate_number,
            "cargo_type": cargo_type,
            "target_temp_low": target_temp_low,
            "target_temp_high": target_temp_high,
        }
        if remark:
            data["remark"] = remark
        resp = self.client.post(f"{self.base_url}/api/queue/vehicles", json=data)
        if resp.status_code >= 400:
            print(f"  [ERROR {resp.status_code}] {resp.json()}")
        return resp.json()

    def list_queue(
        self,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        params = {"limit": limit}
        if status:
            params["status"] = status
        if priority:
            params["priority"] = priority
        resp = self.client.get(f"{self.base_url}/api/queue/vehicles", params=params)
        return resp.json()

    def get_vehicle(self, vehicle_id: int) -> Dict[str, Any]:
        resp = self.client.get(f"{self.base_url}/api/queue/vehicles/{vehicle_id}")
        return resp.json()

    def add_temperature(
        self,
        vehicle_id: int,
        temperature: float,
        record_time: datetime,
        remark: Optional[str] = None
    ) -> Dict[str, Any]:
        data = {
            "vehicle_id": vehicle_id,
            "temperature": temperature,
            "record_time": record_time.isoformat(),
        }
        if remark:
            data["remark"] = remark
        resp = self.client.post(f"{self.base_url}/api/temperature", json=data)
        if resp.status_code >= 400:
            print(f"  [ERROR {resp.status_code}] {resp.json()}")
        return resp.json()

    def manual_update_temperature(
        self,
        record_id: int,
        new_temperature: float,
        modified_by: str,
        reason: str
    ) -> Dict[str, Any]:
        data = {
            "new_temperature": new_temperature,
            "modified_by": modified_by,
            "reason": reason
        }
        resp = self.client.patch(
            f"{self.base_url}/api/temperature/{record_id}/manual-update",
            json=data
        )
        if resp.status_code >= 400:
            print(f"  [ERROR {resp.status_code}] {resp.json()}")
        return resp.json()

    def start_inspection(
        self,
        vehicle_id: int,
        inspector: Optional[str] = None
    ) -> Dict[str, Any]:
        data = {"vehicle_id": vehicle_id}
        if inspector:
            data["inspector"] = inspector
        resp = self.client.post(f"{self.base_url}/api/inspection/start", json=data)
        if resp.status_code >= 400:
            print(f"  [ERROR {resp.status_code}] {resp.json()}")
        return resp.json()

    def complete_inspection(
        self,
        inspection_id: int,
        inspection_result: str,
        issues_found: Optional[str] = None,
        check_points: Optional[str] = None
    ) -> Dict[str, Any]:
        data = {"inspection_result": inspection_result}
        if issues_found:
            data["issues_found"] = issues_found
        if check_points:
            data["check_points"] = check_points
        resp = self.client.post(
            f"{self.base_url}/api/inspection/{inspection_id}/complete",
            json=data
        )
        if resp.status_code >= 400:
            print(f"  [ERROR {resp.status_code}] {resp.json()}")
        return resp.json()

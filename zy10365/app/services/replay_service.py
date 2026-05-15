import httpx
import time
import json
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models import HistoryRequest, GrayVersion, VerificationStatus, Timeline
from datetime import datetime


class ReplayService:
    def __init__(self, db: Session):
        self.db = db

    async def replay_request(
        self,
        request: HistoryRequest,
        gray_version: GrayVersion
    ) -> Dict[str, Any]:
        url = f"{gray_version.target_url.rstrip('/')}{request.path}"
        
        start_time = time.time()
        
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            try:
                response = await client.request(
                    method=request.method,
                    url=url,
                    headers=request.headers or {},
                    params=request.query_params or {},
                    json=request.request_body if request.method in ["POST", "PUT", "PATCH"] else None
                )
                
                response_time = (time.time() - start_time) * 1000
                
                request.gray_response = response.json() if response.content else {}
                request.gray_status_code = response.status_code
                request.gray_response_time = response_time
                request.replayed_at = datetime.now()
                
                self.db.commit()
                
                self._add_timeline(
                    gray_version_id=gray_version.id,
                    request_id=request.id,
                    action="request_replayed",
                    actor="system",
                    details={
                        "request_id": request.request_id,
                        "status_code": response.status_code,
                        "response_time": response_time
                    }
                )
                
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "response_time": response_time
                }
                
            except Exception as e:
                self._add_timeline(
                    gray_version_id=gray_version.id,
                    request_id=request.id,
                    action="replay_failed",
                    actor="system",
                    details={
                        "request_id": request.request_id,
                        "error": str(e)
                    }
                )
                return {
                    "success": False,
                    "error": str(e)
                }

    async def replay_all_requests(self, gray_version: GrayVersion) -> Dict[str, Any]:
        requests = self.db.query(HistoryRequest).filter(
            HistoryRequest.gray_version_id == gray_version.id
        ).all()
        
        results = {
            "total": len(requests),
            "success": 0,
            "failed": 0,
            "details": []
        }
        
        if len(requests) == 0:
            results["error"] = "No requests to replay"
            self._add_timeline(
                gray_version_id=gray_version.id,
                action="replay_skipped",
                actor="system",
                details={"reason": "No requests to replay"}
            )
            return results
        
        gray_version.status = VerificationStatus.REPLAYING
        self.db.commit()
        
        self._add_timeline(
            gray_version_id=gray_version.id,
            action="replay_started",
            actor="system",
            details={"total_requests": len(requests)}
        )
        
        for request in requests:
            if request.gray_response is not None:
                results["success"] += 1
                continue
                
            result = await self.replay_request(request, gray_version)
            if result["success"]:
                results["success"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "request_id": request.request_id,
                "result": result
            })
        
        if results["failed"] > 0:
            if results["success"] == 0:
                gray_version.status = VerificationStatus.FAILED
                results["error"] = "All requests failed to replay"
            else:
                gray_version.status = VerificationStatus.DIFFING
        else:
            gray_version.status = VerificationStatus.DIFFING
        
        self.db.commit()
        
        self._add_timeline(
            gray_version_id=gray_version.id,
            action="replay_completed",
            actor="system",
            details=results
        )
        
        return results

    def _add_timeline(
        self,
        action: str,
        actor: str,
        details: Dict[str, Any],
        gray_version_id: Optional[int] = None,
        request_id: Optional[int] = None
    ):
        timeline = Timeline(
            gray_version_id=gray_version_id,
            request_id=request_id,
            action=action,
            actor=actor,
            details=details
        )
        self.db.add(timeline)
        self.db.commit()

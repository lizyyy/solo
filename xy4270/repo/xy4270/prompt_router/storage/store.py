"""
存储模块：结果保存与加载
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.models import (
    RouteAttempt,
    RouteResult,
    RouteStatus,
    RunSummary,
)


class ResultStore:
    """结果存储类"""
    
    def __init__(self, base_dir: str = "./results"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
        self._runs_dir = self.base_dir / "runs"
        self._runs_dir.mkdir(exist_ok=True)
        
        self._summaries_dir = self.base_dir / "summaries"
        self._summaries_dir.mkdir(exist_ok=True)
    
    def _result_to_dict(self, result: RouteResult) -> Dict[str, Any]:
        """将 RouteResult 转换为字典"""
        return {
            "id": result.id,
            "test_case_id": result.test_case_id,
            "policy_name": result.policy_name,
            "policy_version": result.policy_version,
            "final_model": result.final_model,
            "final_status": result.final_status.value if hasattr(result.final_status, "value") else str(result.final_status),
            "final_latency_ms": result.final_latency_ms,
            "total_input_tokens": result.total_input_tokens,
            "total_output_tokens": result.total_output_tokens,
            "total_cost": result.total_cost,
            "success": result.success,
            "degradation_triggered": result.degradation_triggered,
            "retry_count": result.retry_count,
            "circuit_triggered": result.circuit_triggered,
            "budget_exceeded": result.budget_exceeded,
            "sensitive_blocked": result.sensitive_blocked,
            "hit_reason": result.hit_reason,
            "timestamp": result.timestamp.isoformat() if result.timestamp else None,
            "metadata": result.metadata,
            "attempts": [
                {
                    "model_name": a.model_name,
                    "attempt_number": a.attempt_number,
                    "input_tokens": a.input_tokens,
                    "output_tokens": a.output_tokens,
                    "latency_ms": a.latency_ms,
                    "status": a.status.value if hasattr(a.status, "value") else str(a.status),
                    "error_message": a.error_message,
                    "retry_reason": a.retry_reason,
                    "cost": a.cost,
                }
                for a in result.attempts
            ],
        }
    
    def _dict_to_result(self, data: Dict[str, Any]) -> RouteResult:
        """将字典转换为 RouteResult"""
        attempts = []
        for attempt_data in data.get("attempts", []):
            attempt = RouteAttempt(
                model_name=attempt_data["model_name"],
                attempt_number=attempt_data["attempt_number"],
                input_tokens=attempt_data["input_tokens"],
                output_tokens=attempt_data["output_tokens"],
                latency_ms=attempt_data["latency_ms"],
                status=RouteStatus(attempt_data["status"]),
                error_message=attempt_data.get("error_message"),
                retry_reason=attempt_data.get("retry_reason"),
            )
            attempts.append(attempt)
        
        timestamp = data.get("timestamp")
        if timestamp:
            timestamp = datetime.fromisoformat(timestamp)
        
        return RouteResult(
            id=data["id"],
            test_case_id=data["test_case_id"],
            policy_name=data["policy_name"],
            policy_version=data["policy_version"],
            final_model=data["final_model"],
            final_status=RouteStatus(data["final_status"]),
            final_latency_ms=data["final_latency_ms"],
            total_input_tokens=data["total_input_tokens"],
            total_output_tokens=data["total_output_tokens"],
            total_cost=data["total_cost"],
            attempts=attempts,
            success=data.get("success", False),
            degradation_triggered=data.get("degradation_triggered", False),
            retry_count=data.get("retry_count", 0),
            circuit_triggered=data.get("circuit_triggered", False),
            budget_exceeded=data.get("budget_exceeded", False),
            sensitive_blocked=data.get("sensitive_blocked", False),
            hit_reason=data.get("hit_reason"),
            timestamp=timestamp,
            metadata=data.get("metadata", {}),
        )
    
    def _summary_to_dict(self, summary: RunSummary) -> Dict[str, Any]:
        """将 RunSummary 转换为字典"""
        return {
            "run_id": summary.run_id,
            "policy_name": summary.policy_name,
            "policy_version": summary.policy_version,
            "total_cases": summary.total_cases,
            "success_count": summary.success_count,
            "failed_count": summary.failed_count,
            "total_cost": summary.total_cost,
            "avg_latency_ms": summary.avg_latency_ms,
            "p50_latency_ms": summary.p50_latency_ms,
            "p95_latency_ms": summary.p95_latency_ms,
            "p99_latency_ms": summary.p99_latency_ms,
            "failure_rate": summary.failure_rate,
            "success_rate": summary.success_rate,
            "degradation_rate": summary.degradation_rate,
            "retry_rate": summary.retry_rate,
            "model_distribution": summary.model_distribution,
            "status_distribution": summary.status_distribution,
            "hit_reasons": summary.hit_reasons,
            "timestamp": summary.timestamp.isoformat() if summary.timestamp else None,
        }
    
    def _dict_to_summary(self, data: Dict[str, Any]) -> RunSummary:
        """将字典转换为 RunSummary"""
        timestamp = data.get("timestamp")
        if timestamp:
            timestamp = datetime.fromisoformat(timestamp)
        
        return RunSummary(
            run_id=data["run_id"],
            policy_name=data["policy_name"],
            policy_version=data["policy_version"],
            total_cases=data["total_cases"],
            success_count=data["success_count"],
            failed_count=data["failed_count"],
            total_cost=data["total_cost"],
            avg_latency_ms=data["avg_latency_ms"],
            p50_latency_ms=data["p50_latency_ms"],
            p95_latency_ms=data["p95_latency_ms"],
            p99_latency_ms=data["p99_latency_ms"],
            failure_rate=data["failure_rate"],
            success_rate=data["success_rate"],
            degradation_rate=data["degradation_rate"],
            retry_rate=data["retry_rate"],
            model_distribution=data.get("model_distribution", {}),
            status_distribution=data.get("status_distribution", {}),
            hit_reasons=data.get("hit_reasons", {}),
            timestamp=timestamp,
        )
    
    def save_run(
        self,
        run_id: str,
        results: List[RouteResult],
        summary: Optional[RunSummary] = None
    ) -> Path:
        """保存一次运行的所有结果"""
        run_file = self._runs_dir / f"{run_id}.jsonl"
        
        with open(run_file, "w", encoding="utf-8") as f:
            for result in results:
                line = json.dumps(self._result_to_dict(result), ensure_ascii=False)
                f.write(line + "\n")
        
        if summary:
            summary_file = self._summaries_dir / f"{run_id}.json"
            with open(summary_file, "w", encoding="utf-8") as f:
                json.dump(self._summary_to_dict(summary), f, ensure_ascii=False, indent=2)
        
        return run_file
    
    def load_run(self, run_id: str) -> List[RouteResult]:
        """加载一次运行的所有结果"""
        run_file = self._runs_dir / f"{run_id}.jsonl"
        
        if not run_file.exists():
            raise FileNotFoundError(f"Run {run_id} not found")
        
        results = []
        with open(run_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    data = json.loads(line)
                    results.append(self._dict_to_result(data))
        
        return results
    
    def load_summary(self, run_id: str) -> Optional[RunSummary]:
        """加载一次运行的摘要"""
        summary_file = self._summaries_dir / f"{run_id}.json"
        
        if not summary_file.exists():
            return None
        
        with open(summary_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return self._dict_to_summary(data)
    
    def list_runs(self) -> List[Dict[str, Any]]:
        """列出所有运行记录"""
        runs = []
        
        for run_file in sorted(self._runs_dir.glob("*.jsonl")):
            run_id = run_file.stem
            summary = self.load_summary(run_id)
            
            run_info = {
                "run_id": run_id,
                "file_path": str(run_file),
                "modified_time": datetime.fromtimestamp(run_file.stat().st_mtime),
            }
            
            if summary:
                run_info.update({
                    "policy_name": summary.policy_name,
                    "policy_version": summary.policy_version,
                    "total_cases": summary.total_cases,
                    "success_rate": summary.success_rate,
                    "total_cost": summary.total_cost,
                    "timestamp": summary.timestamp,
                })
            
            runs.append(run_info)
        
        return runs
    
    def delete_run(self, run_id: str) -> bool:
        """删除一次运行记录"""
        run_file = self._runs_dir / f"{run_id}.jsonl"
        summary_file = self._summaries_dir / f"{run_id}.json"
        
        deleted = False
        if run_file.exists():
            run_file.unlink()
            deleted = True
        
        if summary_file.exists():
            summary_file.unlink()
            deleted = True
        
        return deleted
    
    def get_run_results_by_test_case(self, run_id: str, test_case_id: str) -> Optional[RouteResult]:
        """根据测试用例 ID 获取特定结果"""
        results = self.load_run(run_id)
        for result in results:
            if result.test_case_id == test_case_id:
                return result
        return None

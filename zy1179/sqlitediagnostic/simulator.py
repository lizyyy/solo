"""模拟模块 - 回放请求时间线并模拟参数变化"""

import copy
import random
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .models import (
    ImportedData,
    SimulationResult,
    WorkloadTransaction,
    WorkloadOperation
)


class Simulator:
    def __init__(self, data: ImportedData):
        self.data = data
        self.base_config = {
            "journal_mode": "wal",
            "checkpoint_mode": "passive",
            "busy_timeout_ms": 5000,
            "batch_size": 100,
            "wal_autocheckpoint": 1000,
        }
    
    def run_simulations(self, test_params: Dict[str, List[Any]]) -> Dict[str, Any]:
        results = {
            "baseline": self._run_baseline_simulation(),
            "comparisons": [],
            "recommendations": []
        }
        
        for param_name, values in test_params.items():
            if not values:
                continue
            
            param_results = []
            for value in values:
                config = copy.deepcopy(self.base_config)
                
                if param_name == "batch_sizes":
                    config["batch_size"] = value
                elif param_name == "journal_modes":
                    config["journal_mode"] = value
                elif param_name == "checkpoint_modes":
                    config["checkpoint_mode"] = value
                elif param_name == "busy_timeouts":
                    config["busy_timeout_ms"] = value
                
                result = self._run_single_simulation(config, param_name, value)
                param_results.append(result)
            
            if param_results:
                results["comparisons"].append({
                    "parameter": param_name,
                    "results": param_results
                })
                
                recommendation = self._generate_recommendation(param_name, param_results)
                if recommendation:
                    results["recommendations"].append(recommendation)
        
        return results
    
    def _run_baseline_simulation(self) -> SimulationResult:
        return self._run_single_simulation(self.base_config, "baseline", None)
    
    def _run_single_simulation(self, config: Dict[str, Any], 
                                param_name: str, param_value: Any) -> SimulationResult:
        operations = self.data.workload_operations
        transactions = self.data.workload_transactions
        
        total_ops = len(operations)
        successful = 0
        failed = 0
        total_duration = 0.0
        lock_conflicts = 0
        wal_pages = 0
        checkpoint_count = 0
        busy_timeouts = 0
        
        sim_transactions = []
        
        journal_mode = config.get("journal_mode", "wal")
        checkpoint_mode = config.get("checkpoint_mode", "passive")
        busy_timeout = config.get("busy_timeout_ms", 5000)
        batch_size = config.get("batch_size", 100)
        wal_autocheckpoint = config.get("wal_autocheckpoint", 1000)
        
        pending_writes = 0
        max_wal_pages = 0
        
        for txn in transactions:
            txn_duration = txn.duration_ms
            txn_conflicts = 0
            txn_successful = True
            
            if not txn.is_read_only:
                write_ops = [op for op in txn.operations 
                           if op.operation_type in ["INSERT", "UPDATE", "DELETE"]]
                
                if write_ops:
                    if journal_mode == "wal":
                        wal_pages += len(write_ops)
                        max_wal_pages = max(max_wal_pages, wal_pages)
                        
                        if wal_pages >= wal_autocheckpoint:
                            checkpoint_count += 1
                            
                            if checkpoint_mode == "truncate":
                                wal_pages = 0
                            elif checkpoint_mode == "restart":
                                wal_pages = max(0, wal_pages - wal_autocheckpoint)
                            else:
                                wal_pages = max(0, wal_pages - wal_autocheckpoint // 2)
                        
                        if txn.is_read_only and txn_duration > 10000:
                            lock_conflicts += 1
                            txn_conflicts += 1
                            
                            if random.random() < 0.3:
                                failed += 1
                                txn_successful = False
                    else:
                        lock_conflicts += len(write_ops) // 10
                        txn_conflicts += len(write_ops) // 10
            
            for op in txn.operations:
                op_duration = op.duration_ms
                
                if journal_mode != "wal" and not txn.is_read_only:
                    op_duration *= 1.5
                
                if pending_writes > batch_size:
                    op_duration *= 1.2
                    pending_writes = 0
                
                if lock_conflicts > 0:
                    if op_duration > busy_timeout:
                        busy_timeouts += 1
                        failed += 1
                        txn_successful = False
                    else:
                        op_duration += lock_conflicts * 10
                
                total_duration += op_duration
                
                if not txn.is_read_only:
                    pending_writes += 1
            
            if txn_successful:
                successful += len(txn.operations)
            else:
                failed += len(txn.operations)
            
            sim_transactions.append({
                "transaction_id": txn.transaction_id,
                "is_read_only": txn.is_read_only,
                "duration_ms": round(txn_duration, 2),
                "operations_count": len(txn.operations),
                "lock_conflicts": txn_conflicts,
                "successful": txn_successful,
            })
        
        avg_duration = total_duration / total_ops if total_ops > 0 else 0
        
        return SimulationResult(
            parameter_name=param_name,
            parameter_value=param_value,
            total_operations=total_ops,
            successful_operations=successful,
            failed_operations=failed,
            total_duration_ms=round(total_duration, 2),
            avg_duration_ms=round(avg_duration, 2),
            lock_conflicts=lock_conflicts,
            wal_growth_pages=max_wal_pages,
            checkpoint_count=checkpoint_count,
            busy_timeouts=busy_timeouts,
            transactions=sim_transactions[:50]
        )
    
    def _generate_recommendation(self, param_name: str, 
                                  results: List[SimulationResult]) -> Optional[Dict[str, Any]]:
        if len(results) < 2:
            return None
        
        sorted_results = sorted(results, key=lambda r: r.avg_duration_ms)
        best = sorted_results[0]
        worst = sorted_results[-1]
        
        improvement_pct = 0
        if worst.avg_duration_ms > 0:
            improvement_pct = round((1 - best.avg_duration_ms / worst.avg_duration_ms) * 100, 1)
        
        param_display = {
            "batch_sizes": "batch size",
            "journal_modes": "journal mode",
            "checkpoint_modes": "checkpoint mode",
            "busy_timeouts": "busy timeout",
        }.get(param_name, param_name)
        
        return {
            "parameter": param_display,
            "recommended_value": best.parameter_value,
            "worst_value": worst.parameter_value,
            "improvement_percent": improvement_pct,
            "details": {
                "best_avg_duration_ms": best.avg_duration_ms,
                "worst_avg_duration_ms": worst.avg_duration_ms,
                "best_lock_conflicts": best.lock_conflicts,
                "worst_lock_conflicts": worst.lock_conflicts,
                "best_wal_growth_pages": best.wal_growth_pages,
                "worst_wal_growth_pages": worst.wal_growth_pages,
            }
        }


class WorkloadGenerator:
    @staticmethod
    def generate_workload(num_transactions: int = 100, 
                          read_ratio: float = 0.7,
                          max_txn_duration_ms: float = 5000) -> List[WorkloadTransaction]:
        transactions = []
        
        for i in range(num_transactions):
            is_read_only = random.random() < read_ratio
            num_ops = random.randint(1, 10)
            operations = []
            
            base_time = datetime.now() + timedelta(milliseconds=i * 100)
            
            for j in range(num_ops):
                op_time = base_time + timedelta(milliseconds=j * 10)
                
                if is_read_only:
                    op_type = "SELECT"
                else:
                    op_type = random.choice(["INSERT", "UPDATE", "DELETE"])
                
                tables = ["users", "orders", "products", "transactions", "logs"]
                table_name = random.choice(tables)
                
                duration = random.uniform(1, max_txn_duration_ms / num_ops)
                rows_affected = random.randint(1, 100) if op_type != "SELECT" else random.randint(0, 1000)
                
                operations.append(WorkloadOperation(
                    timestamp=op_time,
                    operation_type=op_type,
                    table_name=table_name,
                    sql=f"{op_type} FROM {table_name} WHERE id = {random.randint(1, 10000)}",
                    duration_ms=duration,
                    rows_affected=rows_affected,
                    connection_id=f"conn_{random.randint(1, 10)}",
                    transaction_id=f"txn_{i}"
                ))
            
            start_time = operations[0].timestamp if operations else base_time
            end_time = operations[-1].timestamp + timedelta(milliseconds=operations[-1].duration_ms) if operations else start_time
            duration_ms = (end_time - start_time).total_seconds() * 1000
            
            transactions.append(WorkloadTransaction(
                transaction_id=f"txn_{i}",
                connection_id=f"conn_{random.randint(1, 10)}",
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                is_read_only=is_read_only,
                operations=operations,
                commit_success=True
            ))
        
        return transactions

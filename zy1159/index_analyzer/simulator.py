"""
Index Simulator - Simulates query performance improvements and write cost impacts.
"""

import re
from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    CandidateIndex,
    DatabaseType,
    ExplainPlanNode,
    ExplainResult,
    Index,
    IndexType,
    InputDataSet,
    Schema,
    SimulationResult,
    SlowQuery,
    Table,
    TableStats,
    WriteLoadMetrics,
)
from .parsers import extract_where_columns


class IndexSimulator:
    def __init__(self, dataset: InputDataSet):
        self.dataset = dataset
        self.original_schema = dataset.schema
        self.modified_schema = None
    
    def simulate_candidate(
        self,
        candidate: CandidateIndex,
        operation: str = "add",
    ) -> SimulationResult:
        if operation == "add":
            return self._simulate_add_index(candidate)
        elif operation == "drop":
            return self._simulate_drop_index(candidate)
        else:
            raise ValueError(f"Unknown operation: {operation}")
    
    def _simulate_add_index(self, candidate: CandidateIndex) -> SimulationResult:
        before_stats = self._collect_current_stats(candidate.table_name)
        
        covered_queries = self._find_covered_queries(candidate)
        query_improvements = []
        
        for query in covered_queries:
            improvement = self._estimate_query_improvement(query, candidate)
            query_improvements.append({
                "query_id": query.query_id,
                "original_execution_time_ms": query.execution_time_ms,
                "estimated_execution_time_ms": query.execution_time_ms * (1 - improvement / 100),
                "improvement_pct": improvement,
                "reason": f"Index covers columns: {candidate.columns}",
            })
        
        write_cost_analysis = self._estimate_write_cost_impact(candidate, "add")
        
        total_improvement = sum(q["improvement_pct"] for q in query_improvements)
        avg_improvement = total_improvement / len(query_improvements) if query_improvements else 0
        
        write_cost_pct = write_cost_analysis.get("estimated_increase_pct", 0)
        overall_score_change = (avg_improvement * len(query_improvements) * 0.1) - write_cost_pct
        
        after_stats = deepcopy(before_stats)
        if "indexes_count" in after_stats:
            after_stats["indexes_count"] += 1
        
        return SimulationResult(
            candidate_index=candidate,
            before_stats=before_stats,
            after_stats=after_stats,
            query_improvements=query_improvements,
            write_cost_analysis=write_cost_analysis,
            overall_score_change=overall_score_change,
        )
    
    def _simulate_drop_index(self, candidate: CandidateIndex) -> SimulationResult:
        before_stats = self._collect_current_stats(candidate.table_name)
        
        affected_queries = self._find_queries_using_index(candidate)
        query_improvements = []
        
        for query in affected_queries:
            regression = self._estimate_query_regression(query, candidate)
            query_improvements.append({
                "query_id": query.query_id,
                "original_execution_time_ms": query.execution_time_ms,
                "estimated_execution_time_ms": query.execution_time_ms * (1 + regression / 100),
                "improvement_pct": -regression,
                "reason": f"Index {candidate.index_name} was used by this query",
            })
        
        write_cost_analysis = self._estimate_write_cost_impact(candidate, "drop")
        
        total_regression = sum(abs(q["improvement_pct"]) for q in query_improvements)
        avg_regression = total_regression / len(query_improvements) if query_improvements else 0
        
        write_savings_pct = write_cost_analysis.get("estimated_savings_pct", 0)
        overall_score_change = write_savings_pct - (avg_regression * len(query_improvements) * 0.1)
        
        after_stats = deepcopy(before_stats)
        if "indexes_count" in after_stats:
            after_stats["indexes_count"] = max(0, after_stats["indexes_count"] - 1)
        
        return SimulationResult(
            candidate_index=candidate,
            before_stats=before_stats,
            after_stats=after_stats,
            query_improvements=query_improvements,
            write_cost_analysis=write_cost_analysis,
            overall_score_change=overall_score_change,
        )
    
    def _collect_current_stats(self, table_name: str) -> Dict[str, Any]:
        stats: Dict[str, Any] = {
            "table_name": table_name,
            "indexes_count": 0,
            "row_count": None,
            "data_size_bytes": None,
            "index_size_bytes": None,
            "total_write_ops_per_sec": 0.0,
        }
        
        if self.original_schema and table_name in self.original_schema.tables:
            table = self.original_schema.tables[table_name]
            stats["indexes_count"] = len(table.indexes)
            stats["row_count"] = table.row_count
            stats["size_bytes"] = table.size_bytes
        
        for table_stats in self.dataset.table_stats:
            if table_stats.table_name == table_name:
                stats["row_count"] = table_stats.row_count
                stats["data_size_bytes"] = table_stats.data_size_bytes
                stats["index_size_bytes"] = table_stats.index_size_bytes
                break
        
        total_write_ops = 0.0
        count = 0
        for write_load in self.dataset.write_load:
            if write_load.table_name == table_name:
                total_write_ops += write_load.total_write_ops
                count += 1
        
        if count > 0:
            stats["total_write_ops_per_sec"] = total_write_ops / count
        
        return stats
    
    def _collect_overall_state(self) -> Dict[str, Any]:
        state: Dict[str, Any] = {
            "total_tables": 0,
            "total_indexes": 0,
            "total_slow_queries": len(self.dataset.slow_queries),
            "tables": {},
        }
        
        if self.original_schema:
            state["total_tables"] = len(self.original_schema.tables)
            for table_name, table in self.original_schema.tables.items():
                state["total_indexes"] += len(table.indexes)
                state["tables"][table_name] = {
                    "indexes_count": len(table.indexes),
                    "columns_count": len(table.columns),
                }
        
        return state
    
    def _find_covered_queries(self, candidate: CandidateIndex) -> List[SlowQuery]:
        covered = []
        
        for query in self.dataset.slow_queries:
            if candidate.table_name not in query.tables_involved:
                continue
            
            where_cols = extract_where_columns(query.query)
            
            if not where_cols:
                continue
            
            if candidate.columns[0] in where_cols:
                prefix_match = True
                for i, col in enumerate(candidate.columns):
                    if i >= len(where_cols) or where_cols[i] != col:
                        if i > 0:
                            break
                        else:
                            prefix_match = False
                            break
                
                if prefix_match:
                    covered.append(query)
        
        return covered
    
    def _find_queries_using_index(self, candidate: CandidateIndex) -> List[SlowQuery]:
        using = []
        
        for query in self.dataset.slow_queries:
            if candidate.table_name not in query.tables_involved:
                continue
            
            where_cols = extract_where_columns(query.query)
            
            for col in candidate.columns:
                if col in where_cols:
                    using.append(query)
                    break
        
        return using
    
    def _estimate_query_improvement(
        self, 
        query: SlowQuery, 
        candidate: CandidateIndex
    ) -> float:
        base_improvement = 30.0
        
        if query.execution_time_ms > 1000:
            base_improvement += 30.0
        elif query.execution_time_ms > 100:
            base_improvement += 15.0
        
        if query.rows_examined:
            if query.rows_examined > 100000:
                base_improvement += 25.0
            elif query.rows_examined > 10000:
                base_improvement += 15.0
            elif query.rows_examined > 1000:
                base_improvement += 5.0
        
        where_cols = extract_where_columns(query.query)
        matched_cols = 0
        for col in candidate.columns:
            if col in where_cols:
                matched_cols += 1
        
        if matched_cols == len(candidate.columns):
            base_improvement += 10.0
        elif matched_cols > 0:
            base_improvement += 5.0
        
        for explain_result in self.dataset.explain_results:
            if query.normalized_query == explain_result.normalized_query:
                if candidate.table_name in explain_result.table_scans:
                    base_improvement += 20.0
                break
        
        return min(base_improvement, 95.0)
    
    def _estimate_query_regression(
        self, 
        query: SlowQuery, 
        candidate: CandidateIndex
    ) -> float:
        base_regression = 20.0
        
        if query.execution_time_ms > 500:
            base_regression += 30.0
        elif query.execution_time_ms > 100:
            base_regression += 15.0
        
        if query.rows_examined and query.rows_examined > 10000:
            base_regression += 20.0
        
        where_cols = extract_where_columns(query.query)
        matched_cols = sum(1 for col in candidate.columns if col in where_cols)
        
        if matched_cols == len(candidate.columns):
            base_regression += 15.0
        
        return min(base_regression, 200.0)
    
    def _estimate_write_cost_impact(
        self, 
        candidate: CandidateIndex, 
        operation: str
    ) -> Dict[str, Any]:
        analysis: Dict[str, Any] = {
            "operation": operation,
            "table_name": candidate.table_name,
            "index_columns": candidate.columns,
            "index_type": candidate.index_type.value,
        }
        
        num_cols = len(candidate.columns)
        base_cost_per_col = 3.0
        
        write_loads = [
            wl for wl in self.dataset.write_load 
            if wl.table_name == candidate.table_name
        ]
        
        avg_write_ops = 0.0
        avg_latency = 0.0
        
        if write_loads:
            avg_write_ops = sum(wl.total_write_ops for wl in write_loads) / len(write_loads)
            avg_latency = sum(wl.avg_write_latency_ms for wl in write_loads) / len(write_loads)
        
        analysis["current_avg_write_ops_per_sec"] = avg_write_ops
        analysis["current_avg_write_latency_ms"] = avg_latency
        
        load_multiplier = 1.0
        if avg_write_ops > 1000:
            load_multiplier = 2.5
        elif avg_write_ops > 100:
            load_multiplier = 1.5
        
        estimated_change_pct = base_cost_per_col * num_cols * load_multiplier
        
        if candidate.index_type == IndexType.GIN:
            estimated_change_pct *= 1.5
        elif candidate.index_type == IndexType.HASH:
            estimated_change_pct *= 0.7
        
        if operation == "add":
            analysis["estimated_increase_pct"] = estimated_change_pct
            analysis["estimated_new_latency_ms"] = avg_latency * (1 + estimated_change_pct / 100)
            
            table_stats = None
            for ts in self.dataset.table_stats:
                if ts.table_name == candidate.table_name:
                    table_stats = ts
                    break
            
            if table_stats:
                row_size_est = table_stats.data_size_bytes / table_stats.row_count if table_stats.row_count > 0 else 100
                index_size_est = row_size_est * num_cols * 0.3
                estimated_index_size = table_stats.row_count * index_size_est
                analysis["estimated_index_size_bytes"] = estimated_index_size
                analysis["estimated_total_size_increase_pct"] = (
                    (estimated_index_size / (table_stats.data_size_bytes + table_stats.index_size_bytes)) * 100
                    if (table_stats.data_size_bytes + table_stats.index_size_bytes) > 0 else 0
                )
        
        else:
            analysis["estimated_savings_pct"] = estimated_change_pct
            analysis["estimated_new_latency_ms"] = avg_latency * max(0.5, (1 - estimated_change_pct / 100))
        
        if operation == "add":
            if avg_write_ops > 500:
                analysis["risk_level"] = "high"
                analysis["risk_reason"] = "High write volume may cause significant performance degradation"
            elif avg_write_ops > 100:
                analysis["risk_level"] = "medium"
                analysis["risk_reason"] = "Moderate write volume, monitor performance after adding index"
            else:
                analysis["risk_level"] = "low"
                analysis["risk_reason"] = "Low write volume, minimal impact expected"
        else:
            if avg_write_ops > 100:
                analysis["benefit_level"] = "high"
                analysis["benefit_reason"] = "High write volume will see significant performance improvement"
            elif avg_write_ops > 10:
                analysis["benefit_level"] = "medium"
                analysis["benefit_reason"] = "Moderate write volume will see some improvement"
            else:
                analysis["benefit_level"] = "low"
                analysis["benefit_reason"] = "Low write volume, minimal improvement expected"
        
        return analysis
    
    def compare_indexes(
        self,
        candidates: List[CandidateIndex],
    ) -> Dict[str, Any]:
        comparison = {
            "timestamp": datetime.now().isoformat(),
            "candidates_compared": len(candidates),
            "results": [],
            "recommendation": None,
        }
        
        simulation_results = []
        for candidate in candidates:
            result = self.simulate_candidate(candidate, "add")
            simulation_results.append(result)
            
            comparison["results"].append({
                "index_name": candidate.index_name,
                "table_name": candidate.table_name,
                "columns": candidate.columns,
                "net_score": result.overall_score_change,
                "queries_covered": len(result.query_improvements),
                "avg_improvement_pct": (
                    sum(q["improvement_pct"] for q in result.query_improvements) / len(result.query_improvements)
                    if result.query_improvements else 0
                ),
                "write_cost_increase_pct": result.write_cost_analysis.get("estimated_increase_pct", 0),
                "risk_level": result.write_cost_analysis.get("risk_level", "unknown"),
            })
        
        if simulation_results:
            best_result = max(simulation_results, key=lambda r: r.overall_score_change)
            comparison["recommendation"] = {
                "recommended_index": best_result.candidate_index.index_name,
                "reason": f"Highest net score ({best_result.overall_score_change:.2f}) with "
                         f"{len(best_result.query_improvements)} queries covered and "
                         f"{best_result.write_cost_analysis.get('estimated_increase_pct', 0):.1f}% write cost increase",
                "details": {
                    "net_score": best_result.overall_score_change,
                    "queries_covered": len(best_result.query_improvements),
                    "write_cost_risk": best_result.write_cost_analysis.get("risk_level", "unknown"),
                }
            }
        
        comparison["results"].sort(key=lambda x: x["net_score"], reverse=True)
        
        return comparison
    
    def simulate_scenario(
        self,
        add_indexes: List[CandidateIndex] = None,
        drop_indexes: List[CandidateIndex] = None,
    ) -> Dict[str, Any]:
        add_indexes = add_indexes or []
        drop_indexes = drop_indexes or []
        
        scenario = {
            "timestamp": datetime.now().isoformat(),
            "scenario": {
                "indexes_to_add": [idx.index_name for idx in add_indexes],
                "indexes_to_drop": [idx.index_name for idx in drop_indexes],
            },
            "before_state": self._collect_overall_state(),
            "simulations": [],
            "after_state": None,
            "summary": {},
        }
        
        total_query_improvement = 0.0
        total_write_cost_change = 0.0
        queries_affected = set()
        
        for idx in add_indexes:
            result = self.simulate_candidate(idx, "add")
            scenario["simulations"].append({
                "operation": "add",
                "index_name": idx.index_name,
                "result": result.model_dump(),
            })
            
            for q in result.query_improvements:
                queries_affected.add(q["query_id"])
                total_query_improvement += q["improvement_pct"]
            
            total_write_cost_change += result.write_cost_analysis.get("estimated_increase_pct", 0)
        
        for idx in drop_indexes:
            result = self.simulate_candidate(idx, "drop")
            scenario["simulations"].append({
                "operation": "drop",
                "index_name": idx.index_name,
                "result": result.model_dump(),
            })
            
            for q in result.query_improvements:
                queries_affected.add(q["query_id"])
                total_query_improvement += q["improvement_pct"]
            
            total_write_cost_change -= result.write_cost_analysis.get("estimated_savings_pct", 0)
        
        before_state = scenario["before_state"]
        after_state = deepcopy(before_state)
        
        after_state["total_indexes"] = (
            before_state.get("total_indexes", 0) + len(add_indexes) - len(drop_indexes)
        )
        
        scenario["after_state"] = after_state
        
        num_queries = len(queries_affected)
        avg_improvement = total_query_improvement / num_queries if num_queries > 0 else 0
        
        scenario["summary"] = {
            "queries_affected": num_queries,
            "total_query_improvement_pct": total_query_improvement,
            "avg_query_improvement_pct": avg_improvement,
            "total_write_cost_change_pct": total_write_cost_change,
            "net_impact_score": (avg_improvement * num_queries * 0.1) - abs(total_write_cost_change),
        }
        
        return scenario

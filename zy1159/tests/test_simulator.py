"""
Tests for Index Simulator.
"""

import pytest

from index_analyzer.models import (
    CandidateIndex,
    DatabaseType,
    Index,
    IndexType,
    InputDataSet,
    Schema,
    SlowQuery,
    Table,
    Column,
    TableStats,
    WriteLoadMetrics,
)
from index_analyzer.simulator import IndexSimulator


class TestIndexSimulation:
    def test_simulate_add_index_basic(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        slow_queries = [
            SlowQuery(
                query_id="q1",
                query="SELECT * FROM users WHERE email = 'test@example.com'",
                normalized_query="SELECT * FROM users WHERE email = '?'",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=2500,
                frequency=150,
                tables_involved=["users"],
            ),
        ]
        
        dataset = InputDataSet(schema=schema, slow_queries=slow_queries)
        
        candidate = CandidateIndex(
            index_name="idx_users_email",
            table_name="users",
            columns=["email"],
            index_type=IndexType.BTREE,
        )
        
        simulator = IndexSimulator(dataset=dataset)
        result = simulator.simulate_candidate(candidate, "add")
        
        assert result.candidate_index == candidate
        assert len(result.query_improvements) > 0
        assert result.overall_score_change is not None
    
    def test_simulate_drop_index(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
                Index(
                    name="idx_users_email",
                    columns=["email"],
                    index_type=IndexType.BTREE,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        slow_queries = [
            SlowQuery(
                query_id="q1",
                query="SELECT * FROM users WHERE email = 'test@example.com'",
                normalized_query="SELECT * FROM users WHERE email = '?'",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=50,
                frequency=150,
                tables_involved=["users"],
            ),
        ]
        
        dataset = InputDataSet(schema=schema, slow_queries=slow_queries)
        
        candidate = CandidateIndex(
            index_name="idx_users_email",
            table_name="users",
            columns=["email"],
            index_type=IndexType.BTREE,
        )
        
        simulator = IndexSimulator(dataset=dataset)
        result = simulator.simulate_candidate(candidate, "drop")
        
        assert result.candidate_index == candidate
        assert "estimated_savings_pct" in result.write_cost_analysis


class TestWriteCostAnalysis:
    def test_write_cost_with_high_write_load(self):
        table = Table(
            name="orders",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="status", data_type="VARCHAR(20)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="orders",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"orders": table},
        )
        
        write_load = [
            WriteLoadMetrics(
                table_name="orders",
                timestamp="2024-01-01T10:00:00",
                insert_rate=1500.0,
                update_rate=2500.0,
                delete_rate=50.0,
                total_write_ops=4050.0,
                avg_write_latency_ms=5.2,
            ),
        ]
        
        dataset = InputDataSet(schema=schema, write_load=write_load)
        
        candidate = CandidateIndex(
            index_name="idx_orders_status",
            table_name="orders",
            columns=["status"],
            index_type=IndexType.BTREE,
        )
        
        simulator = IndexSimulator(dataset=dataset)
        result = simulator.simulate_candidate(candidate, "add")
        
        risk_level = result.write_cost_analysis.get("risk_level", "unknown")
        assert risk_level in ["medium", "high"]
    
    def test_write_cost_with_low_write_load(self):
        table = Table(
            name="categories",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="name", data_type="VARCHAR(100)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="categories",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"categories": table},
        )
        
        write_load = [
            WriteLoadMetrics(
                table_name="categories",
                timestamp="2024-01-01T10:00:00",
                insert_rate=5.0,
                update_rate=10.0,
                delete_rate=1.0,
                total_write_ops=16.0,
                avg_write_latency_ms=2.1,
            ),
        ]
        
        dataset = InputDataSet(schema=schema, write_load=write_load)
        
        candidate = CandidateIndex(
            index_name="idx_categories_name",
            table_name="categories",
            columns=["name"],
            index_type=IndexType.BTREE,
        )
        
        simulator = IndexSimulator(dataset=dataset)
        result = simulator.simulate_candidate(candidate, "add")
        
        risk_level = result.write_cost_analysis.get("risk_level", "unknown")
        assert risk_level == "low"


class TestComparison:
    def test_compare_multiple_indexes(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
                Column(name="status", data_type="VARCHAR(20)"),
                Column(name="created_at", data_type="DATETIME"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        slow_queries = [
            SlowQuery(
                query_id="q1",
                query="SELECT * FROM users WHERE email = 'test@example.com' AND status = 'active'",
                normalized_query="SELECT * FROM users WHERE email = '?' AND status = '?'",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=2500,
                frequency=150,
                tables_involved=["users"],
            ),
            SlowQuery(
                query_id="q2",
                query="SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC",
                normalized_query="SELECT * FROM users WHERE status = '?' ORDER BY created_at DESC",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=3000,
                frequency=100,
                tables_involved=["users"],
            ),
        ]
        
        dataset = InputDataSet(schema=schema, slow_queries=slow_queries)
        
        candidates = [
            CandidateIndex(
                index_name="idx_users_email",
                table_name="users",
                columns=["email"],
                index_type=IndexType.BTREE,
            ),
            CandidateIndex(
                index_name="idx_users_email_status",
                table_name="users",
                columns=["email", "status"],
                index_type=IndexType.BTREE,
            ),
            CandidateIndex(
                index_name="idx_users_status_created",
                table_name="users",
                columns=["status", "created_at"],
                index_type=IndexType.BTREE,
            ),
        ]
        
        simulator = IndexSimulator(dataset=dataset)
        comparison = simulator.compare_indexes(candidates)
        
        assert len(comparison["results"]) == 3
        assert "recommendation" in comparison
        assert comparison["recommendation"] is not None


class TestScenarioSimulation:
    def test_scenario_add_multiple_changes(self):
        table = Table(
            name="orders",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="user_id", data_type="INT"),
                Column(name="status", data_type="VARCHAR(20)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="orders",
                ),
                Index(
                    name="idx_redundant",
                    columns=["user_id"],
                    index_type=IndexType.BTREE,
                    table_name="orders",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"orders": table},
        )
        
        dataset = InputDataSet(schema=schema)
        
        add_indexes = [
            CandidateIndex(
                index_name="idx_orders_status",
                table_name="orders",
                columns=["status"],
                index_type=IndexType.BTREE,
            ),
        ]
        
        drop_indexes = [
            CandidateIndex(
                index_name="idx_redundant",
                table_name="orders",
                columns=["user_id"],
                index_type=IndexType.BTREE,
            ),
        ]
        
        simulator = IndexSimulator(dataset=dataset)
        scenario = simulator.simulate_scenario(
            add_indexes=add_indexes,
            drop_indexes=drop_indexes,
        )
        
        assert scenario["before_state"] is not None
        assert scenario["after_state"] is not None
        assert len(scenario["simulations"]) == 2
        assert "summary" in scenario


class TestQueryImprovementEstimation:
    def test_improvement_higher_for_slower_queries(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        slow_query_fast = SlowQuery(
            query_id="q1",
            query="SELECT * FROM users WHERE email = 'fast@example.com'",
            normalized_query="SELECT * FROM users WHERE email = '?'",
            db_type=DatabaseType.MYSQL,
            execution_time_ms=100,
            frequency=10,
            tables_involved=["users"],
        )
        
        slow_query_slow = SlowQuery(
            query_id="q2",
            query="SELECT * FROM users WHERE email = 'slow@example.com'",
            normalized_query="SELECT * FROM users WHERE email = '?'",
            db_type=DatabaseType.MYSQL,
            execution_time_ms=10000,
            frequency=10,
            tables_involved=["users"],
        )
        
        dataset_fast = InputDataSet(schema=schema, slow_queries=[slow_query_fast])
        dataset_slow = InputDataSet(schema=schema, slow_queries=[slow_query_slow])
        
        candidate = CandidateIndex(
            index_name="idx_users_email",
            table_name="users",
            columns=["email"],
            index_type=IndexType.BTREE,
        )
        
        simulator_fast = IndexSimulator(dataset=dataset_fast)
        simulator_slow = IndexSimulator(dataset=dataset_slow)
        
        result_fast = simulator_fast.simulate_candidate(candidate, "add")
        result_slow = simulator_slow.simulate_candidate(candidate, "add")
        
        assert len(result_fast.query_improvements) == 1
        assert len(result_slow.query_improvements) == 1
        
        improv_fast = result_fast.query_improvements[0]["improvement_pct"]
        improv_slow = result_slow.query_improvements[0]["improvement_pct"]
        
        assert improv_slow >= improv_fast

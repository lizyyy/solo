import os
import sys
import tempfile
from typing import Tuple

from .parser import SQLParser
from .analyzer import LockRiskAnalyzer
from .reporter import Reporter
from .models import AlterType, LockLevel, RiskLevel, TableStats


class SelfTest:
    def __init__(self, output_dir: str = "./selftest_output", verbose: bool = False):
        self.output_dir = output_dir
        self.verbose = verbose
        self.passed = 0
        self.failed = 0

    def run_all(self) -> Tuple[int, int]:
        self.passed = 0
        self.failed = 0

        os.makedirs(self.output_dir, exist_ok=True)

        self._test_sql_parser()
        self._test_lock_level_estimation()
        self._test_risk_level_estimation()
        self._test_transaction_detection()
        self._test_rollback_detection()
        self._test_concurrent_index()
        self._test_report_generation()
        self._test_exit_codes()
        self._test_edge_cases()
        self._test_table_stats_integration()

        return self.passed, self.failed

    def _assert(self, condition: bool, test_name: str, detail: str = ""):
        if condition:
            self.passed += 1
            status = "✓"
            color = "\033[92m"
        else:
            self.failed += 1
            status = "✗"
            color = "\033[91m"
        
        reset = "\033[0m"
        print(f"{color}{status}{reset} {test_name}")
        if detail and self.verbose:
            print(f"  {detail}")

    def _test_sql_parser(self):
        print("\n[SQL 解析器测试]")
        
        parser = SQLParser()

        test_cases = [
            (
                "ALTER TABLE users ADD COLUMN email VARCHAR(255);",
                AlterType.ADD_COLUMN,
                "users",
                "email"
            ),
            (
                "ALTER TABLE orders DROP COLUMN old_status;",
                AlterType.DROP_COLUMN,
                "orders",
                "old_status"
            ),
            (
                "ALTER TABLE products MODIFY COLUMN price DECIMAL(10,2);",
                AlterType.MODIFY_COLUMN,
                "products",
                "price"
            ),
            (
                "ALTER TABLE users ADD INDEX idx_email (email);",
                AlterType.ADD_INDEX,
                "users",
                None
            ),
            (
                "ALTER TABLE users DROP INDEX idx_email;",
                AlterType.DROP_INDEX,
                "users",
                None
            ),
            (
                "ALTER TABLE users RENAME TO customers;",
                AlterType.RENAME_TABLE,
                "users",
                None
            ),
            (
                "ALTER TABLE users ALTER COLUMN status SET DEFAULT 'active';",
                AlterType.ALTER_DEFAULT,
                "users",
                None
            ),
        ]

        for sql, expected_type, expected_table, expected_column in test_cases:
            result = parser.parse_content(sql)
            stmt = result.statements[0] if result.statements else None
            
            self._assert(
                stmt is not None and stmt.alter_type == expected_type,
                f"解析 {expected_type.value}"
            )
            if stmt:
                self._assert(
                    stmt.table_name == expected_table,
                    f"  表名正确: {stmt.table_name}"
                )
                if expected_column:
                    self._assert(
                        stmt.column_name == expected_column,
                        f"  列名正确: {stmt.column_name}"
                    )

    def _test_lock_level_estimation(self):
        print("\n[锁级别估计测试]")
        
        parser = SQLParser()
        analyzer = LockRiskAnalyzer()

        test_cases = [
            (
                "ALTER TABLE users ADD COLUMN temp VARCHAR(255) NULL;",
                LockLevel.METADATA,
                "可空列添加应为元数据锁"
            ),
            (
                "ALTER TABLE users ADD COLUMN temp VARCHAR(255) NOT NULL DEFAULT '';",
                LockLevel.METADATA,
                "带默认值的 NOT NULL 列应为元数据锁"
            ),
            (
                "ALTER TABLE users ADD INDEX CONCURRENTLY idx_name (name);",
                LockLevel.SHARED,
                "CONCURRENT 索引应为共享锁"
            ),
            (
                "ALTER TABLE users ADD INDEX idx_name (name) ALGORITHM=INPLACE LOCK=NONE;",
                LockLevel.METADATA,
                "ALGORITHM=INPLACE LOCK=NONE 应为元数据锁"
            ),
            (
                "ALTER TABLE users MODIFY COLUMN name VARCHAR(100);",
                LockLevel.EXCLUSIVE,
                "修改列应为排他锁"
            ),
            (
                "ALTER TABLE users DROP COLUMN old_col;",
                LockLevel.EXCLUSIVE,
                "删除列应为排他锁"
            ),
            (
                "ALTER TABLE users RENAME TO customers;",
                LockLevel.METADATA,
                "重命名表应为元数据锁"
            ),
        ]

        for sql, expected_lock, description in test_cases:
            result = parser.parse_content(sql)
            if result.statements:
                stmt = result.statements[0]
                lock_level = analyzer._estimate_lock_level(stmt)
                self._assert(
                    lock_level == expected_lock,
                    description,
                    f"期望: {expected_lock.value}, 实际: {lock_level.value}"
                )

    def _test_risk_level_estimation(self):
        print("\n[风险等级估计测试]")
        
        parser = SQLParser()
        analyzer = LockRiskAnalyzer()

        small_table = TableStats(table_name="small", row_count=1000, size_mb=10)
        large_table = TableStats(table_name="large", row_count=5000000, size_mb=5000)

        test_cases = [
            ("ALTER TABLE small MODIFY COLUMN name VARCHAR(100);", small_table, RiskLevel.HIGH),
            ("ALTER TABLE large MODIFY COLUMN name VARCHAR(100);", large_table, RiskLevel.CRITICAL),
            ("ALTER TABLE small ADD INDEX idx_name (name);", small_table, RiskLevel.HIGH),
            ("ALTER TABLE large ADD INDEX idx_name (name);", large_table, RiskLevel.CRITICAL),
            ("ALTER TABLE small ADD COLUMN col INT NULL;", small_table, RiskLevel.LOW),
            ("ALTER TABLE large ADD COLUMN col INT NULL;", large_table, RiskLevel.LOW),
        ]

        for sql, table_stat, expected_risk in test_cases:
            result = parser.parse_content(sql)
            if result.statements:
                stmt = result.statements[0]
                lock_level = analyzer._estimate_lock_level(stmt)
                risk_level = analyzer._estimate_risk_level(stmt, lock_level, table_stat)
                self._assert(
                    risk_level == expected_risk,
                    f"{table_stat.table_name} 表 {stmt.alter_type.value} 风险等级",
                    f"期望: {expected_risk.value}, 实际: {risk_level.value}"
                )

    def _test_transaction_detection(self):
        print("\n[事务包裹检测测试]")
        
        parser = SQLParser()

        sql_with_transaction = """
        START TRANSACTION;
        ALTER TABLE users ADD COLUMN test INT;
        COMMIT;
        """
        
        sql_without_transaction = """
        ALTER TABLE users ADD COLUMN test INT;
        """
        
        sql_begin_commit = """
        BEGIN;
        ALTER TABLE users ADD COLUMN test INT;
        COMMIT;
        """

        result1 = parser.parse_content(sql_with_transaction)
        result2 = parser.parse_content(sql_without_transaction)
        result3 = parser.parse_content(sql_begin_commit)

        self._assert(result1.is_wrapped_in_transaction, "检测 START TRANSACTION + COMMIT")
        self._assert(not result2.is_wrapped_in_transaction, "无事务包裹正确识别")
        self._assert(result3.is_wrapped_in_transaction, "检测 BEGIN + COMMIT")

    def _test_rollback_detection(self):
        print("\n[回滚脚本检测测试]")
        
        parser = SQLParser()
        
        with tempfile.TemporaryDirectory() as tmpdir:
            main_sql = os.path.join(tmpdir, "001_add_column.sql")
            rollback_sql = os.path.join(tmpdir, "001_add_column_rollback.sql")
            
            with open(main_sql, 'w') as f:
                f.write("ALTER TABLE users ADD COLUMN test INT;")
            
            result_no_rollback = parser.parse_file(main_sql)
            self._assert(not result_no_rollback.has_rollback_script, "无回滚脚本时正确识别")
            
            with open(rollback_sql, 'w') as f:
                f.write("ALTER TABLE users DROP COLUMN test;")
            
            result_with_rollback = parser.parse_file(main_sql)
            self._assert(
                result_with_rollback.has_rollback_script,
                "检测 *_rollback.sql 模式回滚脚本",
                f"回滚路径: {result_with_rollback.rollback_path}"
            )

    def _test_concurrent_index(self):
        print("\n[并发索引语法检测测试]")
        
        parser = SQLParser()

        test_cases = [
            ("ALTER TABLE users ADD INDEX CONCURRENTLY idx_name (name);", True),
            ("ALTER TABLE users ADD INDEX idx_name (name) ALGORITHM=INPLACE;", False),
            ("ALTER TABLE users ADD INDEX idx_name (name) ONLINE;", True),
            ("ALTER TABLE users ADD INDEX idx_name (name);", False),
            ("ALTER TABLE users ADD INDEX idx_name (name) LOCK=NONE;", False),
        ]

        for sql, expected_concurrent in test_cases:
            result = parser.parse_content(sql)
            if result.statements:
                stmt = result.statements[0]
                is_concurrent = stmt.is_concurrent or stmt.is_online
                self._assert(
                    is_concurrent == expected_concurrent,
                    f"检测并发语法: {'CONCURRENTLY/ONLINE' if expected_concurrent else '普通'}"
                )

    def _test_report_generation(self):
        print("\n[报告生成测试]")
        
        parser = SQLParser()
        analyzer = LockRiskAnalyzer()
        reporter = Reporter(output_dir=self.output_dir)

        test_sql = """
        ALTER TABLE users ADD COLUMN email VARCHAR(255) NOT NULL;
        ALTER TABLE orders ADD INDEX idx_user_id (user_id);
        """
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
            f.write(test_sql)
            test_file = f.name
        
        try:
            result = analyzer.analyze_files([test_file])
            
            json_path = os.path.join(self.output_dir, "test_report.json")
            md_path = os.path.join(self.output_dir, "test_report.md")
            
            reporter.generate_json(result, json_path)
            reporter.generate_markdown(result, md_path)
            
            self._assert(os.path.exists(json_path), "JSON 报告生成", f"路径: {json_path}")
            self._assert(os.path.exists(md_path), "Markdown 报告生成", f"路径: {md_path}")
            
            self._assert(result.exit_code in [0, 1, 2, 3], "退出码在有效范围内")
            
        finally:
            os.unlink(test_file)

    def _test_exit_codes(self):
        print("\n[退出码测试]")
        
        parser = SQLParser()
        analyzer = LockRiskAnalyzer()

        critical_sql = "ALTER TABLE large_table MODIFY COLUMN name VARCHAR(100);"
        high_sql = "ALTER TABLE small_table MODIFY COLUMN name VARCHAR(100);"
        safe_sql = "ALTER TABLE users ADD COLUMN col INT NULL;"

        analyzer.table_stats["large_table"] = TableStats(
            table_name="large_table",
            row_count=5000000,
            size_mb=5000
        )
        analyzer.table_stats["small_table"] = TableStats(
            table_name="small_table",
            row_count=1000,
            size_mb=10
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            critical_file = os.path.join(tmpdir, "critical.sql")
            high_file = os.path.join(tmpdir, "high.sql")
            safe_file = os.path.join(tmpdir, "safe.sql")
            
            with open(critical_file, 'w') as f:
                f.write(critical_sql)
            with open(high_file, 'w') as f:
                f.write(high_sql)
            with open(safe_file, 'w') as f:
                f.write(safe_sql)
            
            result_critical = analyzer.analyze_files([critical_file])
            result_high = analyzer.analyze_files([high_file])
            result_safe = analyzer.analyze_files([safe_file])
            
            self._assert(result_critical.exit_code == 3, f"严重风险退出码 = 3 (实际: {result_critical.exit_code})")
            self._assert(result_high.exit_code == 2, f"高风险退出码 = 2 (实际: {result_high.exit_code})")
            self._assert(result_safe.exit_code in [0, 1], f"低风险退出码 = 0 或 1 (实际: {result_safe.exit_code})")

    def _test_edge_cases(self):
        print("\n[边界场景测试]")
        
        parser = SQLParser()
        analyzer = LockRiskAnalyzer()

        edge_cases = [
            "",
            "-- This is a comment\n",
            "SELECT * FROM users;",
            "CREATE TABLE test (id INT);",
            "INSERT INTO users VALUES (1, 'test');",
            "ALTER TABLE `users` ADD COLUMN `test_col` INT NULL;",
            "alter table users add column test int;",
        ]

        for idx, sql in enumerate(edge_cases):
            result = parser.parse_content(sql)
            self._assert(
                isinstance(result.statements, list),
                f"边界场景 #{idx + 1} 解析不崩溃"
            )

        self._assert(len(parser.parse_content("SELECT 1").statements) == 0, "非 ALTER 语句被过滤")

    def _test_table_stats_integration(self):
        print("\n[表规模信息集成测试]")
        
        analyzer = LockRiskAnalyzer()

        yaml_content = """
tables:
  users:
    row_count: 1000000
    size_mb: 500
    has_primary_key: true
    engine: InnoDB
  orders:
    row_count: 5000000
    size_mb: 2500
    has_primary_key: true
    engine: InnoDB
"""

        csv_content = """table_name,row_count,size_mb,has_primary_key,engine
products,100000,100,true,InnoDB
"""
        
        with tempfile.TemporaryDirectory() as tmpdir:
            yaml_file = os.path.join(tmpdir, "table_stats.yaml")
            csv_file = os.path.join(tmpdir, "table_stats.csv")
            
            with open(yaml_file, 'w') as f:
                f.write(yaml_content)
            with open(csv_file, 'w') as f:
                f.write(csv_content)
            
            analyzer.load_table_stats(yaml_file)
            self._assert("users" in analyzer.table_stats, "YAML 表规模加载 - users 存在")
            self._assert(analyzer.table_stats["users"].row_count == 1000000, "YAML 行数正确")
            
            analyzer2 = LockRiskAnalyzer()
            analyzer2.load_table_stats(csv_file)
            self._assert("products" in analyzer2.table_stats, "CSV 表规模加载 - products 存在")
            self._assert(analyzer2.table_stats["products"].size_mb == 100.0, "CSV 大小正确")

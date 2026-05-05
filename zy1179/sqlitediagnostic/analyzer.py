"""分析模块 - 分析 SQLite 数据库问题"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from .models import (
    ImportedData,
    AnalysisResult,
    DatabaseInfo,
    TraceEvent,
    Migration,
    WorkloadTransaction,
    WorkloadOperation
)


class Analyzer:
    def __init__(self, data: ImportedData):
        self.data = data
    
    def get_basic_info(self) -> Dict[str, Any]:
        info = {
            "database": {},
            "pragma": {},
            "statistics": {}
        }
        
        if self.data.database_info:
            db = self.data.database_info
            info["database"] = {
                "path": db.path,
                "size_bytes": db.size,
                "size_mb": round(db.size / (1024 * 1024), 2),
                "wal_size_bytes": db.wal_size,
                "wal_size_mb": round(db.wal_size / (1024 * 1024), 2),
                "page_size": db.page_size,
                "page_count": db.page_count,
            }
            info["pragma"] = {
                "journal_mode": db.journal_mode,
                "synchronous": db.synchronous,
                "busy_timeout_ms": db.busy_timeout,
                "foreign_keys_enabled": db.foreign_keys,
                "wal_autocheckpoint": db.wal_autocheckpoint,
                "cache_size": db.cache_size,
                "temp_store": db.temp_store,
                "locking_mode": db.locking_mode,
            }
        
        info["statistics"] = {
            "trace_events_count": len(self.data.trace_events),
            "migrations_count": len(self.data.migrations),
            "workload_transactions_count": len(self.data.workload_transactions),
            "workload_operations_count": len(self.data.workload_operations),
        }
        
        return info
    
    def run_all_analyses(self) -> Dict[str, Any]:
        results = {
            "basic_info": self.get_basic_info(),
            "analyses": []
        }
        
        analyses_methods = [
            self.analyze_long_read_transactions,
            self.analyze_write_lock_contention,
            self.analyze_checkpoint_issues,
            self.analyze_busy_timeout,
            self.analyze_foreign_keys,
            self.analyze_migration_risks,
            self.analyze_wal_growth,
        ]
        
        for method in analyses_methods:
            result = method()
            if result:
                results["analyses"].append(result)
        
        return results
    
    def analyze_long_read_transactions(self) -> Optional[AnalysisResult]:
        long_transactions = []
        threshold_ms = 5000
        
        for txn in self.data.workload_transactions:
            if txn.is_read_only and txn.duration_ms > threshold_ms:
                long_transactions.append({
                    "transaction_id": txn.transaction_id,
                    "connection_id": txn.connection_id,
                    "start_time": txn.start_time.isoformat() if txn.start_time else None,
                    "duration_ms": round(txn.duration_ms, 2),
                    "operations_count": len(txn.operations),
                })
        
        long_trace_reads = []
        for event in self.data.trace_events:
            if event.event_type == "SELECT" and event.duration_ms > threshold_ms:
                long_trace_reads.append({
                    "timestamp": event.timestamp.isoformat(),
                    "connection_id": event.connection_id,
                    "statement": event.statement[:200] + "..." if len(event.statement) > 200 else event.statement,
                    "duration_ms": round(event.duration_ms, 2),
                })
        
        if not long_transactions and not long_trace_reads:
            return None
        
        severity = "high" if len(long_transactions) + len(long_trace_reads) > 5 else "medium"
        
        return AnalysisResult(
            category="transaction",
            severity=severity,
            title="长读事务检测",
            description=f"检测到 {len(long_transactions)} 个长读事务和 {len(long_trace_reads)} 个慢查询。"
                        f"长读事务会阻止 WAL checkpoint，导致 WAL 文件持续增长。",
            recommendation="建议：\n"
                          "1. 将长查询改为快照查询（使用 BEGIN IMMEDIATE 或调整隔离级别）\n"
                          "2. 优化慢查询，添加索引\n"
                          "3. 考虑将分析型查询移到只读副本\n"
                          "4. 设置合理的 statement timeout",
            evidence=long_transactions[:10] + long_trace_reads[:10],
            stats={
                "long_transactions_count": len(long_transactions),
                "long_trace_reads_count": len(long_trace_reads),
                "threshold_ms": threshold_ms,
            }
        )
    
    def analyze_write_lock_contention(self) -> Optional[AnalysisResult]:
        lock_conflicts = []
        
        for event in self.data.trace_events:
            if event.event_type in ["LOCK_ERROR", "BUSY"] or not event.success:
                if 'database is locked' in (event.error_message or event.statement).lower():
                    lock_conflicts.append({
                        "timestamp": event.timestamp.isoformat(),
                        "connection_id": event.connection_id,
                        "event_type": event.event_type,
                        "lock_type": event.lock_type,
                        "lock_wait_ms": event.lock_wait_ms,
                        "statement": event.statement[:200] + "..." if len(event.statement) > 200 else event.statement,
                        "error_message": event.error_message,
                    })
        
        concurrent_writes = []
        if self.data.workload_operations:
            write_ops = [op for op in self.data.workload_operations 
                        if op.operation_type in ["INSERT", "UPDATE", "DELETE"]]
            
            write_ops.sort(key=lambda x: x.timestamp)
            
            for i, op in enumerate(write_ops):
                for j in range(i + 1, min(i + 10, len(write_ops))):
                    other = write_ops[j]
                    time_diff = (other.timestamp - op.timestamp).total_seconds() * 1000
                    
                    if time_diff < 100 and op.connection_id != other.connection_id:
                        concurrent_writes.append({
                            "time_diff_ms": round(time_diff, 2),
                            "op1": {
                                "timestamp": op.timestamp.isoformat(),
                                "connection_id": op.connection_id,
                                "operation_type": op.operation_type,
                                "table_name": op.table_name,
                            },
                            "op2": {
                                "timestamp": other.timestamp.isoformat(),
                                "connection_id": other.connection_id,
                                "operation_type": other.operation_type,
                                "table_name": other.table_name,
                            }
                        })
                        if len(concurrent_writes) > 20:
                            break
                if len(concurrent_writes) > 20:
                    break
        
        if not lock_conflicts and not concurrent_writes:
            return None
        
        severity = "high" if len(lock_conflicts) > 0 else "medium"
        
        return AnalysisResult(
            category="locking",
            severity=severity,
            title="写锁互斥分析",
            description=f"检测到 {len(lock_conflicts)} 个锁冲突事件和 {len(concurrent_writes)} 个潜在并发写入。"
                        f"SQLite 的写锁是库级别的，并发写入会导致锁竞争。",
            recommendation="建议：\n"
                          "1. 采用 WAL 模式（journal_mode=WAL）以支持读写并发\n"
                          "2. 使用批量写入减少事务数量\n"
                          "3. 确保事务尽可能短小\n"
                          "4. 考虑使用单一写进程架构\n"
                          "5. 增加 busy_timeout 并设置合理的重试策略",
            evidence=lock_conflicts[:10] + concurrent_writes[:5],
            stats={
                "lock_conflicts_count": len(lock_conflicts),
                "concurrent_writes_count": len(concurrent_writes),
            }
        )
    
    def analyze_checkpoint_issues(self) -> Optional[AnalysisResult]:
        issues = []
        
        if self.data.database_info:
            db = self.data.database_info
            
            if db.journal_mode == "wal":
                wal_pages = db.wal_size // db.page_size if db.page_size > 0 else 0
                
                if wal_pages > db.wal_autocheckpoint * 2:
                    issues.append({
                        "type": "wal_growth",
                        "description": f"WAL 文件过大",
                        "wal_pages": wal_pages,
                        "autocheckpoint_threshold": db.wal_autocheckpoint,
                        "ratio": round(wal_pages / db.wal_autocheckpoint, 2),
                    })
        
        checkpoint_events = [e for e in self.data.trace_events if e.event_type == "CHECKPOINT"]
        
        if checkpoint_events:
            slow_checkpoints = [e for e in checkpoint_events if e.duration_ms > 1000]
            failed_checkpoints = [e for e in checkpoint_events if not e.success]
            
            if slow_checkpoints:
                issues.append({
                    "type": "slow_checkpoint",
                    "description": "检测到慢 checkpoint 操作",
                    "count": len(slow_checkpoints),
                    "max_duration_ms": max(e.duration_ms for e in slow_checkpoints),
                })
            
            if failed_checkpoints:
                issues.append({
                    "type": "failed_checkpoint",
                    "description": "检测到失败的 checkpoint 操作",
                    "count": len(failed_checkpoints),
                    "errors": [e.error_message for e in failed_checkpoints if e.error_message][:5],
                })
        
        if self.data.workload_transactions:
            long_read_txns = [t for t in self.data.workload_transactions 
                             if t.is_read_only and t.duration_ms > 10000]
            if long_read_txns:
                issues.append({
                    "type": "long_reads_blocking_checkpoint",
                    "description": "长读事务可能阻塞 checkpoint",
                    "long_read_transactions_count": len(long_read_txns),
                })
        
        if not issues:
            return None
        
        severity = "high" if any(i.get("type") in ["failed_checkpoint", "wal_growth"] for i in issues) else "medium"
        
        return AnalysisResult(
            category="checkpoint",
            severity=severity,
            title="Checkpoint 分析",
            description=f"检测到 {len(issues)} 个 checkpoint 相关问题。"
                        f"Checkpoint 卡住会导致 WAL 文件无限增长。",
            recommendation="建议：\n"
                          "1. 避免长读事务阻塞 checkpoint\n"
                          "2. 考虑使用 WAL2 模式（如果 SQLite 版本支持）\n"
                          "3. 调整 wal_autocheckpoint 阈值\n"
                          "4. 在低峰期手动执行 checkpoint\n"
                          "5. 监控 WAL 文件大小并设置告警",
            evidence=issues,
            stats={
                "issues_count": len(issues),
                "checkpoint_events_count": len(checkpoint_events),
            }
        )
    
    def analyze_busy_timeout(self) -> Optional[AnalysisResult]:
        issues = []
        
        if self.data.database_info:
            db = self.data.database_info
            
            if db.busy_timeout < 1000:
                issues.append({
                    "type": "timeout_too_low",
                    "description": "busy_timeout 设置过低",
                    "current_value_ms": db.busy_timeout,
                    "recommended_min_ms": 5000,
                })
            elif db.busy_timeout > 60000:
                issues.append({
                    "type": "timeout_too_high",
                    "description": "busy_timeout 设置过高，可能导致应用假死",
                    "current_value_ms": db.busy_timeout,
                    "recommended_max_ms": 30000,
                })
        
        busy_events = [e for e in self.data.trace_events if e.event_type == "BUSY" or 'busy' in (e.error_message or '').lower()]
        
        if busy_events:
            issues.append({
                "type": "busy_events_detected",
                "description": "检测到 BUSY 事件",
                "count": len(busy_events),
                "sample_events": [
                    {
                        "timestamp": e.timestamp.isoformat(),
                        "connection_id": e.connection_id,
                        "statement": e.statement[:100] + "..." if len(e.statement) > 100 else e.statement,
                    }
                    for e in busy_events[:5]
                ]
            })
        
        if not issues:
            return None
        
        severity = "medium"
        
        return AnalysisResult(
            category="configuration",
            severity=severity,
            title="Busy Timeout 分析",
            description=f"检测到 {len(issues)} 个 busy_timeout 相关问题。"
                        f"不合理的 busy_timeout 会增加锁冲突或导致应用无响应。",
            recommendation="建议：\n"
                          "1. 设置 busy_timeout 在 5000-30000ms 之间\n"
                          "2. 实现指数退避重试机制\n"
                          "3. 配合 WAL 模式使用以减少锁冲突\n"
                          "4. 监控 BUSY 事件频率",
            evidence=issues,
            stats={
                "issues_count": len(issues),
                "busy_events_count": len(busy_events),
                "current_busy_timeout_ms": self.data.database_info.busy_timeout if self.data.database_info else None,
            }
        )
    
    def analyze_foreign_keys(self) -> Optional[AnalysisResult]:
        issues = []
        
        if self.data.database_info:
            if not self.data.database_info.foreign_keys:
                issues.append({
                    "type": "foreign_keys_disabled",
                    "description": "外键约束未启用",
                    "current_value": "OFF",
                    "recommendation": "PRAGMA foreign_keys = ON",
                })
        
        if self.data.pragma_config:
            if 'foreign_keys' in self.data.pragma_config:
                fk_value = self.data.pragma_config['foreign_keys']
                if fk_value in (0, '0', 'off', 'OFF'):
                    issues.append({
                        "type": "foreign_keys_config_disabled",
                        "description": "配置文件中外键约束被禁用",
                        "config_value": fk_value,
                    })
        
        if not issues:
            return None
        
        return AnalysisResult(
            category="configuration",
            severity="medium",
            title="外键约束分析",
            description="外键约束未启用。这可能导致数据一致性问题，但在迁移过程中可能有用。",
            recommendation="建议：\n"
                          "1. 正常运行时启用外键约束：PRAGMA foreign_keys = ON\n"
                          "2. 迁移时可临时禁用以提高性能\n"
                          "3. 注意：某些 SQLite 驱动默认不启用外键",
            evidence=issues,
            stats={
                "foreign_keys_enabled": self.data.database_info.foreign_keys if self.data.database_info else None,
            }
        )
    
    def analyze_migration_risks(self) -> Optional[AnalysisResult]:
        risky_migrations = []
        
        for migration in self.data.migrations:
            risks = []
            
            if migration.has_rebuild_operations:
                risks.append({
                    "type": "table_rebuild",
                    "description": "检测到表重建操作",
                    "details": "CREATE TABLE ... AS SELECT 或类似模式可能需要重建整个表",
                })
            
            if migration.has_alter_table:
                risks.append({
                    "type": "alter_table",
                    "description": "检测到 ALTER TABLE 操作",
                    "details": "某些 ALTER TABLE 操作（如修改列类型）在 SQLite 中需要表重建",
                })
            
            if migration.has_drop_table:
                risks.append({
                    "type": "drop_table",
                    "description": "检测到 DROP TABLE 操作",
                    "details": "删除表是高风险操作，请确保有备份",
                })
            
            if risks:
                risky_migrations.append({
                    "version": migration.version,
                    "name": migration.name,
                    "file_path": migration.file_path,
                    "tables_affected": migration.tables_affected,
                    "risks": risks,
                    "sql_preview": migration.sql_content[:500] + "..." if len(migration.sql_content) > 500 else migration.sql_content,
                })
        
        if not risky_migrations:
            return None
        
        severity = "high" if any(
            any(r.get("type") in ["table_rebuild", "drop_table"] for r in m["risks"])
            for m in risky_migrations
        ) else "medium"
        
        return AnalysisResult(
            category="migration",
            severity=severity,
            title="迁移风险分析",
            description=f"检测到 {len(risky_migrations)} 个有风险的迁移操作。"
                        f"表重建在 SQLite 中是昂贵操作，会长时间锁库。",
            recommendation="建议：\n"
                          "1. 大表迁移考虑使用 sqlite3_sessions 或在线迁移工具\n"
                          "2. 迁移前确保有完整备份\n"
                          "3. 在低峰期执行迁移\n"
                          "4. 考虑设置更长的 busy_timeout\n"
                          "5. 对于大表，考虑分批迁移而非一次性操作",
            evidence=risky_migrations,
            stats={
                "risky_migrations_count": len(risky_migrations),
                "total_migrations_count": len(self.data.migrations),
            }
        )
    
    def analyze_wal_growth(self) -> Optional[AnalysisResult]:
        issues = []
        
        if self.data.database_info:
            db = self.data.database_info
            
            if db.journal_mode == "wal" and db.wal_size > 0:
                wal_size_mb = db.wal_size / (1024 * 1024)
                
                if wal_size_mb > 100:
                    issues.append({
                        "type": "wal_large",
                        "description": "WAL 文件过大",
                        "size_mb": round(wal_size_mb, 2),
                        "threshold_mb": 100,
                    })
                
                db_size_mb = db.size / (1024 * 1024)
                if db_size_mb > 0 and wal_size_mb > db_size_mb:
                    issues.append({
                        "type": "wal_larger_than_db",
                        "description": "WAL 文件大于主数据库文件",
                        "wal_size_mb": round(wal_size_mb, 2),
                        "db_size_mb": round(db_size_mb, 2),
                        "ratio": round(wal_size_mb / db_size_mb, 2),
                    })
                
                if db.wal_autocheckpoint < 100:
                    issues.append({
                        "type": "autocheckpoint_too_low",
                        "description": "wal_autocheckpoint 设置过低",
                        "current_value": db.wal_autocheckpoint,
                        "recommended_min": 100,
                    })
        
        if self.data.workload_transactions:
            long_reads = [t for t in self.data.workload_transactions 
                         if t.is_read_only and t.duration_ms > 30000]
            if long_reads:
                issues.append({
                    "type": "long_reads_blocking_wal",
                    "description": "长读事务可能阻止 WAL checkpoint",
                    "count": len(long_reads),
                    "max_duration_ms": max(t.duration_ms for t in long_reads),
                })
        
        if not issues:
            return None
        
        severity = "high" if any(i.get("type") in ["wal_larger_than_db"] for i in issues) else "medium"
        
        return AnalysisResult(
            category="wal",
            severity=severity,
            title="WAL 增长分析",
            description=f"检测到 {len(issues)} 个 WAL 相关问题。"
                        f"WAL 无限增长通常是 checkpoint 被阻塞或配置不当导致的。",
            recommendation="建议：\n"
                          "1. 检查并优化长读事务\n"
                          "2. 确保 checkpoint 正常运行\n"
                          "3. 考虑使用 PRAGMA wal_autocheckpoint=N 调整阈值\n"
                          "4. 在低峰期手动执行 PRAGMA wal_checkpoint(TRUNCATE)\n"
                          "5. 监控 WAL 文件大小并设置告警",
            evidence=issues,
            stats={
                "issues_count": len(issues),
                "wal_size_mb": round(self.data.database_info.wal_size / (1024 * 1024), 2) if self.data.database_info else None,
            }
        )

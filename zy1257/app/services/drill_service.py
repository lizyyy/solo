import random
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models import (
    Node, Slot, Request, DrillTask, DrillResult, Diagnosis,
    FailureEvent
)
from app.schemas import DrillTaskCreate, TaskStatus, ResultStatus, Severity
from app.config import settings


class DrillSimulator:
    def __init__(self, db: Session, task: DrillTask):
        self.db = db
        self.task = task
        self.rng = random.Random(task.seed)
        self.results: List[DrillResult] = []
        self.diagnoses: List[Diagnosis] = []

    def run(self) -> bool:
        try:
            self.task.status = TaskStatus.running
            self.task.started_at = datetime.utcnow()
            self.db.commit()

            if self.task.enable_sentinel_failover:
                self._simulate_failover_scenario()

            requests = self.db.query(Request).order_by(Request.timestamp).all()
            for req in requests:
                self._process_request(req)

            self._generate_diagnoses()

            self.task.status = TaskStatus.completed
            self.task.completed_at = datetime.utcnow()
            self.db.commit()
            return True

        except Exception as e:
            self.task.status = TaskStatus.failed
            self.db.commit()
            raise

    def _process_request(self, req: Request):
        redirect_count = 0
        retry_count = 0
        current_node: Optional[Node] = None
        final_status = ResultStatus.success
        error_type = None
        error_message = None
        latency_ms = 0.0
        redirect_type = None

        target_slot = req.key_slot
        if target_slot is None and req.key:
            from app.utils.redis_slot import key_slot
            target_slot = key_slot(req.key)

        if self.task.enable_lua_transaction_failure and (req.is_lua or req.is_transaction):
            slots = self._get_slots_for_request(req)
            migrating_slots = [s for s in slots if s and (s.is_migrating or s.is_importing)]
            
            if migrating_slots:
                final_status = ResultStatus.failed
                error_type = "CROSSSLOT" if len(migrating_slots) > 1 else "TRYAGAIN"
                error_message = f"Command failed during slot migration: {error_type}"
                
                result = DrillResult(
                    task_id=self.task.id,
                    result_type="request",
                    request_id=req.request_id,
                    slot_number=target_slot,
                    status=final_status,
                    redirect_count=redirect_count,
                    retry_count=retry_count,
                    latency_ms=latency_ms,
                    error_type=error_type,
                    error_message=error_message,
                    details={"command": req.command, "is_lua": req.is_lua, "is_transaction": req.is_transaction}
                )
                self.db.add(result)
                self.results.append(result)
                self.db.commit()
                return

        if self.task.enable_read_write_routing and req.is_read and not req.is_write:
            current_node = self._get_slave_for_read(target_slot)
        else:
            current_node = self._get_master_for_slot(target_slot)

        while True:
            slot_info = self._get_slot_info(target_slot)
            needs_redirect = False

            if slot_info and slot_info.is_migrating and self.task.enable_moved_redirect:
                if self._should_redirect_on_migrate(req, slot_info):
                    redirect_type = "MOVED"
                    needs_redirect = True
                    target_node_id = slot_info.importing_node_id
                    current_node = self._get_node_by_id(target_node_id)

            elif slot_info and slot_info.is_importing and self.task.enable_ask_redirect:
                if self._should_ask_redirect(req, slot_info):
                    redirect_type = "ASK"
                    needs_redirect = True
                    target_node_id = slot_info.importing_node_id
                    current_node = self._get_node_by_id(target_node_id)

            if needs_redirect:
                redirect_count += 1
                latency_ms += self.rng.uniform(5, 20)

                if redirect_count > 10:
                    final_status = ResultStatus.failed
                    error_type = "REDIRECT_LOOP"
                    error_message = "Too many redirects"
                    break

                if self.task.enable_client_retry and redirect_count <= self.task.max_retries:
                    retry_count += 1
                    latency_ms += self.rng.uniform(1, 5)
                else:
                    final_status = ResultStatus.redirected
                    break
            else:
                break

        if self.task.enable_replication_lag and req.is_read and current_node and current_node.role == "slave":
            lag_probability = min(0.8, self.task.replication_lag_ms / 1000.0)
            if self.rng.random() < lag_probability:
                latency_ms += self.task.replication_lag_ms * self.rng.uniform(0.5, 1.5)

        latency_ms += self.rng.uniform(1, 10)

        result = DrillResult(
            task_id=self.task.id,
            result_type="request",
            request_id=req.request_id,
            slot_number=target_slot,
            node_id=current_node.node_id if current_node else None,
            status=final_status,
            redirect_type=redirect_type,
            redirect_count=redirect_count,
            retry_count=retry_count,
            latency_ms=latency_ms,
            error_type=error_type,
            error_message=error_message,
            details={
                "command": req.command,
                "is_read": req.is_read,
                "is_write": req.is_write,
                "targeted_node": current_node.node_id if current_node else None
            }
        )
        self.db.add(result)
        self.results.append(result)
        self.db.commit()

    def _get_slot_info(self, slot_number: int) -> Optional[Slot]:
        if slot_number is None:
            return None
        return self.db.query(Slot).filter(Slot.slot_number == slot_number).first()

    def _get_master_for_slot(self, slot_number: int) -> Optional[Node]:
        if slot_number is None:
            masters = self.db.query(Node).filter(Node.role == "master", Node.is_alive == True).all()
            return masters[0] if masters else None
        
        slot = self._get_slot_info(slot_number)
        if slot and slot.owner_node_id:
            return self._get_node_by_id(slot.owner_node_id)
        
        masters = self.db.query(Node).filter(Node.role == "master", Node.is_alive == True).all()
        return masters[0] if masters else None

    def _get_slave_for_read(self, slot_number: int) -> Optional[Node]:
        master = self._get_master_for_slot(slot_number)
        if not master:
            return None
        
        slaves = self.db.query(Node).filter(
            Node.master_id == master.node_id,
            Node.is_alive == True
        ).all()
        
        if slaves:
            return self.rng.choice(slaves)
        return master

    def _get_node_by_id(self, node_id: str) -> Optional[Node]:
        if not node_id:
            return None
        return self.db.query(Node).filter(Node.node_id == node_id).first()

    def _get_slots_for_request(self, req: Request) -> List[Optional[Slot]]:
        slots = []
        if req.key_slot is not None:
            slots.append(self._get_slot_info(req.key_slot))
        elif req.original_data and "keys" in req.original_data:
            from app.utils.redis_slot import key_slot
            for key in req.original_data["keys"]:
                s = key_slot(key)
                slots.append(self._get_slot_info(s))
        return slots

    def _should_redirect_on_migrate(self, req: Request, slot: Slot) -> bool:
        if not req.is_write:
            return False
        return self.rng.random() < 0.3

    def _should_ask_redirect(self, req: Request, slot: Slot) -> bool:
        if req.is_write:
            return self.rng.random() < 0.1
        return self.rng.random() < 0.05

    def _simulate_failover_scenario(self):
        masters = self.db.query(Node).filter(Node.role == "master", Node.is_alive == True).all()
        if not masters:
            return

        target_master = self.rng.choice(masters)
        
        failover_event = FailureEvent(
            event_type="master_fail",
            node_id=target_master.node_id,
            details={
                "reason": "simulated_failover",
                "previous_role": "master"
            },
            timestamp=datetime.utcnow()
        )
        self.db.add(failover_event)

        slaves = self.db.query(Node).filter(
            Node.master_id == target_master.node_id,
            Node.is_alive == True
        ).all()

        if slaves:
            new_master = self.rng.choice(slaves)
            new_master.role = "master"
            new_master.master_id = None

            for slave in slaves:
                if slave.node_id != new_master.node_id:
                    slave.master_id = new_master.node_id

            slot_events = self.db.query(Slot).filter(
                Slot.owner_node_id == target_master.node_id
            ).all()
            for slot in slot_events:
                slot.owner_node_id = new_master.node_id

            target_master.is_alive = False
            target_master.state = "fail"

            failover_event.is_resolved = True
            failover_event.resolved_at = datetime.utcnow()
            failover_event.details["new_master"] = new_master.node_id
            failover_event.event_type = "failover_complete"

            self.db.commit()

            result = DrillResult(
                task_id=self.task.id,
                result_type="failover",
                node_id=target_master.node_id,
                status=ResultStatus.success,
                details={
                    "old_master": target_master.node_id,
                    "new_master": new_master.node_id,
                    "slaves_promoted": [s.node_id for s in slaves]
                }
            )
            self.db.add(result)
            self.results.append(result)
            self.db.commit()

    def _generate_diagnoses(self):
        self._check_redirect_issues()
        self._check_replication_lag()
        self._check_lua_transaction_failures()
        self._check_failover_impact()
        self._check_availability()

    def _check_redirect_issues(self):
        redirected_results = [r for r in self.results if r.redirect_count > 0]
        high_redirect = [r for r in redirected_results if r.redirect_count >= 3]
        moved_redirects = [r for r in redirected_results if r.redirect_type == "MOVED"]
        ask_redirects = [r for r in redirected_results if r.redirect_type == "ASK"]

        if high_redirect:
            diag = Diagnosis(
                task_id=self.task.id,
                diagnosis_type="redirect_issue",
                severity=Severity.medium,
                title="高重定向次数检测",
                description=f"发现 {len(high_redirect)} 个请求经历了 3 次或更多次重定向。这可能表明槽位迁移期间客户端处理逻辑有问题。",
                recommendation="检查客户端是否正确处理 MOVED/ASK 重定向，考虑使用支持集群模式的客户端库。",
                affected_requests=[r.request_id for r in high_redirect[:50]],
                details={
                    "total_redirected": len(redirected_results),
                    "high_redirect_count": len(high_redirect),
                    "moved_count": len(moved_redirects),
                    "ask_count": len(ask_redirects)
                }
            )
            self.db.add(diag)
            self.diagnoses.append(diag)

    def _check_replication_lag(self):
        if not self.task.enable_replication_lag or self.task.replication_lag_ms <= 0:
            return

        high_latency = [r for r in self.results if r.latency_ms > self.task.replication_lag_ms]
        
        if high_latency:
            diag = Diagnosis(
                task_id=self.task.id,
                diagnosis_type="replication_lag",
                severity=Severity.medium,
                title="复制延迟影响检测",
                description=f"检测到 {len(high_latency)} 个请求受到复制延迟影响。配置的延迟为 {self.task.replication_lag_ms}ms。",
                recommendation="对于需要强一致性的读操作，考虑从 master 读取而非 slave。或者监控复制延迟并在延迟过高时切换路由策略。",
                affected_requests=[r.request_id for r in high_latency[:50]],
                details={
                    "configured_lag_ms": self.task.replication_lag_ms,
                    "affected_count": len(high_latency),
                    "avg_latency_ms": sum(r.latency_ms for r in high_latency) / len(high_latency) if high_latency else 0
                }
            )
            self.db.add(diag)
            self.diagnoses.append(diag)

    def _check_lua_transaction_failures(self):
        lua_failures = [r for r in self.results if r.error_type in ["CROSSSLOT", "TRYAGAIN"]]
        
        if lua_failures:
            diag = Diagnosis(
                task_id=self.task.id,
                diagnosis_type="lua_transaction_failure",
                severity=Severity.critical,
                title="Lua/事务操作在迁移期间失败",
                description=f"检测到 {len(lua_failures)} 个 Lua 脚本或事务操作在槽位迁移期间失败。这是高风险问题，因为这些操作无法像简单命令那样重试。",
                recommendation="1. 避免在槽位迁移期间执行跨槽 Lua 脚本或事务；2. 使用 hash tags 确保相关键在同一槽位；3. 实现针对这些操作的特定回退机制。",
                affected_requests=[r.request_id for r in lua_failures[:50]],
                details={
                    "failure_count": len(lua_failures),
                    "error_types": list(set(r.error_type for r in lua_failures))
                }
            )
            self.db.add(diag)
            self.diagnoses.append(diag)

    def _check_failover_impact(self):
        failover_results = [r for r in self.results if r.result_type == "failover"]
        
        if failover_results:
            diag = Diagnosis(
                task_id=self.task.id,
                diagnosis_type="failover",
                severity=Severity.high,
                title="主从故障转移执行",
                description=f"演练中执行了 {len(failover_results)} 次主从故障转移。Sentinel 选举了新的 master。",
                recommendation="评估故障转移期间的请求影响：1. 检查是否有请求超时或失败；2. 确认新 master 及时接管；3. 验证 slave 重配置是否正确。",
                affected_nodes=[r.node_id for r in failover_results if r.node_id],
                details={
                    "failover_count": len(failover_results),
                    "details": [r.details for r in failover_results]
                }
            )
            self.db.add(diag)
            self.diagnoses.append(diag)

    def _check_availability(self):
        total_requests = len([r for r in self.results if r.result_type == "request"])
        failed_requests = len([r for r in self.results if r.status == ResultStatus.failed])
        success_count = len([r for r in self.results if r.status == ResultStatus.success])
        redirected_count = len([r for r in self.results if r.status == ResultStatus.redirected])

        if total_requests == 0:
            return

        availability = success_count / total_requests if total_requests > 0 else 1.0
        
        diag = Diagnosis(
            task_id=self.task.id,
            diagnosis_type="availability",
            severity=Severity.info if availability >= 0.99 else (Severity.low if availability >= 0.95 else Severity.medium),
            title="演练可用性统计",
            description=f"总请求数: {total_requests}, 成功: {success_count}, 重定向: {redirected_count}, 失败: {failed_requests}。成功率: {availability*100:.2f}%",
            recommendation="如果成功率低于预期，请检查：1. 重定向处理逻辑；2. 故障转移期间的可用性；3. 复制延迟配置是否合理。",
            details={
                "total_requests": total_requests,
                "success_count": success_count,
                "redirected_count": redirected_count,
                "failed_count": failed_requests,
                "availability_rate": availability
            }
        )
        self.db.add(diag)
        self.diagnoses.append(diag)
        self.db.commit()

import random
import uuid
from datetime import datetime
from typing import List, Tuple, Optional, Dict
from .models import Call, Agent, QCTask, QCInspector, CallStatus
from .storage import Storage


class SamplingEngine:
    def __init__(self, storage: Storage):
        self.storage = storage

    def calculate_call_weight(self, call: Call, agent: Optional[Agent]) -> Tuple[float, str]:
        weight = 1.0
        reasons = []

        if call.is_complaint:
            weight *= 5.0
            reasons.append("投诉通话")

        if agent:
            if agent.risk_score >= 70:
                weight *= 3.0
                reasons.append(f"高风险坐席(风险分:{agent.risk_score:.1f})")
            elif agent.risk_score >= 50:
                weight *= 1.5
                reasons.append(f"中风险坐席(风险分:{agent.risk_score:.1f})")

            if agent.historical_avg_score < 60:
                weight *= 2.5
                reasons.append(f"历史低分坐席(均分:{agent.historical_avg_score:.1f})")
            elif agent.historical_avg_score < 75:
                weight *= 1.3
                reasons.append(f"历史中等坐席(均分:{agent.historical_avg_score:.1f})")

        if call.business_type in ("售后", "投诉处理", "理赔"):
            weight *= 1.5
            reasons.append(f"高风险业务类型:{call.business_type}")

        if not reasons:
            reasons.append("常规随机抽样")

        return weight, " + ".join(reasons)

    def select_inspector(self, inspectors: List[QCInspector]) -> Optional[QCInspector]:
        if not inspectors:
            return None

        min_count = min(i.current_task_count for i in inspectors)
        candidates = [i for i in inspectors if i.current_task_count == min_count]
        return random.choice(candidates)

    def generate_sample(
        self,
        count: int,
        min_risk_bonus: bool = True
    ) -> List[Dict]:
        pending_calls = self.storage.get_pending_calls()
        if not pending_calls:
            return []

        agents = {a.agent_id: a for a in self.storage.get_all_agents()}
        inspectors = self.storage.get_all_inspectors(active_only=True)

        if not inspectors:
            raise RuntimeError("没有可用的质检员，请先导入质检员信息")

        weighted_calls = []
        for call in pending_calls:
            agent = agents.get(call.agent_id)
            weight, reason = self.calculate_call_weight(call, agent)
            weighted_calls.append({
                "call": call,
                "agent": agent,
                "weight": weight,
                "reason": reason
            })

        total_weight = sum(w["weight"] for w in weighted_calls)

        results = []
        sampled_call_ids = set()

        while len(results) < count and weighted_calls:
            r = random.uniform(0, total_weight)
            cumulative = 0
            selected = None

            for idx, item in enumerate(weighted_calls):
                cumulative += item["weight"]
                if cumulative >= r:
                    selected = item
                    break

            if not selected:
                selected = weighted_calls[0]

            call = selected["call"]
            if call.call_id in sampled_call_ids:
                weighted_calls.remove(selected)
                total_weight -= selected["weight"]
                continue

            sampled_call_ids.add(call.call_id)

            inspector = self.select_inspector(inspectors)
            if not inspector:
                break

            task_id = f"QC-{uuid.uuid4().hex[:8].upper()}"
            now = datetime.now().isoformat()

            task = QCTask(
                task_id=task_id,
                call_id=call.call_id,
                agent_id=call.agent_id,
                business_type=call.business_type,
                is_complaint=call.is_complaint,
                qc_assigned_to=inspector.inspector_id,
                sampling_reason=selected["reason"],
                created_at=now
            )

            call.status = CallStatus.SAMPLED
            call.sampled_at = now
            call.qc_assigned_to = inspector.inspector_id
            call.sampling_reason = selected["reason"]

            self.storage.create_task(task)
            self.storage.upsert_call(call)

            inspector.current_task_count += 1
            self.storage.upsert_inspector(inspector)

            results.append({
                "task_id": task_id,
                "call_id": call.call_id,
                "agent_id": call.agent_id,
                "agent_name": selected["agent"].name if selected["agent"] else "未知",
                "business_type": call.business_type,
                "is_complaint": call.is_complaint,
                "inspector_id": inspector.inspector_id,
                "inspector_name": inspector.name,
                "sampling_reason": selected["reason"],
                "weight": selected["weight"]
            })

            weighted_calls.remove(selected)
            total_weight -= selected["weight"]

        return results

    def get_sampling_details(self, task_id: str) -> Optional[Dict]:
        task = self.storage.get_task(task_id)
        if not task:
            return None

        call = self.storage.get_call(task.call_id)
        agent = self.storage.get_agent(task.agent_id)
        inspector = self.storage.get_inspector(task.qc_assigned_to)

        return {
            "task": task,
            "call": call,
            "agent": agent,
            "inspector": inspector,
            "sampling_reason": task.sampling_reason
        }

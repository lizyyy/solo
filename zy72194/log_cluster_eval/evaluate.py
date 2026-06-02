import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import EvalStatus, Evidence, Evaluation, Sample
from .store import Store


class EvaluationEngine:
    def __init__(self, store: Store, model_version: str = "v1"):
        self.store = store
        self.model_version = model_version

    def evaluate_sample(self, sample: Sample) -> Evaluation:
        ev = self._analyze_log(sample.raw_log)
        ev.sample_id = sample.sample_id
        ev.model_version = self.model_version
        ev.source = "model"
        self.store.save_evaluation(ev)
        return ev

    def evaluate_batch(self, samples: List[Sample]) -> List[Evaluation]:
        results: List[Evaluation] = []
        for s in samples:
            existing = self.store.get_latest_evaluation(s.sample_id)
            if existing and existing.source == "model":
                results.append(existing)
                continue
            ev = self.evaluate_sample(s)
            results.append(ev)
        return results

    def _analyze_log(self, raw_log: str) -> Evaluation:
        evidence: List[Evidence] = []
        cluster_label = "unknown"
        root_cause = "unclassified"
        confidence = 0.3

        oom_match = re.search(r"OutOfMemory|OOM|heap\s+space|memory\s+alloc", raw_log, re.I)
        timeout_match = re.search(r"timeout|timed?\s*out|deadline\s*exceeded", raw_log, re.I)
        conn_match = re.search(r"connection\s*(refused|reset|timeout|failed)|ECONNREFUSED|ECONNRESET", raw_log, re.I)
        disk_match = re.search(r"disk\s*(full|error|fail)|No\s+space\s+left|ENOSPC", raw_log, re.I)
        perm_match = re.search(r"permission\s*denied|EACCES|EPERM|Unauthorized|403|Forbidden", raw_log, re.I)
        null_match = re.search(r"NullPointerException|NPE|NoneType|AttributeError|KeyError|TypeError", raw_log, re.I)
        deadlock_match = re.search(r"deadlock|DeadlockDetected|lock\s+wait\s+timeout", raw_log, re.I)
        rate_match = re.search(r"rate\s*limit|too\s*many\s*requests|429|throttl", raw_log, re.I)

        if oom_match:
            cluster_label = "memory"
            root_cause = "内存溢出：进程占用内存超出可用堆空间"
            confidence = 0.92
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{oom_match.start()}-{oom_match.end()}",
                content=oom_match.group(),
                confidence=0.95,
            ))

        if timeout_match:
            cluster_label = "timeout"
            root_cause = "超时：操作未在预期时间内完成"
            confidence = 0.88
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{timeout_match.start()}-{timeout_match.end()}",
                content=timeout_match.group(),
                confidence=0.9,
            ))

        if conn_match:
            cluster_label = "network"
            root_cause = "网络连接异常：远端服务不可达或连接被拒绝"
            confidence = 0.85
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{conn_match.start()}-{conn_match.end()}",
                content=conn_match.group(),
                confidence=0.88,
            ))

        if disk_match:
            cluster_label = "disk"
            root_cause = "磁盘空间不足或IO错误"
            confidence = 0.9
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{disk_match.start()}-{disk_match.end()}",
                content=disk_match.group(),
                confidence=0.92,
            ))

        if perm_match:
            cluster_label = "permission"
            root_cause = "权限不足：访问被拒绝"
            confidence = 0.87
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{perm_match.start()}-{perm_match.end()}",
                content=perm_match.group(),
                confidence=0.9,
            ))

        if null_match:
            cluster_label = "null_pointer"
            root_cause = "空指针异常：代码引用了未初始化的对象"
            confidence = 0.82
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{null_match.start()}-{null_match.end()}",
                content=null_match.group(),
                confidence=0.85,
            ))

        if deadlock_match:
            cluster_label = "deadlock"
            root_cause = "死锁：并发资源竞争导致循环等待"
            confidence = 0.84
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{deadlock_match.start()}-{deadlock_match.end()}",
                content=deadlock_match.group(),
                confidence=0.87,
            ))

        if rate_match:
            cluster_label = "rate_limit"
            root_cause = "限流：请求速率超过服务端限制"
            confidence = 0.86
            evidence.append(Evidence(
                kind="pattern_match",
                location=f"offset:{rate_match.start()}-{rate_match.end()}",
                content=rate_match.group(),
                confidence=0.88,
            ))

        if len(evidence) > 1:
            cluster_label = "multiple"
            root_cause = f"多重异常：检测到{len(evidence)}种异常模式"
            confidence = min(0.95, max(e.confidence for e in evidence) * 0.9)
            for idx, ev_item in enumerate(evidence):
                ev_item.confidence *= 0.95

        if not evidence:
            evidence.append(Evidence(
                kind="no_pattern",
                location="full_log",
                content=raw_log[:200],
                confidence=0.3,
            ))

        status = EvalStatus.AUTO
        if confidence < 0.5:
            status = EvalStatus.NEEDS_REVIEW

        return Evaluation(
            cluster_label=cluster_label,
            root_cause=root_cause,
            confidence=round(confidence, 4),
            evidence=evidence,
            status=status,
        )

    def apply_model_output(
        self,
        sample_id: str,
        cluster_label: str,
        root_cause: str,
        confidence: float,
        evidence: Optional[List[Dict[str, Any]]] = None,
    ) -> Evaluation:
        sample = self.store.get_sample(sample_id)
        if sample is None:
            raise ValueError(f"样本 {sample_id} 不存在，请先导入")

        ev_evidence: List[Evidence] = []
        if evidence:
            ev_evidence = [Evidence.from_dict(e) for e in evidence]

        status = EvalStatus.AUTO
        if confidence < 0.5:
            status = EvalStatus.NEEDS_REVIEW

        ev = Evaluation(
            sample_id=sample_id,
            cluster_label=cluster_label,
            root_cause=root_cause,
            confidence=confidence,
            evidence=ev_evidence,
            model_version=self.model_version,
            status=status,
            source="model",
        )
        self.store.save_evaluation(ev)
        return ev

    @staticmethod
    def load_model_outputs(path: str) -> List[Dict[str, Any]]:
        raw = Path(path).read_text(encoding="utf-8")
        return json.loads(raw)

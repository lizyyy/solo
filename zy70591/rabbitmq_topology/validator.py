from typing import Set, Dict, List, Any
from collections import defaultdict
from .models import TopologyData, ValidationResult, Binding, Exchange, Queue


class TopologyValidator:
    def __init__(self, topology: TopologyData):
        self.topology = topology
        self.result = ValidationResult()

    def validate(self) -> ValidationResult:
        self._build_name_indexes()
        self._validate_bindings()
        self._find_orphan_queues()
        self._find_orphan_exchanges()
        self._detect_duplicate_bindings()
        self._validate_policy_apply()
        return self.result

    def _build_name_indexes(self):
        self.exchange_names: Set[str] = {
            f"{ex.vhost}:{ex.name}" 
            for ex in self.topology.exchanges
        }
        self.queue_names: Set[str] = {
            f"{q.vhost}:{q.name}" 
            for q in self.topology.queues
        }
        
        self.default_exchanges = {
            f"{vhost}:" for vhost in self._get_all_vhosts()
        }

    def _get_all_vhosts(self) -> Set[str]:
        vhosts = set()
        for ex in self.topology.exchanges:
            vhosts.add(ex.vhost)
        for q in self.topology.queues:
            vhosts.add(q.vhost)
        for b in self.topology.bindings:
            vhosts.add(b.vhost)
        return vhosts

    def _validate_bindings(self):
        for binding in self.topology.bindings:
            binding_key = f"{binding.vhost}:{binding.source}"
            dest_key = f"{binding.vhost}:{binding.destination}"
            
            source_exists = (
                binding_key in self.exchange_names or 
                binding_key in self.default_exchanges
            )
            
            if not source_exists:
                self.result.invalid_bindings.append({
                    "type": "source_not_found",
                    "source": binding.source,
                    "destination": binding.destination,
                    "routing_key": binding.routing_key,
                    "vhost": binding.vhost,
                    "message": f"源Exchange不存在: {binding.source}"
                })
            
            if binding.destination_type == "queue":
                if dest_key not in self.queue_names:
                    self.result.invalid_bindings.append({
                        "type": "destination_not_found",
                        "source": binding.source,
                        "destination": binding.destination,
                        "routing_key": binding.routing_key,
                        "vhost": binding.vhost,
                        "message": f"目标Queue不存在: {binding.destination}"
                    })
            elif binding.destination_type == "exchange":
                if dest_key not in self.exchange_names:
                    self.result.invalid_bindings.append({
                        "type": "destination_not_found",
                        "source": binding.source,
                        "destination": binding.destination,
                        "routing_key": binding.routing_key,
                        "vhost": binding.vhost,
                        "message": f"目标Exchange不存在: {binding.destination}"
                    })

    def _find_orphan_queues(self):
        bound_queues: Set[str] = set()
        
        for binding in self.topology.bindings:
            if binding.destination_type == "queue":
                bound_queues.add(f"{binding.vhost}:{binding.destination}")
        
        for queue in self.topology.queues:
            queue_key = f"{queue.vhost}:{queue.name}"
            if queue_key not in bound_queues:
                self.result.orphan_queues.append(f"{queue.vhost}/{queue.name}")

    def _find_orphan_exchanges(self):
        bound_exchanges: Set[str] = set()
        
        for binding in self.topology.bindings:
            bound_exchanges.add(f"{binding.vhost}:{binding.source}")
            if binding.destination_type == "exchange":
                bound_exchanges.add(f"{binding.vhost}:{binding.destination}")
        
        for exchange in self.topology.exchanges:
            ex_key = f"{exchange.vhost}:{exchange.name}"
            if ex_key not in bound_exchanges:
                self.result.orphan_exchanges.append(f"{exchange.vhost}/{exchange.name}")

    def _detect_duplicate_bindings(self):
        binding_groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        
        for idx, binding in enumerate(self.topology.bindings):
            key = (
                f"{binding.vhost}:{binding.source}:"
                f"{binding.destination}:{binding.destination_type}:"
                f"{binding.routing_key}"
            )
            binding_groups[key].append({
                "index": idx,
                "binding": binding
            })
        
        for key, group in binding_groups.items():
            if len(group) > 1:
                first_binding = group[0]["binding"]
                self.result.duplicate_bindings.append({
                    "source": first_binding.source,
                    "destination": first_binding.destination,
                    "destination_type": first_binding.destination_type,
                    "routing_key": first_binding.routing_key,
                    "vhost": first_binding.vhost,
                    "count": len(group),
                    "indices": [g["index"] for g in group]
                })

    def _validate_policy_apply(self):
        for policy in self.topology.policies:
            matched_count = 0
            pattern = policy.pattern
            
            if policy.apply_to in ["queues", "all"]:
                for queue in self.topology.queues:
                    if queue.vhost == policy.vhost and pattern in queue.name:
                        matched_count += 1
            
            if policy.apply_to in ["exchanges", "all"]:
                for exchange in self.topology.exchanges:
                    if exchange.vhost == policy.vhost and pattern in exchange.name:
                        matched_count += 1
            
            if matched_count == 0:
                self.result.warnings.append(
                    f"Policy '{policy.name}' (vhost: {policy.vhost}, pattern: '{pattern}') "
                    f"未匹配到任何Queue或Exchange"
                )

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional
from uuid import uuid4


@dataclass
class EvidenceNode:
    node_type: str
    node_id: str
    timestamp: datetime
    description: str
    data_reference: str
    metadata: Dict = field(default_factory=dict)

    def to_dict(self):
        return {
            "node_type": self.node_type,
            "node_id": self.node_id,
            "timestamp": self.timestamp.isoformat(),
            "description": self.description,
            "data_reference": self.data_reference,
            "metadata": self.metadata,
        }


@dataclass
class EvidenceChain:
    root_record_id: str
    chain_id: str = field(default_factory=lambda: str(uuid4()))
    created_at: datetime = field(default_factory=datetime.now)
    nodes: List[EvidenceNode] = field(default_factory=list)

    def add_node(self, node: EvidenceNode):
        self.nodes.append(node)
        self.nodes.sort(key=lambda n: n.timestamp)

    def get_timeline(self) -> List[Dict]:
        return [node.to_dict() for node in self.nodes]

    def to_dict(self):
        return {
            "chain_id": self.chain_id,
            "root_record_id": self.root_record_id,
            "created_at": self.created_at.isoformat(),
            "nodes_count": len(self.nodes),
            "timeline": self.get_timeline(),
        }

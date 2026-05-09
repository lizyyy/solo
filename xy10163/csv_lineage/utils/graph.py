from typing import Dict, Any
import json

try:
    from pyvis.network import Network
    HAS_PYVIS = True
except ImportError:
    HAS_PYVIS = False

class LineageGraph:
    def __init__(self, storage):
        self.storage = storage

    def generate_graph(self, table_name: str, output_path: str) -> Dict[str, Any]:
        lineage = self.storage.get_lineage(table_name)
        if lineage is None:
            return {"error": "No lineage data found for table"}
        
        if not HAS_PYVIS:
            return self._generate_json_graph(lineage, table_name)
        
        net = Network(notebook=False, directed=True, height="800px", width="100%")
        net.force_atlas_2based(gravity=-50, central_gravity=0.01)
        
        nodes = set()
        edges = []
        
        for canonical, data in lineage["fields"].items():
            aliases = data.get("aliases", [])
            
            if canonical not in nodes:
                net.add_node(canonical, 
                            label=canonical,
                            title=f"标准字段: {canonical}\n首次出现: v{data.get('first_seen_version')}\n最后出现: v{data.get('last_seen_version')}",
                            color="#2e7d32",
                            size=25)
                nodes.add(canonical)
            
            for i, alias in enumerate(aliases):
                if alias == canonical:
                    continue
                
                if alias not in nodes:
                    is_current = (i == len(aliases) - 1)
                    color = "#1976d2" if is_current else "#78909c"
                    size = 20 if is_current else 15
                    
                    history_entry = next((h for h in data.get("history", []) if h.get("name") == alias), None)
                    title = f"别名: {alias}\n"
                    if history_entry:
                        title += f"版本: v{history_entry.get('version')}\n"
                        title += f"类型: {history_entry.get('dtype', 'unknown')}\n"
                        title += f"动作: {history_entry.get('action', 'unknown')}"
                    
                    net.add_node(alias,
                                label=alias,
                                title=title,
                                color=color,
                                size=size)
                    nodes.add(alias)
                
                if i == 0:
                    net.add_edge(canonical, alias, 
                                title=f"标准字段 {canonical} 的别名",
                                color="#b0bec5")
                else:
                    prev_alias = aliases[i-1]
                    net.add_edge(prev_alias, alias,
                                title=f"重命名: {prev_alias} -> {alias}",
                                color="#ff9800")
        
        net.save_graph(output_path)
        
        return {
            "success": True,
            "output_path": output_path,
            "node_count": len(nodes),
            "table_name": table_name
        }

    def _generate_json_graph(self, lineage: Dict[str, Any], table_name: str) -> Dict[str, Any]:
        nodes = []
        edges = []
        
        for canonical, data in lineage["fields"].items():
            aliases = data.get("aliases", [])
            
            nodes.append({
                "id": canonical,
                "label": canonical,
                "type": "canonical",
                "first_seen": data.get("first_seen_version"),
                "last_seen": data.get("last_seen_version")
            })
            
            for i, alias in enumerate(aliases):
                if alias == canonical:
                    continue
                
                nodes.append({
                    "id": alias,
                    "label": alias,
                    "type": "alias",
                    "is_current": (i == len(aliases) - 1)
                })
                
                if i == 0:
                    edges.append({
                        "from": canonical,
                        "to": alias,
                        "label": "alias_of"
                    })
                else:
                    edges.append({
                        "from": aliases[i-1],
                        "to": alias,
                        "label": "renamed_to"
                    })
        
        return {
            "success": True,
            "table_name": table_name,
            "graph": {
                "nodes": nodes,
                "edges": edges
            }
        }

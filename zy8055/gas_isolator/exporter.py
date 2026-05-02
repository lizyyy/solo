import csv
import json
from typing import Dict, List, Set
from datetime import datetime


class ReportExporter:
    """报告导出器"""
    
    @staticmethod
    def export_isolation_plan(output_path: str, result: Dict, repair_point: Dict) -> None:
        """导出隔离计划Markdown"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        content = f"""# 燃气阀门隔离计划

**生成时间**: {now}

## 抢修信息

- 抢修点ID: {repair_point.get('id', 'N/A')}
- 抢修位置: {repair_point.get('location', 'N/A')}
- 抢修类型: {repair_point.get('type', 'N/A')}

## 需关闭阀门

| 阀门ID | 位置节点 | 当前状态 | 操作 |
|--------|----------|----------|------|
"""
        for valve_id in result['valves_to_close']:
            valve = result.get('valves_info', {}).get(valve_id, {})
            content += f"| {valve_id} | {valve.get('node', 'N/A')} | {valve.get('status', 'N/A')} | 关闭 |\n"
        
        content += f"""
## 受影响区域

- 受影响节点数: {len(result['affected_nodes'])}
- 受影响用户数: {len(result.get('affected_customers', []))}

## 受影响重点用户

"""
        if result.get('affected_customers'):
            content += "| 用户ID | 用户名称 | 优先级 | 节点位置 |\n"
            content += "|--------|----------|--------|----------|\n"
            for customer in result['affected_customers']:
                content += f"| {customer['id']} | {customer['name']} | {customer['priority']} | {customer['node']} |\n"
        else:
            content += "无重点用户受影响\n"
        
        content += """
## 旁通路径建议

"""
        if result.get('bypass_paths'):
            for i, path in enumerate(result['bypass_paths'], 1):
                content += f"### 路径 {i}\n"
                content += f"节点序列: {' → '.join(path)}\n\n"
        else:
            content += "未找到可用旁通路径\n"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    @staticmethod
    def export_affected_customers(output_path: str, customers: List[Dict]) -> None:
        """导出受影响用户CSV"""
        if not customers:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write("customer_id,name,priority,node,type,contact\n")
            return
        
        fieldnames = ['customer_id', 'name', 'priority', 'node', 'type', 'contact']
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for customer in customers:
                writer.writerow({
                    'customer_id': customer['id'],
                    'name': customer['name'],
                    'priority': customer['priority'],
                    'node': customer['node'],
                    'type': customer['type'],
                    'contact': customer['contact']
                })
    
    @staticmethod
    def export_network_map(output_path: str, graph, result: Dict, nodes: Dict, pipes: List[Dict]) -> None:
        """导出网络地图HTML"""
        nodes_data = []
        for node_id in graph.get_all_nodes():
            node_info = nodes.get(node_id, {})
            is_affected = node_id in result['affected_nodes']
            has_valve = 'valve' in graph.graph.nodes[node_id]
            valve_status = graph.graph.nodes[node_id].get('valve_status', 'unknown') if has_valve else None
            valve_id = graph.graph.nodes[node_id].get('valve') if has_valve else None
            is_closed = valve_id in result['valves_to_close']
            
            nodes_data.append({
                'id': node_id,
                'x': node_info.get('x', 0),
                'y': node_info.get('y', 0),
                'type': node_info.get('type', 'normal'),
                'affected': is_affected,
                'has_valve': has_valve,
                'valve_status': valve_status,
                'valve_closed': is_closed
            })
        
        edges_data = []
        for u, v, edge_data in graph.get_all_edges():
            u_affected = u in result['affected_nodes']
            v_affected = v in result['affected_nodes']
            edges_data.append({
                'id': edge_data.get('pipe_id', ''),
                'from': u,
                'to': v,
                'affected': u_affected and v_affected,
                'island': edge_data.get('island', False)
            })
        
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>燃气管网隔离分析图</title>
    <style>
        body {{ margin: 0; padding: 20px; font-family: Arial, sans-serif; }}
        #legend {{ margin-bottom: 20px; }}
        .legend-item {{ display: inline-block; margin-right: 20px; }}
        .legend-color {{ display: inline-block; width: 20px; height: 20px; margin-right: 5px; vertical-align: middle; }}
        #canvas {{ border: 1px solid #ccc; }}
    </style>
</head>
<body>
    <h1>燃气管网隔离分析图</h1>
    <div id="legend">
        <span class="legend-item"><span class="legend-color" style="background:#4CAF50;"></span>正常节点</span>
        <span class="legend-item"><span class="legend-color" style="background:#f44336;"></span>受影响节点</span>
        <span class="legend-item"><span class="legend-color" style="background:#2196F3;"></span>开启阀门</span>
        <span class="legend-item"><span class="legend-color" style="background:#FF9800;"></span>关闭阀门</span>
    </div>
    <canvas id="canvas" width="1200" height="800"></canvas>
    <script>
        const nodes = {json.dumps(nodes_data)};
        const edges = {json.dumps(edges_data)};
        
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        
        const minX = Math.min(...nodes.map(n => n.x));
        const maxX = Math.max(...nodes.map(n => n.x));
        const minY = Math.min(...nodes.map(n => n.y));
        const maxY = Math.max(...nodes.map(n => n.y));
        const padding = 50;
        const scaleX = (canvas.width - 2 * padding) / (maxX - minX || 1);
        const scaleY = (canvas.height - 2 * padding) / (maxY - minY || 1);
        const scale = Math.min(scaleX, scaleY);
        
        function transform(x, y) {{
            return {{
                x: padding + (x - minX) * scale,
                y: canvas.height - padding - (y - minY) * scale
            }};
        }}
        
        edges.forEach(edge => {{
            const from = transform(nodes.find(n => n.id === edge.from).x, nodes.find(n => n.id === edge.from).y);
            const to = transform(nodes.find(n => n.id === edge.to).x, nodes.find(n => n.id === edge.to).y);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.strokeStyle = edge.affected ? '#f44336' : (edge.island ? '#999' : '#4CAF50');
            ctx.lineWidth = edge.affected ? 3 : 2;
            ctx.stroke();
        }});
        
        nodes.forEach(node => {{
            const pos = transform(node.x, node.y);
            
            ctx.beginPath();
            if (node.has_valve) {{
                ctx.rect(pos.x - 8, pos.y - 8, 16, 16);
                ctx.fillStyle = node.valve_closed ? '#FF9800' : '#2196F3';
            }} else {{
                ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = node.affected ? '#f44336' : '#4CAF50';
            }}
            ctx.fill();
            ctx.strokeStyle = '#333';
            ctx.stroke();
            
            ctx.fillStyle = '#333';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(node.id, pos.x, pos.y + 20);
        }});
    </script>
</body>
</html>"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

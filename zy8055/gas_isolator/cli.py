import argparse
import os
from .parser import DataParser
from .graph_model import NetworkGraph
from .solver import IsolationSolver
from .exporter import ReportExporter


def main():
    parser = argparse.ArgumentParser(description='燃气阀门隔离影响分析工具')
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    plan_parser = subparsers.add_parser('plan', help='生成隔离计划')
    plan_parser.add_argument('--nodes', required=True, help='节点CSV文件路径')
    plan_parser.add_argument('--pipes', required=True, help='管段CSV文件路径')
    plan_parser.add_argument('--valves', required=True, help='阀门YAML文件路径')
    plan_parser.add_argument('--repair', required=True, help='抢修点JSON文件路径')
    plan_parser.add_argument('--customers', required=True, help='重点用户CSV文件路径')
    plan_parser.add_argument('--output-dir', default='.', help='输出目录')
    
    args = parser.parse_args()
    
    if args.command == 'plan':
        run_plan(args)


def run_plan(args):
    """执行隔离计划生成"""
    os.makedirs(args.output_dir, exist_ok=True)
    
    print("正在解析数据...")
    parser = DataParser()
    nodes = parser.parse_nodes_csv(args.nodes)
    pipes = parser.parse_pipes_csv(args.pipes)
    valves = parser.parse_valves_yaml(args.valves)
    repair_point = parser.parse_repair_json(args.repair)
    customers = parser.parse_customers_csv(args.customers)
    
    print("正在构建管网图...")
    graph = NetworkGraph()
    graph.build_graph(nodes, pipes, valves)
    
    print("正在计算隔离方案...")
    solver = IsolationSolver(graph, valves, customers)
    result = solver.find_min_valve_set(repair_point)
    
    print("正在分析受影响用户...")
    affected_customers = solver.find_affected_customers(result['affected_nodes'])
    result['affected_customers'] = affected_customers
    
    result['valves_info'] = {}
    for valve_id in result['valves_to_close']:
        if valve_id in valves:
            result['valves_info'][valve_id] = valves[valve_id]
    
    print("正在查找旁通路径...")
    bypass_paths = []
    repair_nodes = set()
    if 'nodes' in repair_point:
        repair_nodes.update(repair_point['nodes'])
    for customer in customers.values():
        if customer['node'] not in result['affected_nodes']:
            other_nodes = [n for n in customers.values() if n['node'] not in result['affected_nodes'] and n['node'] != customer['node']]
            if other_nodes:
                paths = solver.find_bypass_paths(customer['node'], other_nodes[0]['node'], result['valves_to_close'])
                if paths:
                    bypass_paths.extend(paths[:1])
    result['bypass_paths'] = bypass_paths[:3]
    
    print("正在导出报告...")
    md_path = os.path.join(args.output_dir, 'isolation_plan.md')
    csv_path = os.path.join(args.output_dir, 'affected_customers.csv')
    html_path = os.path.join(args.output_dir, 'network_map.html')
    
    ReportExporter.export_isolation_plan(md_path, result, repair_point)
    ReportExporter.export_affected_customers(csv_path, affected_customers)
    ReportExporter.export_network_map(html_path, graph, result, nodes, pipes)
    
    print(f"\n✅ 隔离计划生成完成！")
    print(f"   - 隔离计划: {md_path}")
    print(f"   - 受影响用户: {csv_path}")
    print(f"   - 网络图: {html_path}")
    print(f"\n📊 分析结果:")
    print(f"   - 需关闭阀门: {len(result['valves_to_close'])} 个")
    print(f"   - 受影响节点: {len(result['affected_nodes'])} 个")
    print(f"   - 受影响用户: {len(affected_customers)} 户")


if __name__ == '__main__':
    main()

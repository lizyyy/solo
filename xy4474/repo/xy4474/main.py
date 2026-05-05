# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 主程序入口
"""

import os
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Any, Optional

from config import DATA_DIR, EXPORT_DIR
from utils import logger
from data_reader import DataManager
from issue_detector import IssueDetectorEngine
from storage import ReviewStorage, LocalQueryInterface
from exporter import Exporter


class ReviewTool:
    """
    证件照交付复核工具主类
    """
    
    def __init__(self, data_dir: str = None):
        """
        初始化复核工具
        
        Args:
            data_dir: 数据目录路径
        """
        self.data_dir = data_dir or DATA_DIR
        self.data_manager = DataManager(self.data_dir)
        self.storage = ReviewStorage()
        self.query_interface = LocalQueryInterface(self.storage)
        self.exporter = Exporter(self.storage)
        
        self.current_session_id: Optional[int] = None
        self.detection_result: Optional[Dict[str, Any]] = None
    
    def run_review(self, session_name: str = None) -> Dict[str, Any]:
        """
        执行完整的复核流程
        
        Args:
            session_name: 会话名称
            
        Returns:
            复核结果摘要
        """
        logger.info("=" * 50)
        logger.info("开始执行证件照交付复核")
        logger.info("=" * 50)
        
        # 1. 创建复核会话
        self.current_session_id = self.storage.create_session(session_name)
        logger.info(f"创建复核会话: ID = {self.current_session_id}")
        
        # 2. 加载所有数据
        logger.info("正在加载数据...")
        load_result = self.data_manager.load_all()
        logger.info(f"数据加载完成: {load_result}")
        
        if load_result.get('errors_count', 0) > 0:
            logger.warning(f"数据加载时有 {load_result['errors_count']} 个错误")
            for error in load_result.get('errors', []):
                logger.warning(f"  - {error}")
        
        # 3. 保存订单数据
        orders = self.data_manager.orders
        if orders:
            self.storage.save_orders_batch(self.current_session_id, orders)
            logger.info(f"保存 {len(orders)} 条订单数据")
        
        # 4. 运行问题检测
        logger.info("正在执行问题检测...")
        detector = IssueDetectorEngine(self.data_manager)
        self.detection_result = detector.run_all()
        
        # 5. 保存检测到的问题
        all_issues = self.detection_result.get('issues_by_type', {})
        total_issues_saved = 0
        
        for issue_type, issue_data in all_issues.items():
            issues = issue_data.get('issues', [])
            for issue in issues:
                self.storage.save_issue(self.current_session_id, issue)
                total_issues_saved += 1
        
        logger.info(f"保存 {total_issues_saved} 个问题")
        
        # 6. 生成统计摘要
        stats = self.storage.get_statistics(self.current_session_id)
        
        result = {
            'session_id': self.current_session_id,
            'total_orders': stats.get('total_orders', 0),
            'total_issues': stats.get('total_issues', 0),
            'unresolved_issues': stats.get('unresolved_issues', 0),
            'issues_by_severity': stats.get('issues_by_severity', {}),
            'issues_by_type': stats.get('issues_by_type', []),
            'load_result': load_result,
        }
        
        # 7. 打印结果摘要
        self._print_result_summary(result)
        
        return result
    
    def _print_result_summary(self, result: Dict[str, Any]):
        """
        打印结果摘要
        """
        print("\n" + "=" * 50)
        print("复核结果摘要")
        print("=" * 50)
        print(f"\n会话ID: {result.get('session_id')}")
        print(f"总订单数: {result.get('total_orders')}")
        print(f"总问题数: {result.get('total_issues')}")
        print(f"未解决问题: {result.get('unresolved_issues')}")
        
        # 严重程度分布
        severity_stats = result.get('issues_by_severity', {})
        if severity_stats:
            print("\n问题严重程度分布:")
            severity_names = {
                'critical': '严重',
                'high': '高',
                'medium': '中',
                'low': '低'
            }
            for severity, count in severity_stats.items():
                name = severity_names.get(severity, severity)
                print(f"  - {name}: {count} 个")
        
        # 问题类型分布
        type_stats = result.get('issues_by_type', [])
        if type_stats:
            print("\n问题类型分布:")
            for item in type_stats:
                print(f"  - {item.get('name', item.get('type'))}: {item.get('count')} 个")
        
        # 提示
        if result.get('unresolved_issues', 0) > 0:
            print(f"\n⚠️  警告: 有 {result.get('unresolved_issues')} 个问题未解决，建议处理后再交付")
        else:
            print("\n✅ 所有问题已解决，可以安全交付")
        
        print("\n" + "=" * 50)
    
    def query_order(self, order_id: str) -> Dict[str, Any]:
        """
        查询订单详情
        
        Args:
            order_id: 订单号
            
        Returns:
            订单详情
        """
        result = self.query_interface.query_order(order_id, self.current_session_id)
        
        if result['found']:
            print(f"\n订单详情:")
            print(f"  订单号: {result['order'].get('order_id')}")
            print(f"  客户姓名: {result['order'].get('customer_name')}")
            print(f"  尺寸: {result['order'].get('sizes', [])}")
            print(f"  背景色: {result['order'].get('background')}")
            print(f"  优先级: {result['order'].get('priority')}")
            
            if result['issues']:
                print(f"\n  相关问题 ({len(result['issues'])} 个):")
                for i, issue in enumerate(result['issues'], 1):
                    status = "✅" if issue.get('resolved') else "❌"
                    print(f"    {i}. {status} {issue.get('issue_name')} ({issue.get('severity')})")
            
            if result['notes']:
                print(f"\n  相关备注 ({len(result['notes'])} 个):")
                for note in result['notes']:
                    print(f"    - [{note.get('created_at')}] {note.get('author')}: {note.get('content')}")
        else:
            print(f"\n未找到订单: {order_id}")
        
        return result
    
    def add_note(self, order_id: str, content: str, author: str = 'operator') -> int:
        """
        为订单添加备注
        
        Args:
            order_id: 订单号
            content: 备注内容
            author: 作者
            
        Returns:
            备注ID
        """
        if not self.current_session_id:
            raise ValueError("请先执行复核流程创建会话")
        
        note_id = self.query_interface.add_note_to_order(
            self.current_session_id, order_id, content, author
        )
        print(f"已添加备注: {content}")
        return note_id
    
    def resolve_issue(self, issue_id: int, notes: str = None, author: str = 'operator') -> bool:
        """
        标记问题为已解决
        
        Args:
            issue_id: 问题ID
            notes: 解决备注
            author: 处理人
            
        Returns:
            是否成功
        """
        success = self.query_interface.resolve_issue(issue_id, notes, author)
        if success:
            print(f"已标记问题 {issue_id} 为已解决")
        return success
    
    def export_results(self, session_id: int = None) -> Dict[str, str]:
        """
        导出复核结果
        
        Args:
            session_id: 会话ID（可选，默认为当前会话）
            
        Returns:
            导出文件路径字典
        """
        sid = session_id or self.current_session_id
        if not sid:
            raise ValueError("请指定会话ID或先执行复核流程")
        
        print(f"\n正在导出结果，会话ID: {sid}")
        
        results = self.exporter.export_all(sid)
        
        print("\n导出完成:")
        if 'markdown' in results:
            print(f"  - Markdown交付清单: {results['markdown']}")
        if 'json' in results:
            print(f"  - JSON审计包: {results['json']}")
        if 'markdown_error' in results:
            print(f"  - Markdown导出错误: {results['markdown_error']}")
        if 'json_error' in results:
            print(f"  - JSON导出错误: {results['json_error']}")
        
        return results
    
    def list_sessions(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        列出历史会话
        
        Args:
            limit: 返回数量限制
            
        Returns:
            会话列表
        """
        sessions = self.query_interface.list_sessions(limit)
        
        print(f"\n历史会话 (最多显示 {limit} 条):")
        print("-" * 80)
        print(f"{'ID':<6} {'名称':<30} {'状态':<10} {'订单数':<8} {'问题数':<8}")
        print("-" * 80)
        
        for session in sessions:
            print(f"{session.get('id'):<6} {session.get('session_name', '')[:28]:<30} "
                  f"{session.get('status', ''):<10} {session.get('total_orders', 0):<8} "
                  f"{session.get('total_issues', 0):<8}")
        
        return sessions
    
    def close_session(self, notes: str = None) -> bool:
        """
        关闭当前会话
        
        Args:
            notes: 会话备注
            
        Returns:
            是否成功
        """
        if not self.current_session_id:
            logger.warning("没有活动的会话")
            return False
        
        success = self.storage.close_session(self.current_session_id, notes)
        if success:
            print(f"已关闭会话: {self.current_session_id}")
            self.current_session_id = None
        return success


def interactive_mode():
    """
    交互模式
    """
    print("\n" + "=" * 60)
    print("证件照影楼交付前复核工具 - 交互模式")
    print("=" * 60)
    
    tool = ReviewTool()
    
    while True:
        print("\n" + "-" * 60)
        print("请选择操作:")
        print("  1. 执行完整复核流程")
        print("  2. 查询订单详情")
        print("  3. 添加备注")
        print("  4. 标记问题为已解决")
        print("  5. 导出结果")
        print("  6. 查看历史会话")
        print("  7. 关闭当前会话")
        print("  0. 退出")
        print("-" * 60)
        
        choice = input("\n请输入选项 (0-7): ").strip()
        
        try:
            if choice == '1':
                session_name = input("请输入会话名称 (可选，直接回车使用默认): ").strip()
                tool.run_review(session_name if session_name else None)
            
            elif choice == '2':
                order_id = input("请输入订单号: ").strip()
                if order_id:
                    tool.query_order(order_id)
                else:
                    print("订单号不能为空")
            
            elif choice == '3':
                order_id = input("请输入订单号: ").strip()
                if order_id:
                    content = input("请输入备注内容: ").strip()
                    if content:
                        tool.add_note(order_id, content)
                    else:
                        print("备注内容不能为空")
                else:
                    print("订单号不能为空")
            
            elif choice == '4':
                issue_id_str = input("请输入问题ID: ").strip()
                try:
                    issue_id = int(issue_id_str)
                    notes = input("请输入解决备注 (可选): ").strip()
                    tool.resolve_issue(issue_id, notes if notes else None)
                except ValueError:
                    print("问题ID必须是数字")
            
            elif choice == '5':
                if tool.current_session_id:
                    use_current = input(f"使用当前会话 {tool.current_session_id}? (y/n): ").strip().lower()
                    if use_current == 'y':
                        tool.export_results()
                    else:
                        session_id_str = input("请输入会话ID: ").strip()
                        try:
                            session_id = int(session_id_str)
                            tool.export_results(session_id)
                        except ValueError:
                            print("会话ID必须是数字")
                else:
                    session_id_str = input("请输入会话ID: ").strip()
                    try:
                        session_id = int(session_id_str)
                        tool.export_results(session_id)
                    except ValueError:
                        print("会话ID必须是数字")
            
            elif choice == '6':
                limit_str = input("请输入显示数量 (默认10): ").strip()
                limit = int(limit_str) if limit_str.isdigit() else 10
                tool.list_sessions(limit)
            
            elif choice == '7':
                notes = input("请输入会话备注 (可选): ").strip()
                tool.close_session(notes if notes else None)
            
            elif choice == '0':
                print("\n感谢使用，再见！")
                break
            
            else:
                print("无效的选项，请重新输入")
        
        except Exception as e:
            print(f"操作出错: {e}")
            logger.error(f"操作出错: {e}", exc_info=True)


def main():
    """
    主函数
    """
    parser = argparse.ArgumentParser(
        description='证件照影楼交付前复核工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例用法:
  python main.py                    # 进入交互模式
  python main.py --review           # 执行完整复核流程
  python main.py --review --export  # 执行复核并导出结果
  python main.py --query 20260501001  # 查询指定订单
  python main.py --sessions         # 查看历史会话
        '''
    )
    
    parser.add_argument('--review', action='store_true', help='执行完整复核流程')
    parser.add_argument('--export', action='store_true', help='导出复核结果')
    parser.add_argument('--query', type=str, metavar='ORDER_ID', help='查询指定订单')
    parser.add_argument('--sessions', action='store_true', help='查看历史会话')
    parser.add_argument('--session-name', type=str, metavar='NAME', help='会话名称')
    parser.add_argument('--data-dir', type=str, metavar='DIR', help='数据目录路径')
    
    args = parser.parse_args()
    
    # 如果没有指定任何参数，进入交互模式
    if not any([args.review, args.export, args.query, args.sessions]):
        interactive_mode()
        return
    
    # 命令行模式
    tool = ReviewTool(args.data_dir)
    
    try:
        if args.review:
            result = tool.run_review(args.session_name)
            
            if args.export:
                tool.export_results()
        
        elif args.query:
            tool.query_order(args.query)
        
        elif args.sessions:
            tool.list_sessions()
    
    except Exception as e:
        print(f"执行出错: {e}")
        logger.error(f"执行出错: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()

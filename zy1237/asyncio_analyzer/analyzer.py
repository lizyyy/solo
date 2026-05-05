import ast
import re
from typing import Dict, List, Any, Optional
from pathlib import Path

from .database import Database


class BaseAnalyzer:
    def __init__(self, database: Database, run_id: str, config: Dict):
        self.database = database
        self.run_id = run_id
        self.config = config

    def add_issue(self, issue_type: str, severity: str, title: str,
                  description: str = None, snippet_file: str = None,
                  snippet_line: int = None, task_id: str = None,
                  suggestion: str = None):
        self.database.insert_issue(self.run_id, {
            'issue_type': issue_type,
            'severity': severity,
            'title': title,
            'description': description,
            'snippet_file': snippet_file,
            'snippet_line': snippet_line,
            'task_id': task_id,
            'suggestion': suggestion,
        })

    def add_timeline(self, timestamp: str, event_type: str, task_id: str = None, details: Dict = None):
        self.database.insert_timeline(self.run_id, {
            'timestamp': timestamp,
            'event_type': event_type,
            'task_id': task_id,
            'details': details or {},
        })

    def add_blocking_point(self, snippet_file: str, snippet_line: int, operation: str,
                           duration: float = None, is_blocking: bool = True, task_id: str = None):
        self.database.insert_blocking_point(self.run_id, {
            'task_id': task_id,
            'snippet_file': snippet_file,
            'snippet_line': snippet_line,
            'operation': operation,
            'duration': duration,
            'is_blocking': is_blocking,
        })

    def add_leak_risk(self, risk_type: str, snippet_file: str, snippet_line: int,
                      description: str = None, risk_score: float = 0.5, task_id: str = None):
        self.database.insert_leak_risk(self.run_id, {
            'task_id': task_id,
            'risk_type': risk_type,
            'snippet_file': snippet_file,
            'snippet_line': snippet_line,
            'description': description,
            'risk_score': risk_score,
        })


class EventLoopAnalyzer(BaseAnalyzer):
    BLOCKING_PATTERNS = [
        (r'time\.sleep', 'time.sleep() - 阻塞调用，应使用 asyncio.sleep()'),
        (r'requests\.(get|post|put|delete|request)', 'requests 库 - 同步 HTTP 调用，应使用 aiohttp'),
        (r'urllib\.request\.', 'urllib - 同步网络调用'),
        (r'socket\.(connect|send|recv|accept)', 'socket 操作 - 阻塞 IO'),
        (r'subprocess\.(run|call|check_output)', 'subprocess 同步调用，应使用 asyncio.create_subprocess_*'),
        (r'open\s*\(', '文件操作 - 应考虑使用 aiofiles'),
    ]

    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_code(snippet)
        self._analyze_events(events)

    def _analyze_code(self, snippet: Dict):
        content = snippet['content']
        file_name = snippet['name']
        lines = snippet['lines']

        for pattern, description in self.BLOCKING_PATTERNS:
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    self.add_issue(
                        issue_type='event_loop_blocking',
                        severity='high',
                        title=f'检测到阻塞调用: {pattern}',
                        description=description,
                        snippet_file=file_name,
                        snippet_line=line_num,
                        suggestion='将阻塞调用替换为异步版本，或使用 loop.run_in_executor()'
                    )
                    self.add_blocking_point(
                        snippet_file=file_name,
                        snippet_line=line_num,
                        operation=description,
                        is_blocking=True
                    )

    def _analyze_events(self, events: List[Dict]):
        for event in events:
            if event.get('event_type') == 'event_loop_blocked':
                self.add_issue(
                    issue_type='event_loop_blocking',
                    severity='critical',
                    title='事件循环阻塞',
                    description=f"事件循环被阻塞了 {event.get('duration_ms', 0)}ms",
                    task_id=event.get('task_id'),
                    suggestion='检查阻塞调用，考虑使用异步替代方案'
                )


class AwaitBoundaryAnalyzer(BaseAnalyzer):
    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_ast(snippet)

    def _analyze_ast(self, snippet: Dict):
        tree = snippet['ast']
        file_name = snippet['name']

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                self._check_sync_function_await(node, file_name)
            elif isinstance(node, ast.AsyncFunctionDef):
                self._check_async_function(node, file_name)

    def _check_sync_function_await(self, node: ast.FunctionDef, file_name: str):
        for body_node in ast.walk(node):
            if isinstance(body_node, ast.Await):
                self.add_issue(
                    issue_type='await_boundary',
                    severity='critical',
                    title='同步函数中使用 await',
                    description=f"函数 '{node.name}' 是同步函数，但内部使用了 await",
                    snippet_file=file_name,
                    snippet_line=node.lineno,
                    suggestion='将函数声明为 async def，或移除 await 调用'
                )

    def _check_async_function(self, node: ast.AsyncFunctionDef, file_name: str):
        for body_node in ast.walk(node):
            if isinstance(body_node, ast.Call):
                if isinstance(body_node.func, ast.Attribute):
                    attr_name = body_node.func.attr
                    if attr_name in ('run', 'call', 'check_output'):
                        for keyword in body_node.keywords:
                            if keyword.arg == 'capture_output':
                                continue
                        self.add_issue(
                            issue_type='await_boundary',
                            severity='medium',
                            title='可能缺少 await 的调用',
                            description=f"在异步函数 '{node.name}' 中调用了可能需要 await 的方法",
                            snippet_file=file_name,
                            snippet_line=body_node.lineno,
                            suggestion='检查是否需要添加 await'
                        )


class CreateTaskLeakAnalyzer(BaseAnalyzer):
    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_ast(snippet)
        self._analyze_events(events)

    def _analyze_ast(self, snippet: Dict):
        tree = snippet['ast']
        file_name = snippet['name']

        for node in ast.walk(tree):
            if isinstance(node, ast.Expr):
                if isinstance(node.value, ast.Call):
                    if self._is_create_task_call(node.value):
                        self.add_issue(
                            issue_type='create_task_leak',
                            severity='high',
                            title='未托管的 create_task 调用',
                            description='create_task 的返回值没有被存储或 await，任务可能会泄漏',
                            snippet_file=file_name,
                            snippet_line=node.lineno,
                            suggestion='将任务存储在变量中，使用 TaskGroup 或 await 任务完成'
                        )
                        self.add_leak_risk(
                            risk_type='unmanaged_task',
                            snippet_file=file_name,
                            snippet_line=node.lineno,
                            description='create_task 返回值未被管理',
                            risk_score=0.9
                        )

            elif isinstance(node, ast.Assign):
                if isinstance(node.value, ast.Call):
                    if self._is_create_task_call(node.value):
                        if not self._is_task_used(node.targets, tree):
                            self.add_issue(
                                issue_type='create_task_leak',
                                severity='medium',
                                title='任务变量未被使用',
                                description='任务被存储但从未被 await 或取消',
                                snippet_file=file_name,
                                snippet_line=node.lineno,
                                suggestion='确保任务被正确 await 或在不需要时取消'
                            )
                            self.add_leak_risk(
                                risk_type='unused_task_variable',
                                snippet_file=file_name,
                                snippet_line=node.lineno,
                                description='任务变量未被使用',
                                risk_score=0.6
                            )

    def _is_create_task_call(self, node: ast.Call) -> bool:
        if isinstance(node.func, ast.Name):
            return node.func.id == 'create_task'
        elif isinstance(node.func, ast.Attribute):
            return node.func.attr == 'create_task'
        return False

    def _is_task_used(self, targets: List, tree: ast.AST) -> bool:
        for target in targets:
            if isinstance(target, ast.Name):
                var_name = target.id
                for node in ast.walk(tree):
                    if isinstance(node, ast.Await):
                        if isinstance(node.value, ast.Name):
                            if node.value.id == var_name:
                                return True
                    elif isinstance(node, ast.Call):
                        if isinstance(node.func, ast.Attribute):
                            if isinstance(node.func.value, ast.Name):
                                if node.func.value.id == var_name:
                                    if node.func.attr in ('cancel', 'result', 'exception'):
                                        return True
        return False

    def _analyze_events(self, events: List[Dict]):
        for event in events:
            if event.get('event_type') == 'task_leak_detected':
                self.add_issue(
                    issue_type='create_task_leak',
                    severity='critical',
                    title='检测到任务泄漏',
                    description=f"任务 {event.get('task_id')} 从未完成或被取消",
                    task_id=event.get('task_id'),
                    suggestion='检查任务生命周期，确保所有任务都被正确管理'
                )


class GatherExceptionAnalyzer(BaseAnalyzer):
    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_ast(snippet)

    def _analyze_ast(self, snippet: Dict):
        tree = snippet['ast']
        file_name = snippet['name']

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if self._is_gather_call(node):
                    self._check_gather_usage(node, file_name)
                elif self._is_taskgroup(node):
                    self._check_taskgroup_usage(node, file_name)

    def _is_gather_call(self, node: ast.Call) -> bool:
        if isinstance(node.func, ast.Attribute):
            return node.func.attr == 'gather'
        elif isinstance(node.func, ast.Name):
            return node.func.id == 'gather'
        return False

    def _is_taskgroup(self, node: ast.AST) -> bool:
        if isinstance(node, ast.With):
            for item in node.items:
                if isinstance(item.context_expr, ast.Call):
                    if isinstance(item.context_expr.func, ast.Name):
                        if item.context_expr.func.id == 'TaskGroup':
                            return True
                    elif isinstance(item.context_expr.func, ast.Attribute):
                        if item.context_expr.func.attr == 'TaskGroup':
                            return True
        return False

    def _check_gather_usage(self, node: ast.Call, file_name: str):
        has_return_exceptions = False
        for keyword in node.keywords:
            if keyword.arg == 'return_exceptions':
                if isinstance(keyword.value, ast.Constant):
                    has_return_exceptions = keyword.value.value is True
                break

        if not has_return_exceptions:
            self.add_issue(
                issue_type='gather_exception',
                severity='medium',
                title='gather 未设置 return_exceptions',
                description='asyncio.gather 默认会在第一个任务异常时取消所有其他任务',
                snippet_file=file_name,
                snippet_line=node.lineno,
                suggestion='考虑设置 return_exceptions=True 来收集所有异常，或使用 try/except 包裹'
            )

        parent_try = self._find_parent_try(node)
        if not parent_try:
            self.add_issue(
                issue_type='gather_exception',
                severity='high',
                title='gather 调用没有异常处理',
                description='gather 调用可能抛出异常，但没有被 try/except 包裹',
                snippet_file=file_name,
                snippet_line=node.lineno,
                suggestion='使用 try/except 包裹 gather 调用，处理可能的异常'
            )

    def _check_taskgroup_usage(self, node: ast.With, file_name: str):
        pass

    def _find_parent_try(self, node: ast.AST) -> Optional[ast.Try]:
        return None


class TimeoutCancelAnalyzer(BaseAnalyzer):
    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_ast(snippet)
        self._analyze_events(events)

    def _analyze_ast(self, snippet: Dict):
        tree = snippet['ast']
        file_name = snippet['name']

        for node in ast.walk(tree):
            if isinstance(node, ast.With):
                for item in node.items:
                    if isinstance(item.context_expr, ast.Call):
                        if self._is_timeout_call(item.context_expr):
                            self._check_timeout_usage(node, item, file_name)

            elif isinstance(node, ast.Try):
                for handler in node.handlers:
                    if isinstance(handler.type, ast.Name):
                        if handler.type.id == 'CancelledError':
                            self._check_cancelled_error_handling(node, handler, file_name)
                        elif handler.type.id == 'TimeoutError':
                            self._check_timeout_error_handling(node, handler, file_name)

    def _is_timeout_call(self, node: ast.Call) -> bool:
        if isinstance(node.func, ast.Attribute):
            return node.func.attr in ('wait_for', 'timeout')
        elif isinstance(node.func, ast.Name):
            return node.func.id in ('wait_for', 'timeout')
        return False

    def _check_timeout_usage(self, with_node: ast.With, item: ast.withitem, file_name: str):
        has_exception_handler = False
        current = with_node
        while current:
            if isinstance(current, ast.Try):
                for handler in current.handlers:
                    if isinstance(handler.type, ast.Name):
                        if handler.type.id in ('TimeoutError', 'CancelledError', 'Exception'):
                            has_exception_handler = True
                            break
            current = getattr(current, 'parent', None)

        if not has_exception_handler:
            self.add_issue(
                issue_type='timeout_propagation',
                severity='medium',
                title='超时操作缺少异常处理',
                description='使用了 wait_for 或 timeout 但没有处理 TimeoutError',
                snippet_file=file_name,
                snippet_line=with_node.lineno,
                suggestion='添加 try/except 来处理 TimeoutError 和 CancelledError'
            )

    def _check_cancelled_error_handling(self, try_node: ast.Try, handler: ast.ExceptHandler, file_name: str):
        has_reraise = False
        for node in ast.walk(handler):
            if isinstance(node, ast.Raise):
                has_reraise = True
                break

        if not has_reraise:
            self.add_issue(
                issue_type='timeout_propagation',
                severity='high',
                title='CancelledError 被静默捕获',
                description='捕获了 CancelledError 但没有重新抛出，这可能破坏取消传播',
                snippet_file=file_name,
                snippet_line=handler.lineno,
                suggestion='在处理完 CancelledError 后重新抛出，或使用 `except CancelledError: raise`'
            )

    def _check_timeout_error_handling(self, try_node: ast.Try, handler: ast.ExceptHandler, file_name: str):
        pass

    def _analyze_events(self, events: List[Dict]):
        for event in events:
            if event.get('event_type') == 'cancel_not_propagated':
                self.add_issue(
                    issue_type='timeout_propagation',
                    severity='critical',
                    title='取消操作未传播',
                    description=f"任务 {event.get('task_id')} 被取消但取消信号未传播",
                    task_id=event.get('task_id'),
                    suggestion='检查是否有地方静默捕获了 CancelledError'
                )


class QueueBackpressureAnalyzer(BaseAnalyzer):
    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_ast(snippet)
        self._analyze_events(events)

    def _analyze_ast(self, snippet: Dict):
        tree = snippet['ast']
        file_name = snippet['name']

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id == 'Queue':
                    self._check_queue_creation(node, file_name)
                elif isinstance(node.func, ast.Attribute):
                    if node.func.attr == 'put_nowait':
                        self.add_issue(
                            issue_type='queue_backpressure',
                            severity='medium',
                            title='使用 put_nowait 可能导致背压问题',
                            description='put_nowait 不会阻塞，如果队列满会抛出异常',
                            snippet_file=file_name,
                            snippet_line=node.lineno,
                            suggestion='考虑使用 await queue.put() 来实现背压控制'
                        )

    def _check_queue_creation(self, node: ast.Call, file_name: str):
        has_maxsize = False
        for arg in node.args:
            if isinstance(arg, ast.Constant):
                has_maxsize = True
                break
        for keyword in node.keywords:
            if keyword.arg == 'maxsize':
                has_maxsize = True
                if isinstance(keyword.value, ast.Constant):
                    if keyword.value.value <= 0:
                        self.add_issue(
                            issue_type='queue_backpressure',
                            severity='high',
                            title='无界队列可能导致内存泄漏',
                            description='Queue 设置了 maxsize=0 或负数，这是无界队列',
                            snippet_file=file_name,
                            snippet_line=node.lineno,
                            suggestion='设置合理的 maxsize 来实现背压控制'
                        )
                break

        if not has_maxsize:
            self.add_issue(
                issue_type='queue_backpressure',
                severity='medium',
                title='Queue 未设置 maxsize',
                description='未设置 maxsize 的队列默认是无界的，可能导致内存问题',
                snippet_file=file_name,
                snippet_line=node.lineno,
                suggestion='考虑设置合理的 maxsize 值'
            )

    def _analyze_events(self, events: List[Dict]):
        for event in events:
            if event.get('event_type') == 'queue_full':
                self.add_issue(
                    issue_type='queue_backpressure',
                    severity='high',
                    title='队列已满',
                    description=f"队列 {event.get('queue_name')} 已满，可能存在背压问题",
                    suggestion='检查生产者和消费者速度是否匹配，考虑增加消费者或增大队列'
                )


class ConnectionPoolAnalyzer(BaseAnalyzer):
    def analyze(self, snippets: List[Dict], events: List[Dict]):
        for snippet in snippets:
            self._analyze_ast(snippet)
        self._analyze_events(events)

    def _analyze_ast(self, snippet: Dict):
        tree = snippet['ast']
        file_name = snippet['name']

        pool_patterns = [
            (r'ClientSession', 'aiohttp ClientSession'),
            (r'create_pool', '数据库连接池'),
            (r'TCPConnector.*limit', '连接数限制'),
        ]

        content = snippet['content']
        lines = snippet['lines']

        for pattern, desc in pool_patterns:
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, line):
                    if 'limit' not in line.lower() and 'maxsize' not in line.lower():
                        self.add_issue(
                            issue_type='connection_pool_exhaustion',
                            severity='medium',
                            title=f'{desc} 可能缺少连接限制',
                            description=f'创建 {desc} 时未明确设置连接数限制',
                            snippet_file=file_name,
                            snippet_line=line_num,
                            suggestion='设置合理的连接数限制，避免连接耗尽'
                        )

    def _analyze_events(self, events: List[Dict]):
        for event in events:
            if event.get('event_type') == 'connection_pool_exhausted':
                self.add_issue(
                    issue_type='connection_pool_exhaustion',
                    severity='critical',
                    title='连接池耗尽',
                    description=f"连接池 {event.get('pool_name')} 已耗尽所有连接",
                    suggestion='增加连接池大小，或检查连接是否正确释放'
                )


class AsyncioAnalyzer:
    def __init__(self, database: Database, run_id: str, config: Dict):
        self.database = database
        self.run_id = run_id
        self.config = config

        self.analyzers = [
            EventLoopAnalyzer(database, run_id, config),
            AwaitBoundaryAnalyzer(database, run_id, config),
            CreateTaskLeakAnalyzer(database, run_id, config),
            GatherExceptionAnalyzer(database, run_id, config),
            TimeoutCancelAnalyzer(database, run_id, config),
            QueueBackpressureAnalyzer(database, run_id, config),
            ConnectionPoolAnalyzer(database, run_id, config),
        ]

    def analyze(self, snippets: List[Dict], events: List[Dict]):
        enabled_checks = self._get_enabled_checks()

        for analyzer in self.analyzers:
            analyzer_type = analyzer.__class__.__name__.lower().replace('analyzer', '')
            if analyzer_type in enabled_checks or 'all' in enabled_checks:
                analyzer.analyze(snippets, events)

    def _get_enabled_checks(self) -> List[str]:
        analysis_config = self.config.get('analysis', {})
        return analysis_config.get('enabled_checks', ['all'])

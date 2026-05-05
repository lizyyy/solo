"""核心分析引擎。

检测 __iter__/__next__、yield/yield from、send/throw/close、
StopIteration、惰性求值、一次性迭代器、tee 缓存膨胀等问题。
"""

from typing import List, Optional

from .models import (
    CodeSnippet,
    Finding,
    Location,
    PitfallType,
    Severity,
)


class PatternAnalyzer:
    """基于模式的代码分析器。"""

    def __init__(self):
        self.rules = self._define_rules()

    @staticmethod
    def _define_rules() -> List[dict]:
        """定义检测规则。"""
        return [
            {
                "id": "iter_returns_self",
                "pitfall_type": PitfallType.ITERATOR_PROTOCOL,
                "severity": Severity.HIGH,
                "title": "__iter__ 返回 self 导致一次性迭代器",
                "description": (
                    "当类的 __iter__ 方法返回 self 时，该类的实例是一次性迭代器。"
                    "多次迭代同一实例会导致意外行为（第二次迭代为空）。"
                ),
                "condition": lambda parsed: (
                    parsed.get("has_iter_protocol") and
                    parsed.get("iter_returns_self") is True
                ),
                "suggestion": (
                    "建议：\n"
                    "1. 分离可迭代对象和迭代器：__iter__ 返回新的迭代器实例\n"
                    "2. 或者使用可迭代协议：让 __iter__ 是一个生成器函数\n"
                    "3. 示例：\n"
                    "   class DataIterable:\n"
                    "       def __iter__(self):\n"
                    "           for item in self.data:\n"
                    "               yield item"
                ),
            },
            {
                "id": "raise_stopiteration",
                "pitfall_type": PitfallType.STOP_ITERATION,
                "severity": Severity.CRITICAL,
                "title": "生成器中手动抛出 StopIteration",
                "description": (
                    "在 Python 3.7+ 中，生成器内部抛出 StopIteration 会被转换为 RuntimeError。"
                    "这是 PEP 479 规定的行为，用于防止异常被错误传播。"
                ),
                "condition": lambda parsed: parsed.get("has_raise_stopiteration", False),
                "suggestion": (
                    "建议：\n"
                    "1. 在生成器中使用 return 语句代替 raise StopIteration\n"
                    "2. 如果需要传递值给 yield from，使用 return value\n"
                    "3. 示例：\n"
                    "   def generator():\n"
                    "       yield 1\n"
                    "       return 'done'  # 而不是 raise StopIteration\n"
                    "\n"
                    "   def outer():\n"
                    "       result = yield from generator()  # 获取 'done'"
                ),
            },
            {
                "id": "uses_tee",
                "pitfall_type": PitfallType.TEE_CACHE,
                "severity": Severity.MEDIUM,
                "title": "使用 itertools.tee 可能导致内存膨胀",
                "description": (
                    "itertools.tee 创建的迭代器之间共享缓存。如果一个迭代器消费速度"
                    "远快于另一个，未被消费的元素会累积在缓存中，导致内存持续增长。"
                ),
                "condition": lambda parsed: parsed.get("uses_tee", False),
                "suggestion": (
                    "建议：\n"
                    "1. 确保两个 tee 迭代器消费速度大致相同\n"
                    "2. 如果数据量小，考虑直接转换为列表\n"
                    "3. 及时消费或丢弃不需要的 tee 迭代器\n"
                    "4. 示例：\n"
                    "   # 好的做法：同时消费\n"
                    "   tee1, tee2 = itertools.tee(data, 2)\n"
                    "   for a, b in zip(tee1, tee2):\n"
                    "       process(a, b)"
                ),
            },
            {
                "id": "has_send",
                "pitfall_type": PitfallType.SEND_THROW_CLOSE,
                "severity": Severity.MEDIUM,
                "title": "使用 generator.send() 需要正确启动",
                "description": (
                    "向刚启动的生成器发送非 None 值会导致 TypeError。"
                    "生成器必须先用 next() 或 send(None) 启动到第一个 yield 点。"
                ),
                "condition": lambda parsed: parsed.get("has_send", False),
                "suggestion": (
                    "建议：\n"
                    "1. 首次调用使用 next(gen) 或 gen.send(None)\n"
                    "2. 考虑使用 @contextlib.contextmanager 装饰器\n"
                    "3. 示例：\n"
                    "   gen = echo_generator()\n"
                    "   next(gen)  # 或 gen.send(None)\n"
                    "   gen.send('Hello')  # 现在可以了"
                ),
            },
            {
                "id": "has_generator_expr",
                "pitfall_type": PitfallType.LAZY_EVALUATION,
                "severity": Severity.LOW,
                "title": "使用生成器表达式（惰性求值）",
                "description": (
                    "生成器表达式是惰性求值的，副作用和异常可能延迟到消费时才暴露。"
                    "如果原始数据在创建和消费之间被修改，结果可能出乎意料。"
                ),
                "condition": lambda parsed: (
                    parsed.get("has_generator_expr", False) and
                    not parsed.get("has_list_comp", False)
                ),
                "suggestion": (
                    "建议：\n"
                    "1. 如果需要立即求值，使用列表推导式 [...]\n"
                    "2. 如果需要惰性，确保数据在消费前不会被修改\n"
                    "3. 尽早验证数据，避免异常延迟暴露\n"
                    "4. 示例：\n"
                    "   # 立即求值\n"
                    "   result = [x * 2 for x in data]\n"
                    "   \n"
                    "   # 惰性但安全\n"
                    "   data_copy = list(data)\n"
                    "   result = (x * 2 for x in data_copy)"
                ),
            },
            {
                "id": "has_yield_from",
                "pitfall_type": PitfallType.YIELD_FROM,
                "severity": Severity.INFO,
                "title": "使用 yield from 委托生成器",
                "description": (
                    "yield from 会自动处理子生成器的 StopIteration，并获取其返回值。"
                    "这是正确的做法，但要确保理解返回值的传递机制。"
                ),
                "condition": lambda parsed: parsed.get("has_yield_from", False),
                "suggestion": (
                    "提示：\n"
                    "1. yield from 会自动捕获子生成器的 StopIteration\n"
                    "2. 子生成器的 return 值会赋给 yield from 左边的变量\n"
                    "3. 示例：\n"
                    "   def inner():\n"
                    "       yield 1\n"
                    "       return 'done'\n"
                    "   \n"
                    "   def outer():\n"
                    "       result = yield from inner()  # result = 'done'"
                ),
            },
            {
                "id": "iterator_protocol_implementation",
                "pitfall_type": PitfallType.ITERATOR_PROTOCOL,
                "severity": Severity.MEDIUM,
                "title": "实现了迭代器协议",
                "description": (
                    "代码实现了 __iter__ 和/或 __next__ 方法。需要确保正确遵循迭代器协议："
                    "1. 迭代器的 __iter__ 应该返回 self\n"
                    "2. 可迭代对象的 __iter__ 应该返回新的迭代器\n"
                    "3. __next__ 应该在耗尽时抛出 StopIteration"
                ),
                "condition": lambda parsed: (
                    parsed.get("has_iter_protocol") or parsed.get("has_next_method")
                ),
                "suggestion": (
                    "建议验证：\n"
                    "1. __iter__ 是否返回 self？（迭代器）或新实例？（可迭代对象）\n"
                    "2. __next__ 是否正确抛出 StopIteration？\n"
                    "3. 多次迭代同一实例是否会产生预期结果？\n"
                    "\n"
                    "区分：\n"
                    "- 可迭代对象：可以多次迭代，__iter__ 返回新迭代器\n"
                    "- 迭代器：一次性使用，__iter__ 返回 self"
                ),
            },
        ]

    def analyze(self, parsed: dict) -> List[Finding]:
        """分析解析后的代码，返回发现的问题。"""
        findings = []
        line_matches = parsed.get("line_matches", {})
        file_path = parsed.get("file_path")

        for rule in self.rules:
            try:
                if rule["condition"](parsed):
                    relevant_lines = self._find_relevant_lines(
                        line_matches, rule["id"]
                    )

                    for line_num in relevant_lines:
                        location = Location(
                            file_path=file_path or "<unknown>",
                            line_number=line_num,
                        )

                        code_snippet = self._get_code_snippet(
                            parsed.get("lines", []), line_num
                        )

                        finding = Finding(
                            pitfall_type=rule["pitfall_type"],
                            severity=rule["severity"],
                            title=rule["title"],
                            description=rule["description"],
                            location=location,
                            suggestion=rule["suggestion"],
                            code_snippet=code_snippet,
                            context={"rule_id": rule["id"]},
                        )
                        findings.append(finding)
            except Exception:
                continue

        return findings

    @staticmethod
    def _find_relevant_lines(line_matches: dict, rule_id: str) -> List[int]:
        """查找与规则相关的行号。"""
        pattern_map = {
            "iter_returns_self": ["iter_def", "next_def"],
            "raise_stopiteration": ["raise_stopiteration"],
            "uses_tee": ["itertools_tee"],
            "has_send": ["send"],
            "has_generator_expr": ["generator_expr"],
            "has_yield_from": ["yield_from"],
            "iterator_protocol_implementation": ["iter_def", "next_def"],
        }

        relevant_patterns = pattern_map.get(rule_id, [])
        relevant_lines = set()

        for line_num, patterns in line_matches.items():
            for p in relevant_patterns:
                if p in patterns:
                    relevant_lines.add(line_num)
                    break

        return sorted(relevant_lines) if relevant_lines else [None]

    @staticmethod
    def _get_code_snippet(lines: List[str], line_num: Optional[int]) -> Optional[str]:
        """获取代码片段。"""
        if line_num is None or not lines:
            return None

        start = max(0, line_num - 2)
        end = min(len(lines), line_num + 1)

        snippet_lines = []
        for i in range(start, end):
            prefix = "-> " if i + 1 == line_num else "   "
            snippet_lines.append(f"{prefix}{i + 1:4d}: {lines[i]}")

        return "\n".join(snippet_lines)


class AdvancedAnalyzer:
    """高级分析器：检测更复杂的模式。"""

    def analyze(self, parsed: dict) -> List[Finding]:
        """执行高级分析。"""
        findings = []

        findings.extend(self._check_closure_capture(parsed))
        findings.extend(self._check_generator_exit_handling(parsed))

        return findings

    @staticmethod
    def _check_closure_capture(parsed: dict) -> List[Finding]:
        """检测闭包变量捕获问题。"""
        findings = []
        content = parsed.get("content", "")
        file_path = parsed.get("file_path")

        patterns = [
            (
                r"for\s+(\w+)\s+in\s+[^:]+:\s*\n\s*.*lambda\s*[^:]*:\s*.*\1",
                "循环中创建 lambda 可能捕获循环变量",
                Severity.HIGH,
            ),
            (
                r"for\s+(\w+)\s+in\s+[^:]+:\s*\n\s*def\s+\w+\s*\([^)]*\):\s*\n\s*.*\1",
                "循环中定义函数可能捕获循环变量",
                Severity.HIGH,
            ),
        ]

        import re
        for pattern, desc, severity in patterns:
            lines = content.splitlines()
            for line_num, line in enumerate(lines, 1):
                if re.search(pattern, content, re.MULTILINE):
                    finding = Finding(
                        pitfall_type=PitfallType.CLOSURE_CAPTURE,
                        severity=severity,
                        title="潜在的闭包变量捕获问题",
                        description=(
                            f"{desc}。在 Python 中，闭包捕获的是变量引用而不是值。"
                            "如果在循环中创建函数/lambda，它们可能都引用循环变量的最终值。"
                        ),
                        location=Location(
                            file_path=file_path or "<unknown>",
                            line_number=line_num,
                        ),
                        suggestion=(
                            "建议：\n"
                            "1. 使用默认参数捕获当前值：lambda x, n=i: x * n\n"
                            "2. 使用 functools.partial\n"
                            "3. 示例：\n"
                            "   # 错误\n"
                            "   multipliers = [lambda x: x * i for i in range(3)]\n"
                            "   \n"
                            "   # 正确\n"
                            "   multipliers = [lambda x, i=i: x * i for i in range(3)]"
                        ),
                    )
                    findings.append(finding)
                    break

        return findings

    @staticmethod
    def _check_generator_exit_handling(parsed: dict) -> List[Finding]:
        """检测 GeneratorExit 处理问题。"""
        findings = []
        content = parsed.get("content", "")
        file_path = parsed.get("file_path")

        lines = content.splitlines()
        in_generator_exit = False
        generator_exit_line = None

        for line_num, line in enumerate(lines, 1):
            if "except GeneratorExit" in line:
                in_generator_exit = True
                generator_exit_line = line_num
            elif in_generator_exit and line.strip().startswith("yield"):
                finding = Finding(
                    pitfall_type=PitfallType.SEND_THROW_CLOSE,
                    severity=Severity.CRITICAL,
                    title="在 GeneratorExit 处理中 yield",
                    description=(
                        "在 except GeneratorExit 块中 yield 会导致 RuntimeError。"
                        "GeneratorExit 表示生成器正在被关闭，此时不能再 yield 值。"
                    ),
                    location=Location(
                        file_path=file_path or "<unknown>",
                        line_number=line_num,
                    ),
                    suggestion=(
                        "建议：\n"
                        "1. 在 GeneratorExit 处理中只执行清理操作\n"
                        "2. 不要在该块中 yield\n"
                        "3. 示例：\n"
                        "   def generator():\n"
                        "       try:\n"
                        "           while True:\n"
                        "               yield data\n"
                        "       except GeneratorExit:\n"
                        "           cleanup()  # 只清理，不 yield\n"
                        "           raise  # 可选：重新抛出"
                    ),
                )
                findings.append(finding)
                break

        return findings


class FullAnalyzer:
    """完整分析器：组合所有分析能力。"""

    def __init__(self):
        self.pattern_analyzer = PatternAnalyzer()
        self.advanced_analyzer = AdvancedAnalyzer()

    def analyze_code_snippet(self, parsed: dict) -> CodeSnippet:
        """分析单个代码片段。"""
        findings = []
        findings.extend(self.pattern_analyzer.analyze(parsed))
        findings.extend(self.advanced_analyzer.analyze(parsed))

        return CodeSnippet(
            file_path=parsed.get("file_path", "<unknown>"),
            content=parsed.get("content", ""),
            findings=findings,
        )

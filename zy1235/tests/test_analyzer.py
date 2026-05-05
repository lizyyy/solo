"""Tests for analyzer modules."""

from pathlib import Path
from typing import Any

import pytest

from decorator_analyzer.analyzer import AnalysisConfig, DecoratorAnalyzer
from decorator_analyzer.models import (
    CallEvent,
    DecoratedFunction,
    DecoratorInfo,
    DecoratorType,
    FunctionMetadata,
    RiskLevel,
    RiskType,
)


class TestDecoratorAnalyzer:
    """Tests for DecoratorAnalyzer."""

    def test_analyze_simple_decorator_without_wraps(self) -> None:
        """Test analyzing simple decorator without functools.wraps."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="(a: int) -> int",
            docstring="Test function",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="timer",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=False,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        assert len(result.decorated_functions) == 1
        assert len(result.risks) > 0
        
        metadata_loss_risks = [r for r in result.risks if r.risk_type == RiskType.METADATA_LOSS]
        assert len(metadata_loss_risks) == 1

    def test_analyze_decorator_with_wraps(self) -> None:
        """Test analyzing decorator with functools.wraps."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="timer",
            decorator_type=DecoratorType.FUNCTOOLS_WRAPS,
            module="test",
            line_number=10,
            has_wraps=True,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        metadata_loss_risks = [r for r in result.risks if r.risk_type == RiskType.METADATA_LOSS]
        assert len(metadata_loss_risks) == 0

    def test_analyze_stacked_decorators(self) -> None:
        """Test analyzing multiple decorators on same function."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorators = [
            DecoratorInfo(
                id="dec1",
                name="log_calls",
                decorator_type=DecoratorType.SIMPLE,
                module="test",
                line_number=5,
                has_wraps=False,
            ),
            DecoratorInfo(
                id="dec2",
                name="measure_time",
                decorator_type=DecoratorType.SIMPLE,
                module="test",
                line_number=15,
                has_wraps=False,
            ),
        ]
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=decorators,
            decorator_order=["dec1", "dec2"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        order_risks = [r for r in result.risks if r.risk_type == RiskType.ORDER_DEPENDENCY]
        assert len(order_risks) == 1

    def test_analyze_exception_swallow(self) -> None:
        """Test detecting exception swallowing in decorator."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        bad_decorator_code = '''
def silent_exception(func):
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            return None
    return wrapper
'''
        
        decorator = DecoratorInfo(
            id="dec1",
            name="silent_exception",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=False,
            source_code=bad_decorator_code,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        exception_risks = [r for r in result.risks if r.risk_type == RiskType.EXCEPTION_SWALLOW]
        assert len(exception_risks) == 1
        assert exception_risks[0].level in [RiskLevel.CRITICAL, RiskLevel.HIGH]

    def test_analyze_async_mismatch(self) -> None:
        """Test detecting async decorator on sync function."""
        func_metadata = FunctionMetadata(
            name="sync_func",
            module="test",
            signature="() -> None",
            is_async=False,
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="async_timer",
            decorator_type=DecoratorType.ASYNC,
            module="test",
            line_number=10,
            has_wraps=True,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        async_risks = [r for r in result.risks if r.risk_type == RiskType.ASYNC_MISMATCH]
        assert len(async_risks) == 1
        assert async_risks[0].level == RiskLevel.HIGH

    def test_analyze_descriptor(self) -> None:
        """Test analyzing descriptor decorators."""
        func_metadata = FunctionMetadata(
            name="my_method",
            module="test.MyClass",
            signature="() -> str",
            is_method=True,
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="property",
            decorator_type=DecoratorType.DESCRIPTOR,
            module="test",
            line_number=10,
            has_wraps=False,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        metadata_loss_risks = [r for r in result.risks if r.risk_type == RiskType.METADATA_LOSS]
        assert len(metadata_loss_risks) == 0
        
        descriptor_risks = [r for r in result.risks if r.risk_type == RiskType.DESCRIPTOR_BINDING]
        assert len(descriptor_risks) == 1

    def test_strict_mode(self) -> None:
        """Test strict mode configuration."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="timer",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=False,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        strict_config = AnalysisConfig(strict_mode=True)
        analyzer = DecoratorAnalyzer(strict_config)
        result = analyzer.analyze([decorated_func], [])
        
        metadata_loss_risks = [r for r in result.risks if r.risk_type == RiskType.METADATA_LOSS]
        assert len(metadata_loss_risks) == 1
        assert metadata_loss_risks[0].level == RiskLevel.HIGH

    def test_skip_signature_check(self) -> None:
        """Test skipping signature fidelity check."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="(a: int, b: str) -> bool",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="decorator",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=True,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        config = AnalysisConfig(check_signature_fidelity=False)
        analyzer = DecoratorAnalyzer(config)
        result = analyzer.analyze([decorated_func], [])
        
        assert len(result.signature_checks) == 0

    def test_skip_metadata_check(self) -> None:
        """Test skipping metadata fidelity check."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="decorator",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=True,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        config = AnalysisConfig(check_metadata_fidelity=False)
        analyzer = DecoratorAnalyzer(config)
        result = analyzer.analyze([decorated_func], [])
        
        assert len(result.metadata_checks) == 0

    def test_analyze_call_events(self) -> None:
        """Test analyzing call events."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="timer",
            decorator_type=DecoratorType.SIMPLE,
            module="test",
            line_number=10,
            has_wraps=True,
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        from datetime import datetime
        
        events = [
            CallEvent(
                id="event1",
                function_id="func1",
                timestamp=datetime.now(),
                caller="main",
                args=(),
                kwargs={},
                return_value=None,
                exception=None,
                decorator_stack=["timer"],
                duration_ms=100.0,
            )
        ]
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], events)
        
        assert len(result.call_events) == 1

    def test_analyze_decorator_with_args(self) -> None:
        """Test analyzing decorator with arguments."""
        func_metadata = FunctionMetadata(
            name="test_func",
            module="test",
            signature="() -> None",
        )
        
        decorator = DecoratorInfo(
            id="dec1",
            name="retry",
            decorator_type=DecoratorType.WITH_ARGS,
            module="test",
            line_number=10,
            has_wraps=True,
            parameters={"max_attempts": "3", "delay": "1.0"},
        )
        
        decorated_func = DecoratedFunction(
            id="func1",
            function=func_metadata,
            decorators=[decorator],
            decorator_order=["dec1"],
        )
        
        analyzer = DecoratorAnalyzer()
        result = analyzer.analyze([decorated_func], [])
        
        assert len(result.decorated_functions) == 1
        assert result.decorated_functions[0].decorators[0].parameters["max_attempts"] == "3"

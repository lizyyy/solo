"""Core decorator analysis engine."""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from decorator_analyzer.models import (
    AnalysisResult,
    CallEvent,
    DecoratedFunction,
    DecoratorInfo,
    DecoratorType,
    FunctionMetadata,
    MetadataCheck,
    Risk,
    RiskLevel,
    RiskType,
    SignatureCheck,
)
from decorator_analyzer.parser import JsonlParser, PyParser, YamlParser


@dataclass
class AnalysisConfig:
    """Configuration for the decorator analyzer."""
    strict_mode: bool = False
    include_warnings: bool = True
    analyze_call_chain: bool = True
    check_signature_fidelity: bool = True
    check_metadata_fidelity: bool = True
    detect_exception_swallow: bool = True
    detect_order_dependency: bool = True
    detect_async_mismatch: bool = True


class DecoratorAnalyzer:
    """Core decorator analysis engine."""

    def __init__(self, config: Optional[AnalysisConfig] = None):
        self.config = config or AnalysisConfig()

    def analyze_from_files(
        self,
        yaml_path: Path,
        jsonl_path: Optional[Path] = None,
        snippets_dir: Optional[Path] = None,
        description: Optional[str] = None,
    ) -> AnalysisResult:
        """Analyze decorators from YAML, JSONL, and Python snippet files."""
        decorated_functions: list[DecoratedFunction] = []
        
        if yaml_path.exists():
            yaml_parser = YamlParser(yaml_path)
            yaml_funcs = yaml_parser.parse()
            decorated_functions.extend(yaml_funcs)
        
        if snippets_dir and snippets_dir.exists():
            py_parser = PyParser(snippets_dir)
            py_funcs = py_parser.parse()
            decorated_functions.extend(py_funcs)
        
        call_events: list[CallEvent] = []
        if jsonl_path and jsonl_path.exists():
            jsonl_parser = JsonlParser(jsonl_path)
            call_events = jsonl_parser.parse()
        
        return self.analyze(decorated_functions, call_events, description)

    def analyze(
        self,
        decorated_functions: list[DecoratedFunction],
        call_events: list[CallEvent],
        description: Optional[str] = None,
    ) -> AnalysisResult:
        """Analyze decorated functions and call events."""
        result_id = self._generate_id(f"{datetime.now().isoformat()}:{len(decorated_functions)}")
        
        risks: list[Risk] = []
        signature_checks: list[SignatureCheck] = []
        metadata_checks: list[MetadataCheck] = []
        
        for func in decorated_functions:
            func_risks = self._analyze_function_risks(func)
            risks.extend(func_risks)
            
            if self.config.check_signature_fidelity:
                sig_check = self._check_signature_fidelity(func)
                if sig_check:
                    signature_checks.append(sig_check)
            
            if self.config.check_metadata_fidelity:
                meta_check = self._check_metadata_fidelity(func)
                if meta_check:
                    metadata_checks.append(meta_check)
        
        if self.config.analyze_call_chain:
            event_risks = self._analyze_call_events(call_events, decorated_functions)
            risks.extend(event_risks)
        
        return AnalysisResult(
            id=result_id,
            timestamp=datetime.now(),
            decorated_functions=decorated_functions,
            call_events=call_events,
            risks=risks,
            signature_checks=signature_checks,
            metadata_checks=metadata_checks,
        )

    def _analyze_function_risks(self, func: DecoratedFunction) -> list[Risk]:
        """Analyze risks for a single decorated function."""
        risks: list[Risk] = []
        
        if len(func.decorators) > 1:
            risk = self._create_risk(
                func_id=func.id,
                risk_type=RiskType.ORDER_DEPENDENCY,
                level=RiskLevel.MEDIUM,
                description=f"Function '{func.function.name}' has {len(func.decorators)} decorators. "
                           f"Execution order may affect behavior.",
                location=f"{func.function.module}:{func.function.name}",
                suggestion="Review decorator order and ensure no unintended side effects. "
                          f"Current order (inner to outer): {', '.join(d.name for d in func.decorators)}",
            )
            risks.append(risk)
        
        for dec in func.decorators:
            dec_risks = self._analyze_decorator_risks(func, dec)
            risks.extend(dec_risks)
        
        return risks

    def _analyze_decorator_risks(
        self, func: DecoratedFunction, dec: DecoratorInfo
    ) -> list[Risk]:
        """Analyze risks for a specific decorator."""
        risks: list[Risk] = []
        
        if not dec.has_wraps and dec.decorator_type not in [
            DecoratorType.FUNCTOOLS_WRAPS,
            DecoratorType.DESCRIPTOR,
        ]:
            risk = self._create_risk(
                func_id=func.id,
                decorator_id=dec.id,
                risk_type=RiskType.METADATA_LOSS,
                level=RiskLevel.HIGH if self.config.strict_mode else RiskLevel.MEDIUM,
                description=f"Decorator '{dec.name}' does not use functools.wraps. "
                           f"Function metadata (name, docstring) may be lost.",
                location=f"{dec.module}:{dec.line_number}",
                suggestion=f"Add @functools.wraps(func) inside the '{dec.name}' decorator "
                          f"to preserve function metadata.",
            )
            risks.append(risk)
        
        if dec.decorator_type == DecoratorType.ASYNC and not func.function.is_async:
            risk = self._create_risk(
                func_id=func.id,
                decorator_id=dec.id,
                risk_type=RiskType.ASYNC_MISMATCH,
                level=RiskLevel.HIGH,
                description=f"Async decorator '{dec.name}' applied to sync function '{func.function.name}'.",
                location=f"{dec.module}:{dec.line_number}",
                suggestion=f"Either make '{func.function.name}' async, or use a sync-compatible version "
                          f"of the '{dec.name}' decorator.",
            )
            risks.append(risk)
        
        if dec.decorator_type == DecoratorType.DESCRIPTOR:
            if func.function.is_method:
                risk = self._create_risk(
                    func_id=func.id,
                    decorator_id=dec.id,
                    risk_type=RiskType.DESCRIPTOR_BINDING,
                    level=RiskLevel.MEDIUM,
                    description=f"Descriptor decorator '{dec.name}' on method. "
                               f"Ensure proper binding behavior.",
                    location=f"{dec.module}:{dec.line_number}",
                    suggestion=f"Verify that '{dec.name}' correctly implements the descriptor protocol "
                              f"for method binding.",
                )
                risks.append(risk)
        
        if dec.source_code:
            swallow_risk = self._detect_exception_swallow(dec.source_code, func, dec)
            if swallow_risk:
                risks.append(swallow_risk)
        
        return risks

    def _detect_exception_swallow(
        self, source_code: str, func: DecoratedFunction, dec: DecoratorInfo
    ) -> Optional[Risk]:
        """Detect potential exception swallowing in decorator source code."""
        if not self.config.detect_exception_swallow:
            return None
        
        except_patterns = [
            r"except\s*:",
            r"except\s+Exception\s*:",
            r"except\s*\(\s*Exception\s*\)\s*:",
        ]
        
        for pattern in except_patterns:
            matches = list(re.finditer(pattern, source_code, re.MULTILINE))
            for match in matches:
                match_start = match.start()
                after_match = source_code[match_start:match_start + 200]
                
                if "raise" not in after_match.lower() or "reraise" not in after_match.lower():
                    bare_except = "except:" in match.group(0) or "except Exception" in match.group(0)
                    
                    return self._create_risk(
                        func_id=func.id,
                        decorator_id=dec.id,
                        risk_type=RiskType.EXCEPTION_SWALLOW,
                        level=RiskLevel.CRITICAL if bare_except else RiskLevel.HIGH,
                        description=f"Potential exception swallowing detected in decorator '{dec.name}'. "
                                   f"Broad exception handling without re-raising may hide errors.",
                        location=f"{dec.module}:{dec.line_number}",
                        suggestion=f"Review exception handling in '{dec.name}'. "
                                  f"Consider catching specific exceptions or re-raising after logging.",
                    )
        
        return None

    def _check_signature_fidelity(self, func: DecoratedFunction) -> Optional[SignatureCheck]:
        """Check if the decorated function preserves the original signature."""
        original_sig = func.function.signature
        
        inferred_sig = self._infer_decorated_signature(func)
        
        differences: list[str] = []
        matches = original_sig == inferred_sig
        
        if not matches:
            differences.append(f"Original: {original_sig}")
            differences.append(f"Decorated (inferred): {inferred_sig}")
            
            for dec in func.decorators:
                if dec.decorator_type == DecoratorType.WITH_ARGS:
                    differences.append(f"Decorator '{dec.name}' takes args, may alter signature")
        
        return SignatureCheck(
            function_id=func.id,
            original_signature=original_sig,
            decorated_signature=inferred_sig,
            matches=matches,
            differences=differences,
        )

    def _infer_decorated_signature(self, func: DecoratedFunction) -> str:
        """Infer the decorated function's signature based on decorators."""
        base_sig = func.function.signature
        
        for dec in func.decorators:
            if dec.parameters:
                if "arg_0" in dec.parameters and "wrapper" not in dec.parameters.get("arg_0", ""):
                    if "*args" not in base_sig and "**kwargs" not in base_sig:
                        return "(*args, **kwargs)"
        
        return base_sig

    def _check_metadata_fidelity(self, func: DecoratedFunction) -> Optional[MetadataCheck]:
        """Check if decorators preserve function metadata."""
        original_name = func.function.name
        original_doc = func.function.docstring
        
        uses_wraps = any(dec.has_wraps for dec in func.decorators)
        all_have_wraps = all(dec.has_wraps or dec.decorator_type == DecoratorType.DESCRIPTOR for dec in func.decorators)
        
        return MetadataCheck(
            function_id=func.id,
            original_name=original_name,
            decorated_name=original_name if uses_wraps else f"<decorated {original_name}>",
            original_docstring=original_doc,
            decorated_docstring=original_doc if uses_wraps else None,
            name_preserved=all_have_wraps,
            docstring_preserved=all_have_wraps and original_doc is not None,
            uses_wraps=uses_wraps,
        )

    def _analyze_call_events(
        self, events: list[CallEvent], functions: list[DecoratedFunction]
    ) -> list[Risk]:
        """Analyze call events for patterns and risks."""
        risks: list[Risk] = []
        func_map = {f.id: f for f in functions}
        
        for event in events:
            if event.exception:
                func = func_map.get(event.function_id)
                if func:
                    for dec in func.decorators:
                        if dec.source_code and "except" in dec.source_code.lower():
                            if event.exception not in ["None", "null"]:
                                pass
        
        event_count: dict[str, int] = {}
        for event in events:
            event_count[event.function_id] = event_count.get(event.function_id, 0) + 1
        
        for func_id, count in event_count.items():
            if count > 100:
                func = func_map.get(func_id)
                func_name = func.function.name if func else func_id
                risks.append(self._create_risk(
                    func_id=func_id,
                    risk_type=RiskType.RETURN_VALUE_ALTERED,
                    level=RiskLevel.LOW,
                    description=f"High call volume ({count} calls) to '{func_name}'. "
                               f"Decorator overhead may be significant.",
                    location=f"Call events for {func_name}",
                    suggestion=f"Consider caching or optimizing decorators for frequently called functions.",
                ))
        
        return risks

    def _create_risk(
        self,
        func_id: str,
        risk_type: RiskType,
        level: RiskLevel,
        description: str,
        location: str,
        suggestion: str,
        decorator_id: Optional[str] = None,
    ) -> Risk:
        """Create a Risk object with generated ID."""
        risk_id = self._generate_id(
            f"{func_id}:{risk_type.value}:{location}:{datetime.now().isoformat()}"
        )
        
        return Risk(
            id=risk_id,
            function_id=func_id,
            decorator_id=decorator_id,
            risk_type=risk_type,
            level=level,
            description=description,
            location=location,
            suggestion=suggestion,
        )

    def _generate_id(self, identifier: str) -> str:
        """Generate a unique ID from an identifier string."""
        return hashlib.sha256(identifier.encode()).hexdigest()[:16]

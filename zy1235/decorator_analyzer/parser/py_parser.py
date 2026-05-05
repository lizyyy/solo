"""Parser for Python code snippets to extract decorator information."""

from __future__ import annotations

import ast
import hashlib
import inspect
from pathlib import Path
from typing import Any, Optional, Union

from decorator_analyzer.models import DecoratedFunction, DecoratorInfo, DecoratorType, FunctionMetadata


class PyParseError(Exception):
    """Exception raised when Python code parsing fails."""
    pass


class PyParser:
    """Parser for Python code snippets to extract decorator information."""

    def __init__(self, snippets_dir: Path):
        self.snippets_dir = snippets_dir

    def parse(self) -> list[DecoratedFunction]:
        """Parse all Python files in the snippets directory."""
        self._validate_directory()
        py_files = self._find_python_files()
        
        results: list[DecoratedFunction] = []
        for py_file in py_files:
            try:
                functions = self._parse_file(py_file)
                results.extend(functions)
            except PyParseError:
                raise
            except Exception as e:
                raise PyParseError(f"Error parsing {py_file}: {e}") from e
        
        return results

    def _validate_directory(self) -> None:
        """Validate that the snippets directory exists."""
        if not self.snippets_dir.exists():
            raise PyParseError(f"Snippets directory not found: {self.snippets_dir}")
        if not self.snippets_dir.is_dir():
            raise PyParseError(f"Path is not a directory: {self.snippets_dir}")

    def _find_python_files(self) -> list[Path]:
        """Find all Python files in the snippets directory."""
        return list(self.snippets_dir.glob("*.py"))

    def _parse_file(self, file_path: Path) -> list[DecoratedFunction]:
        """Parse a single Python file and return decorated functions."""
        source_code = self._read_file(file_path)
        tree = self._parse_ast(source_code, file_path)
        
        return self._extract_decorated_functions(tree, file_path, source_code)

    def _read_file(self, file_path: Path) -> str:
        """Read the source code from a file."""
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError as e:
            raise PyParseError(f"File encoding error in {file_path}: {e}") from e
        except IOError as e:
            raise PyParseError(f"File read error in {file_path}: {e}") from e

    def _parse_ast(self, source_code: str, file_path: Path) -> ast.Module:
        """Parse source code into an AST."""
        try:
            return ast.parse(source_code)
        except SyntaxError as e:
            raise PyParseError(
                f"Syntax error in {file_path} at line {e.lineno}: {e.msg}"
            ) from e

    def _extract_decorated_functions(
        self, tree: ast.Module, file_path: Path, source_code: str
    ) -> list[DecoratedFunction]:
        """Extract all decorated functions from the AST.
        
        Only extracts module-level functions and class methods, not nested functions.
        """
        results: list[DecoratedFunction] = []
        module_name = file_path.stem
        
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.decorator_list:
                    decorated_func = self._extract_decorated_function(
                        node, module_name, source_code, file_path
                    )
                    results.append(decorated_func)
            
            elif isinstance(node, ast.ClassDef):
                for class_node in node.body:
                    if isinstance(class_node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        if class_node.decorator_list:
                            decorated_func = self._extract_decorated_function(
                                class_node, 
                                f"{module_name}.{node.name}", 
                                source_code, 
                                file_path,
                                is_method=True,
                                class_name=node.name
                            )
                            results.append(decorated_func)
        
        return results

    def _extract_decorated_function(
        self, 
        node: ast.FunctionDef | ast.AsyncFunctionDef, 
        module_name: str,
        source_code: str,
        file_path: Path,
        is_method: bool = False,
        class_name: str | None = None,
    ) -> DecoratedFunction:
        """Extract a decorated function from an AST node."""
        func_name = node.name
        if class_name:
            func_name = f"{class_name}.{func_name}"
        
        signature = self._extract_signature(node)
        
        func_metadata = FunctionMetadata(
            name=func_name,
            module=module_name,
            signature=signature,
            docstring=ast.get_docstring(node),
            is_async=isinstance(node, ast.AsyncFunctionDef),
            is_method=is_method,
            annotations=self._extract_annotations(node),
        )
        
        decorators: list[DecoratorInfo] = []
        decorator_order: list[str] = []
        
        for dec_node in reversed(node.decorator_list):
            decorator = self._extract_decorator(
                dec_node, module_name, source_code, file_path, node.lineno
            )
            decorators.append(decorator)
            decorator_order.append(decorator.id)
        
        func_id = self._generate_id(f"{module_name}:{func_name}")
        
        return DecoratedFunction(
            id=func_id,
            function=func_metadata,
            decorators=decorators,
            decorator_order=decorator_order,
        )

    def _extract_signature(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
        """Extract function signature as a string."""
        params: list[str] = []
        
        for arg in node.args.args:
            param = arg.arg
            if arg.annotation:
                param += f": {self._ast_to_str(arg.annotation)}"
            params.append(param)
        
        if node.args.vararg:
            params.append(f"*{node.args.vararg.arg}")
        
        if node.args.kwarg:
            params.append(f"**{node.args.kwarg.arg}")
        
        return f"({', '.join(params)})"

    def _extract_annotations(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> dict[str, Any]:
        """Extract function annotations."""
        annotations: dict[str, Any] = {}
        
        for arg in node.args.args:
            if arg.annotation:
                annotations[arg.arg] = self._ast_to_str(arg.annotation)
        
        if node.returns:
            annotations["return"] = self._ast_to_str(node.returns)
        
        return annotations

    def _extract_decorator(
        self, 
        node: ast.expr, 
        module_name: str,
        source_code: str,
        file_path: Path,
        func_lineno: int,
    ) -> DecoratorInfo:
        """Extract decorator information from an AST node."""
        dec_type = DecoratorType.SIMPLE
        has_wraps = False
        parameters: dict[str, Any] = {}
        dec_name = ""
        dec_lineno = node.lineno if hasattr(node, "lineno") else func_lineno
        
        if isinstance(node, ast.Call):
            dec_type = DecoratorType.WITH_ARGS
            if isinstance(node.func, ast.Name):
                dec_name = node.func.id
            elif isinstance(node.func, ast.Attribute):
                dec_name = self._ast_to_str(node.func)
            
            parameters = self._extract_decorator_args(node)
            
            if dec_name in ["wraps", "functools.wraps"]:
                dec_type = DecoratorType.FUNCTOOLS_WRAPS
                has_wraps = True
        
        elif isinstance(node, ast.Name):
            dec_name = node.id
            if dec_name in ["property", "staticmethod", "classmethod"]:
                dec_type = DecoratorType.DESCRIPTOR
        
        elif isinstance(node, ast.Attribute):
            dec_name = self._ast_to_str(node)
            if "wraps" in dec_name:
                dec_type = DecoratorType.FUNCTOOLS_WRAPS
                has_wraps = True
        
        dec_source = self._extract_decorator_source(node, source_code)
        
        dec_id = self._generate_id(f"{module_name}:{dec_name}:{dec_lineno}")
        
        return DecoratorInfo(
            id=dec_id,
            name=dec_name,
            decorator_type=dec_type,
            module=module_name,
            line_number=dec_lineno,
            has_wraps=has_wraps,
            parameters=parameters,
            source_code=dec_source,
        )

    def _extract_decorator_args(self, call_node: ast.Call) -> dict[str, Any]:
        """Extract arguments from a decorator call."""
        args: dict[str, Any] = {}
        
        for idx, arg in enumerate(call_node.args):
            args[f"arg_{idx}"] = self._ast_to_str(arg)
        
        for keyword in call_node.keywords:
            if keyword.arg:
                args[keyword.arg] = self._ast_to_str(keyword.value)
        
        return args

    def _extract_decorator_source(self, node: ast.expr, source_code: str) -> str | None:
        """Extract the source code of a decorator."""
        try:
            lines = source_code.splitlines()
            if hasattr(node, "lineno") and hasattr(node, "end_lineno"):
                start = node.lineno - 1
                end = node.end_lineno
                return "\n".join(lines[start:end]).strip()
        except Exception:
            pass
        
        return None

    def _ast_to_str(self, node: ast.AST) -> str:
        """Convert an AST node to a string representation."""
        try:
            return ast.unparse(node)
        except AttributeError:
            try:
                import astunparse
                return astunparse.unparse(node).strip()
            except ImportError:
                return self._simple_ast_to_str(node)

    def _simple_ast_to_str(self, node: ast.AST) -> str:
        """Simple AST to string conversion for older Python versions."""
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            return f"{self._simple_ast_to_str(node.value)}.{node.attr}"
        elif isinstance(node, ast.Constant):
            return repr(node.value)
        elif isinstance(node, ast.Str):
            return repr(node.s)
        elif isinstance(node, ast.Num):
            return repr(node.n)
        else:
            return f"<{type(node).__name__}>"

    def _generate_id(self, identifier: str) -> str:
        """Generate a unique ID from an identifier string."""
        return hashlib.sha256(identifier.encode()).hexdigest()[:16]

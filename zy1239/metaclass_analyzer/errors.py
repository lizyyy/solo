"""Custom exceptions and error handling for metaclass analyzer."""

from typing import Any, Dict, List, Optional


class MetaclassAnalyzerError(Exception):
    """Base exception for all metaclass analyzer errors."""

    def __init__(
        self,
        message: str,
        error_code: str = "UNKNOWN_ERROR",
        details: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_code": self.error_code,
            "message": self.message,
            "details": self.details,
        }


class FileFormatError(MetaclassAnalyzerError):
    """Raised when an input file has invalid format."""

    def __init__(
        self,
        file_path: str,
        message: str,
        line_number: Optional[int] = None,
        column: Optional[int] = None,
        suggestions: Optional[List[str]] = None,
    ):
        details = {
            "file_path": file_path,
            "line_number": line_number,
            "column": column,
            "suggestions": suggestions or [],
        }
        super().__init__(
            message=f"Invalid format in {file_path}: {message}",
            error_code="INVALID_FORMAT",
            details=details,
        )
        self.file_path = file_path
        self.line_number = line_number
        self.column = column
        self.suggestions = suggestions or []


class YamlFormatError(FileFormatError):
    """Raised when YAML file has invalid format."""

    def __init__(
        self,
        file_path: str,
        message: str,
        line_number: Optional[int] = None,
        original_error: Optional[Exception] = None,
    ):
        suggestions = [
            "Check YAML syntax (indentation, colons, etc.)",
            "Use a YAML validator to check the file",
            "Ensure all required fields are present",
        ]
        if original_error:
            message = f"{message}: {str(original_error)}"
        super().__init__(
            file_path=file_path,
            message=message,
            line_number=line_number,
            suggestions=suggestions,
        )


class JsonlFormatError(FileFormatError):
    """Raised when JSONL file has invalid format."""

    def __init__(
        self,
        file_path: str,
        message: str,
        line_number: Optional[int] = None,
        original_error: Optional[Exception] = None,
    ):
        suggestions = [
            "Each line must be a valid JSON object",
            "Check for missing commas or quotes",
            "Ensure consistent JSON structure across lines",
        ]
        if original_error:
            message = f"{message}: {str(original_error)}"
        super().__init__(
            file_path=file_path,
            message=message,
            line_number=line_number,
            suggestions=suggestions,
        )


class PythonSyntaxError(FileFormatError):
    """Raised when Python snippet has syntax errors."""

    def __init__(
        self,
        file_path: str,
        message: str,
        line_number: Optional[int] = None,
        column: Optional[int] = None,
        original_error: Optional[Exception] = None,
    ):
        suggestions = [
            "Check Python syntax",
            "Ensure all parentheses, brackets, and braces are balanced",
            "Verify indentation (use 4 spaces)",
        ]
        if original_error:
            message = f"{message}: {str(original_error)}"
        super().__init__(
            file_path=file_path,
            message=message,
            line_number=line_number,
            column=column,
            suggestions=suggestions,
        )


class MetaclassConflictError(MetaclassAnalyzerError):
    """Raised when a metaclass conflict is detected."""

    def __init__(
        self,
        class_name: str,
        bases: List[str],
        conflict_details: str,
        resolution_steps: Optional[List[str]] = None,
    ):
        details = {
            "class_name": class_name,
            "bases": bases,
            "resolution_steps": resolution_steps or [],
        }
        super().__init__(
            message=f"Metaclass conflict in class '{class_name}': {conflict_details}",
            error_code="METACLASS_CONFLICT",
            details=details,
        )
        self.class_name = class_name
        self.bases = bases
        self.conflict_details = conflict_details
        self.resolution_steps = resolution_steps or []


class DatabaseError(MetaclassAnalyzerError):
    """Raised when database operations fail."""

    def __init__(
        self,
        operation: str,
        message: str,
        original_error: Optional[Exception] = None,
    ):
        details = {
            "operation": operation,
            "original_error": str(original_error) if original_error else None,
        }
        if original_error:
            message = f"{message}: {str(original_error)}"
        super().__init__(
            message=f"Database error during {operation}: {message}",
            error_code="DATABASE_ERROR",
            details=details,
        )


class MissingFieldError(MetaclassAnalyzerError):
    """Raised when a required field is missing from input data."""

    def __init__(
        self,
        field_name: str,
        context: str,
        expected_type: Optional[str] = None,
    ):
        details = {
            "field_name": field_name,
            "context": context,
            "expected_type": expected_type,
        }
        type_msg = f" (expected type: {expected_type})" if expected_type else ""
        super().__init__(
            message=f"Missing required field '{field_name}' in {context}{type_msg}",
            error_code="MISSING_FIELD",
            details=details,
        )


def format_error(error: MetaclassAnalyzerError) -> str:
    """Format an error for display to the user."""
    lines = [f"Error: {error.message}"]

    if isinstance(error, FileFormatError):
        if error.line_number:
            lines.append(f"  Line: {error.line_number}")
            if error.column:
                lines.append(f"  Column: {error.column}")
        if error.suggestions:
            lines.append("  Suggestions:")
            for suggestion in error.suggestions:
                lines.append(f"    - {suggestion}")

    if isinstance(error, MetaclassConflictError):
        if error.resolution_steps:
            lines.append("  Resolution steps:")
            for step in error.resolution_steps:
                lines.append(f"    - {step}")

    return "\n".join(lines)

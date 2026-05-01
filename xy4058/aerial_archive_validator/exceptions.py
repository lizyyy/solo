from typing import Optional, List


class AerialValidatorError(Exception):
    def __init__(self, message: str, error_code: str = "UNKNOWN_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.error_code = error_code


class ConfigurationError(AerialValidatorError):
    def __init__(self, message: str, field: Optional[str] = None) -> None:
        super().__init__(message, "CONFIG_ERROR")
        self.field = field


class MetadataExtractionError(AerialValidatorError):
    def __init__(self, message: str, file_path: Optional[str] = None) -> None:
        super().__init__(message, "METADATA_ERROR")
        self.file_path = file_path


class LogParsingError(AerialValidatorError):
    def __init__(self, message: str, log_file: Optional[str] = None) -> None:
        super().__init__(message, "LOG_PARSE_ERROR")
        self.log_file = log_file


class ValidationError(AerialValidatorError):
    def __init__(
        self, message: str, rule_name: str, file_path: Optional[str] = None
    ) -> None:
        super().__init__(message, "VALIDATION_ERROR")
        self.rule_name = rule_name
        self.file_path = file_path


class PackingError(AerialValidatorError):
    def __init__(self, message: str, source_file: Optional[str] = None) -> None:
        super().__init__(message, "PACKING_ERROR")
        self.source_file = source_file


class ReportGenerationError(AerialValidatorError):
    def __init__(self, message: str, format_type: Optional[str] = None) -> None:
        super().__init__(message, "REPORT_ERROR")
        self.format_type = format_type


class FileAccessError(AerialValidatorError):
    def __init__(self, message: str, file_path: Optional[str] = None) -> None:
        super().__init__(message, "FILE_ACCESS_ERROR")
        self.file_path = file_path


class InvalidProjectError(AerialValidatorError):
    def __init__(self, message: str, project_path: Optional[str] = None) -> None:
        super().__init__(message, "INVALID_PROJECT")
        self.project_path = project_path

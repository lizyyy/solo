class ReportExporterError(Exception):
    """报表导出工具基础异常类"""
    
    def __init__(self, message: str, suggestions: list = None):
        super().__init__(message)
        self.message = message
        self.suggestions = suggestions or []
    
    def __str__(self):
        return self.message


class DataValidationError(ReportExporterError):
    """数据验证错误"""
    
    def __init__(self, message: str, field: str = None, value=None, suggestions: list = None):
        super().__init__(message, suggestions)
        self.field = field
        self.value = value


class FileFormatError(ReportExporterError):
    """文件格式错误"""
    
    def __init__(self, file_path: str, expected_format: str, actual_format: str = None, suggestions: list = None):
        message = f"文件格式错误: {file_path}"
        if expected_format:
            message += f"，期望格式: {expected_format}"
        if actual_format:
            message += f"，实际格式: {actual_format}"
        super().__init__(message, suggestions)
        self.file_path = file_path
        self.expected_format = expected_format
        self.actual_format = actual_format


class MissingColumnError(DataValidationError):
    """缺少必需列错误"""
    
    def __init__(self, column_name: str, file_path: str = None, suggestions: list = None):
        message = f"缺少必需列: {column_name}"
        if file_path:
            message = f"文件 {file_path} 缺少必需列: {column_name}"
        super().__init__(message, field=column_name, suggestions=suggestions)
        self.column_name = column_name
        self.file_path = file_path


class InvalidValueError(DataValidationError):
    """无效值错误"""
    
    def __init__(self, field: str, value, row_number: int = None, suggestions: list = None):
        message = f"字段 '{field}' 包含无效值: {value}"
        if row_number is not None:
            message = f"第 {row_number} 行字段 '{field}' 包含无效值: {value}"
        super().__init__(message, field=field, value=value, suggestions=suggestions)
        self.row_number = row_number


class TemplateError(ReportExporterError):
    """模板错误"""
    
    def __init__(self, message: str, template_path: str = None, suggestions: list = None):
        if template_path:
            message = f"模板 {template_path} 错误: {message}"
        super().__init__(message, suggestions)
        self.template_path = template_path


class MissingTemplateVariableError(TemplateError):
    """模板变量缺失错误"""
    
    def __init__(self, variable_name: str, template_path: str = None, suggestions: list = None):
        message = f"模板缺少变量: {variable_name}"
        super().__init__(message, template_path, suggestions)
        self.variable_name = variable_name


class ReportGenerationError(ReportExporterError):
    """报告生成错误"""
    
    def __init__(self, message: str, output_format: str = None, suggestions: list = None):
        if output_format:
            message = f"{output_format.upper()} 报告生成失败: {message}"
        super().__init__(message, suggestions)
        self.output_format = output_format


class ReportVerificationError(ReportExporterError):
    """报告验证错误"""
    
    def __init__(self, message: str, report_type: str = None, suggestions: list = None):
        if report_type:
            message = f"{report_type.upper()} 报告验证失败: {message}"
        super().__init__(message, suggestions)
        self.report_type = report_type


class ConsistencyError(ReportExporterError):
    """一致性错误"""
    
    def __init__(self, message: str, differences: list = None, suggestions: list = None):
        super().__init__(message, suggestions)
        self.differences = differences or []

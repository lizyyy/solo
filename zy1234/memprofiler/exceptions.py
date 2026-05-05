"""
自定义异常模块
定义工具专用的异常类
"""


class MemProfilerError(Exception):
    """工具基础异常类"""
    pass


class ConfigurationError(MemProfilerError):
    """配置错误"""
    pass


class DataFormatError(MemProfilerError):
    """数据格式错误"""
    
    def __init__(self, message: str, file_path: str = None, 
                 line_number: int = None, suggestion: str = None):
        super().__init__(message)
        self.file_path = file_path
        self.line_number = line_number
        self.suggestion = suggestion
    
    def __str__(self):
        parts = [super().__str__()]
        if self.file_path:
            parts.append(f"文件: {self.file_path}")
        if self.line_number:
            parts.append(f"行号: {self.line_number}")
        if self.suggestion:
            parts.append(f"建议: {self.suggestion}")
        return " | ".join(parts)


class InvalidSnapshotError(DataFormatError):
    """无效的快照文件"""
    pass


class InvalidJsonError(DataFormatError):
    """无效的JSON文件"""
    pass


class InvalidGCLogError(DataFormatError):
    """无效的GC日志"""
    pass


class InvalidScriptError(DataFormatError):
    """无效的脚本文件"""
    pass


class AnalysisError(MemProfilerError):
    """分析过程错误"""
    pass


class DatabaseError(MemProfilerError):
    """数据库操作错误"""
    pass


class ExportError(MemProfilerError):
    """导出错误"""
    pass


class FileNotFoundError(MemProfilerError):
    """文件未找到"""
    
    def __init__(self, file_path: str, file_type: str = None):
        self.file_path = file_path
        self.file_type = file_type
        message = f"文件不存在: {file_path}"
        if file_type:
            message = f"{file_type}文件不存在: {file_path}"
        super().__init__(message)


class DirectoryNotFoundError(MemProfilerError):
    """目录未找到"""
    
    def __init__(self, dir_path: str, dir_type: str = None):
        self.dir_path = dir_path
        self.dir_type = dir_type
        message = f"目录不存在: {dir_path}"
        if dir_type:
            message = f"{dir_type}目录不存在: {dir_path}"
        super().__init__(message)


class NoDataError(MemProfilerError):
    """没有可用数据"""
    
    def __init__(self, data_type: str = None):
        self.data_type = data_type
        message = "没有找到可用的分析数据"
        if data_type:
            message = f"没有找到可用的{data_type}数据"
        super().__init__(message)


class NoAnalysisError(MemProfilerError):
    """没有分析记录"""
    
    def __init__(self, analysis_id: str = None):
        self.analysis_id = analysis_id
        if analysis_id:
            message = f"找不到指定的分析记录: {analysis_id}"
        else:
            message = "没有找到任何分析记录，请先运行 analyze 命令"
        super().__init__(message)

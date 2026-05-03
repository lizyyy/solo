"""
自定义异常类
"""

class ResumeMatcherError(Exception):
    """基础异常类"""
    pass


class FileParseError(ResumeMatcherError):
    """文件解析错误"""
    pass


class EmptyContentError(ResumeMatcherError):
    """空内容错误"""
    pass


class MissingFieldError(ResumeMatcherError):
    """字段缺失错误"""
    pass


class InvalidFormatError(ResumeMatcherError):
    """无效格式错误"""
    pass


class ModelError(ResumeMatcherError):
    """模型相关错误"""
    pass


class ReportError(ResumeMatcherError):
    """报告生成错误"""
    pass

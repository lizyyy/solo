"""用户友好的错误提示系统 - 让错误说人话"""
from typing import Optional, Dict, Any
from dataclasses import dataclass
from datetime import datetime


ERROR_TRANSLATIONS: Dict[str, Dict[str, str]] = {
    "FileNotFoundError": {
        "pattern": "No such file or directory",
        "user_message": "找不到这个文件，请检查：\n1. 文件路径是不是敲错了？\n2. 文件是不是被移动或删除了？\n3. 路径里有空格的话记得用引号括起来",
        "suggestion": "可以试试把文件拖到命令行窗口，自动生成正确路径"
    },
    "PermissionError": {
        "pattern": "Permission denied",
        "user_message": "没有权限访问这个文件/文件夹\n可能是：\n1. 文件正在被别的程序占用（比如Excel正打开着）\n2. 当前用户没有读写权限\n3. 文件被设置成只读了",
        "suggestion": "先关掉可能占用文件的程序，或者换个文件夹试试"
    },
    "UnicodeDecodeError": {
        "pattern": "codec can't decode",
        "user_message": "文件编码不对，读不出来\nCSV文件最常见的编码是UTF-8或GBK",
        "suggestion": "用记事本打开文件，另存为时选择UTF-8编码"
    },
    "pandas.errors.EmptyDataError": {
        "pattern": "No columns to parse from file",
        "user_message": "这个CSV文件是空的，或者表头行有问题",
        "suggestion": "用Excel打开检查一下，第一行应该是列名，下面要有数据"
    },
    "pandas.errors.ParserError": {
        "pattern": "Expected .* fields in line",
        "user_message": "CSV格式有问题，某一行的列数不对",
        "suggestion": "检查文件里是不是有多余的逗号，或者某行内容里的逗号没加引号"
    },
    "IsADirectoryError": {
        "pattern": "Is a directory",
        "user_message": "你选的是文件夹不是文件",
        "suggestion": "请指定具体的CSV文件，而不是它所在的文件夹"
    },
    "KeyError": {
        "pattern": "",
        "user_message": "CSV里缺少需要的列",
        "suggestion": "检查一下文件是否包含：工单号、文件路径、处理时间这些必要的列",
        "match_on_type_only": True
    },
    "ValueError": {
        "pattern": "invalid literal for int",
        "user_message": "有个格子里的内容应该是数字，但填的是别的",
        "suggestion": "检查金额、数量这类列是不是混入了文字或特殊符号"
    },
}


@dataclass
class UserFriendlyError(Exception):
    """封装用户友好的错误信息"""
    original_error: Exception
    user_message: str
    suggestion: str
    error_type: str
    timestamp: datetime
    context: Dict[str, Any]
    technical_details: str

    def __str__(self) -> str:
        return f"❌ {self.user_message}\n\n💡 建议：{self.suggestion}"

    def get_technical_details(self) -> str:
        """获取技术详情，供开发人员排查"""
        return f"[{self.error_type}] {self.technical_details}"


def translate_error(error: Exception, **context) -> UserFriendlyError:
    """将技术异常转换为用户友好的错误提示"""
    error_type = type(error).__name__
    error_msg = str(error)

    matched = None
    for err_name, err_info in ERROR_TRANSLATIONS.items():
        match_on_type = err_info.get("match_on_type_only", False)
        if match_on_type:
            if err_name == error_type:
                matched = err_info
                break
        else:
            if err_name == error_type or (err_info["pattern"] and err_info["pattern"] in error_msg):
                matched = err_info
                break

    if matched:
        user_msg = matched["user_message"]
        suggestion = matched["suggestion"]
    else:
        user_msg = _generic_translate(error_type, error_msg)
        suggestion = "如果问题一直出现，把这个错误截图发给开发同事看看"

    if context:
        if "file_path" in context:
            user_msg = f"文件「{context['file_path']}」有问题：\n{user_msg}"
        if "row_number" in context:
            user_msg = f"第 {context['row_number']} 行：\n{user_msg}"
        if "column_name" in context:
            user_msg = f"「{context['column_name']}」列出错：\n{user_msg}"

    return UserFriendlyError(
        original_error=error,
        user_message=user_msg,
        suggestion=suggestion,
        error_type=error_type,
        timestamp=datetime.now(),
        context=context,
        technical_details=f"{error_type}: {error_msg}"
    )


def _generic_translate(error_type: str, error_msg: str) -> str:
    """通用错误翻译"""
    if "out of memory" in error_msg.lower():
        return "文件太大了，内存不够用\n可以试试分批处理，或者关掉一些别的程序"
    
    if "timeout" in error_msg.lower():
        return "操作超时了，可能是文件太大或者电脑太忙"
    
    if "disk" in error_msg.lower() and "space" in error_msg.lower():
        return "磁盘空间不够了，清理一下再试"
    
    return f"遇到了意料之外的问题（{error_type}）"


class CSVCleanerError(Exception):
    """业务异常基类"""
    def __init__(self, message: str, suggestion: str = "", **context):
        super().__init__(message)
        self.user_message = message
        self.suggestion = suggestion
        self.context = context

    def to_user_friendly(self) -> UserFriendlyError:
        return UserFriendlyError(
            original_error=self,
            user_message=self.user_message,
            suggestion=self.suggestion,
            error_type=type(self).__name__,
            timestamp=datetime.now(),
            context=self.context,
            technical_details=str(self)
        )


class DuplicateBatchError(CSVCleanerError):
    """批量处理重复运行异常"""
    def __init__(self, batch_id: str, processed_count: int):
        super().__init__(
            message=f"这批数据（批次号：{batch_id[:8]}...）已经处理过了，一共{processed_count}条记录",
            suggestion="如果确实要重新处理，请使用 --force 参数强制重新处理",
            batch_id=batch_id,
            processed_count=processed_count
        )


class PathSpaceWarning(CSVCleanerError):
    """路径空格警告（非致命错误）"""
    def __init__(self, original_path: str, normalized_path: str, row_number: int):
        super().__init__(
            message=f"第{row_number}行路径包含空格：「{original_path}」\n已自动修正为：「{normalized_path}」",
            suggestion="建议让提供数据的同事以后路径里不要有空格，免得后续出问题",
            original_path=original_path,
            normalized_path=normalized_path,
            row_number=row_number
        )


class LedgerConsistencyError(CSVCleanerError):
    """账本一致性校验失败"""
    def __init__(self, expected_count: int, actual_count: int, operation: str):
        super().__init__(
            message=f"{operation}操作后数据对不上：预期{expected_count}条，实际{actual_count}条",
            suggestion="请刷新页面重新查看，不要继续操作，先确认数据是否正确",
            expected_count=expected_count,
            actual_count=actual_count,
            operation=operation
        )


class EmptyFilterResult(CSVCleanerError):
    """筛选结果为空"""
    def __init__(self, filter_desc: str):
        super().__init__(
            message=f"筛选条件「{filter_desc}」没有找到任何匹配的记录",
            suggestion="试试放宽筛选条件，或者检查一下筛选条件是不是写错了",
            filter_desc=filter_desc
        )

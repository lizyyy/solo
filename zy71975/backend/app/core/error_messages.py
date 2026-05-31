from typing import Dict, Type


ERROR_MESSAGE_MAPPING: Dict[Type[Exception], str] = {
    FileNotFoundError: "找不到这个文件哦，看看是不是文件名记错了？",
    PermissionError: "没有权限访问这个文件呢～",
    IsADirectoryError: "这是个文件夹，不是文件哦～",
    ValueError: "数据格式有问题，检查一下内容再试试？",
    TypeError: "数据类型不对，确认一下输入内容？",
    KeyError: "缺少必要的字段，检查一下数据？",
    IndexError: "数据索引越界了，内容可能不完整～",
    UnicodeDecodeError: "文件编码有问题，试试转成 UTF-8 格式？",
    IOError: "文件读写失败，检查一下文件是否被占用？",
    OSError: "系统操作失败，稍后再试试？",
    MemoryError: "内存不足，文件可能太大了～",
    TimeoutError: "操作超时了，网络可能不太稳定～",
    ConnectionError: "连接失败，检查一下网络设置？",
}


DEFAULT_ERROR_MESSAGE = "出了点小问题，等会儿再试试吧～"


def get_user_friendly_message(exc: Exception) -> str:
    exc_type = type(exc)
    if exc_type in ERROR_MESSAGE_MAPPING:
        return ERROR_MESSAGE_MAPPING[exc_type]

    for base_type in ERROR_MESSAGE_MAPPING:
        if isinstance(exc, base_type):
            return ERROR_MESSAGE_MAPPING[base_type]

    return DEFAULT_ERROR_MESSAGE

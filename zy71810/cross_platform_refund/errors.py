from typing import Optional, Dict, Any
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

console = Console()


class FriendlyError(Exception):
    def __init__(
        self,
        message: str,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        error_type: str = "操作错误"
    ):
        self.message = message
        self.suggestion = suggestion
        self.details = details or {}
        self.error_type = error_type
        super().__init__(message)

    def __str__(self) -> str:
        return self.message

    def show(self) -> None:
        title = Text(f"❌ {self.error_type}", style="bold red")
        body = Text()
        body.append(self.message + "\n\n", style="white")
        
        if self.suggestion:
            body.append("💡 建议：", style="bold yellow")
            body.append(self.suggestion + "\n", style="yellow")
        
        if self.details:
            body.append("\n📋 相关信息：\n", style="bold cyan")
            for key, value in self.details.items():
                body.append(f"  • {key}: {value}\n", style="cyan")
        
        panel = Panel(body, title=title, border_style="red")
        console.print(panel)


class FileFormatError(FriendlyError):
    def __init__(self, filename: str, expected_format: str, actual_format: Optional[str] = None):
        msg = f"文件「{filename}」格式不对，系统读不出来。"
        suggestion = f"请检查文件是不是 {expected_format} 格式的。如果是 Excel 文件，请确保没有被其他程序占用。"
        details = {"文件名": filename, "期望格式": expected_format}
        if actual_format:
            details["实际格式"] = actual_format
        super().__init__(msg, suggestion, details, "文件格式错误")


class MissingColumnError(FriendlyError):
    def __init__(self, filename: str, missing_cols: list, required_cols: list):
        msg = f"文件「{filename}」缺少必要的列，没法继续处理。"
        cols_str = "、".join(f"「{c}」" for c in missing_cols)
        suggestion = f"请在文件里补上 {cols_str} 这{len(missing_cols)}列。必填列有：{', '.join(required_cols)}。"
        details = {"文件名": filename, "缺少的列": missing_cols, "必填列": required_cols}
        super().__init__(msg, suggestion, details, "列缺失错误")


class DuplicateRecordError(FriendlyError):
    def __init__(self, record_id: str, existing_count: int, file_source: str):
        msg = f"编号「{record_id}」的记录已经存在，系统检测到重复导入。"
        suggestion = f"如果是要修改这条记录，请用「撤回」功能先撤回原有记录，再重新导入。如果是误操作，可以忽略这条提示。"
        details = {"记录编号": record_id, "已存在次数": existing_count, "来源文件": file_source}
        super().__init__(msg, suggestion, details, "重复记录提示")


class RecordNotFoundError(FriendlyError):
    def __init__(self, record_id: str, action: str):
        msg = f"找不到编号「{record_id}」的记录，没法执行「{action}」操作。"
        suggestion = "请检查输入的编号是否正确，或者这条记录可能已经被撤回了。"
        details = {"记录编号": record_id, "操作类型": action}
        super().__init__(msg, suggestion, details, "记录不存在")


class InvalidStatusTransitionError(FriendlyError):
    def __init__(self, record_id: str, current_status: str, target_status: str):
        msg = f"编号「{record_id}」当前状态是「{current_status}」，不能直接改成「{target_status}」。"
        suggestion = "状态流转有规定：待补录→已确认/人工修改，已确认和人工修改的记录要先撤回才能重新处理。"
        details = {"记录编号": record_id, "当前状态": current_status, "目标状态": target_status}
        super().__init__(msg, suggestion, details, "状态流转错误")


class AmountMismatchError(FriendlyError):
    def __init__(self, record_id: str, expected_amount: float, actual_amount: float):
        msg = f"编号「{record_id}」的退款金额对不上。"
        suggestion = "请检查退款金额是否和原交易金额匹配，或者是不是小数点输错了。如果确实金额不同，需要人工标注说明原因。"
        details = {
            "记录编号": record_id,
            "系统期望金额": f"¥{expected_amount:.2f}",
            "实际录入金额": f"¥{actual_amount:.2f}",
            "差额": f"¥{abs(expected_amount - actual_amount):.2f}"
        }
        super().__init__(msg, suggestion, details, "金额不匹配")


class EmptyDataError(FriendlyError):
    def __init__(self, data_type: str):
        msg = f"还没有导入任何{data_type}数据。"
        suggestion = f"请先使用「导入」功能把{data_type}文件传进来，再执行后续操作。"
        super().__init__(msg, suggestion, error_type="数据为空")


class ExportError(FriendlyError):
    def __init__(self, filename: str, reason: str):
        msg = f"导出文件「{filename}」失败了。"
        suggestion = "请检查目标文件夹有没有写入权限，或者文件是不是正在被 Excel 打开占用了。"
        details = {"文件名": filename, "失败原因": reason}
        super().__init__(msg, suggestion, details, "导出失败")


class FilterError(FriendlyError):
    def __init__(self, filter_condition: str, reason: str):
        msg = f"筛选条件「{filter_condition}」没法用。"
        suggestion = "筛选条件格式应该是：列名=值，比如「支付平台=支付宝」。多个条件用逗号分开。"
        details = {"输入的条件": filter_condition, "问题说明": reason}
        super().__init__(msg, suggestion, details, "筛选条件错误")


def show_success(message: str, details: Optional[Dict[str, Any]] = None) -> None:
    title = Text("✅ 操作成功", style="bold green")
    body = Text(message + "\n\n", style="white")
    
    if details:
        body.append("📋 处理结果：\n", style="bold cyan")
        for key, value in details.items():
            body.append(f"  • {key}: {value}\n", style="cyan")
    
    panel = Panel(body, title=title, border_style="green")
    console.print(panel)


def show_info(message: str, title: str = "提示") -> None:
    title_text = Text(f"ℹ️ {title}", style="bold blue")
    body = Text(message, style="white")
    panel = Panel(body, title=title_text, border_style="blue")
    console.print(panel)


def show_warning(message: str, suggestion: Optional[str] = None) -> None:
    title = Text("⚠️ 注意", style="bold yellow")
    body = Text(message + "\n", style="white")
    if suggestion:
        body.append("\n💡 建议：" + suggestion, style="yellow")
    panel = Panel(body, title=title, border_style="yellow")
    console.print(panel)

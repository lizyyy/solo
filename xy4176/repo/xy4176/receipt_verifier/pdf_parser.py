"""PDF 回单解析模块 - 解析网银回单中的关键信息"""

import re
from abc import ABC, abstractmethod
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Type

from pypdf import PdfReader

from .models import ReceiptInfo
from .utils import calculate_file_hash, parse_date, parse_decimal, parse_datetime


class BaseBankParser(ABC):
    """银行回单解析器基类"""

    bank_name: str = "Unknown"

    @abstractmethod
    def can_parse(self, text: str) -> bool:
        """检查是否能解析此文本

        Args:
            text: PDF 提取的文本

        Returns:
            是否可以解析
        """
        pass

    @abstractmethod
    def parse(self, text: str, file_path: str, file_hash: str) -> ReceiptInfo:
        """解析回单文本

        Args:
            text: PDF 提取的文本
            file_path: 文件路径
            file_hash: 文件哈希

        Returns:
            回单信息对象
        """
        pass

    def _extract_amount(self, text: str) -> Decimal:
        """从文本中提取金额

        Args:
            text: 包含金额的文本

        Returns:
            Decimal 类型的金额
        """
        patterns = [
            r"[￥¥$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"金额[：:]\s*[￥¥$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"付款金额[：:]\s*[￥¥$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
            r"转账金额[：:]\s*[￥¥$]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                amount_str = match.group(1).replace(",", "")
                return parse_decimal(amount_str)

        return Decimal("0")

    def _extract_date(self, text: str) -> Optional[str]:
        """从文本中提取日期

        Args:
            text: 包含日期的文本

        Returns:
            日期字符串或 None
        """
        patterns = [
            r"交易日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)",
            r"付款日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)",
            r"转账日期[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)",
            r"交易时间[：:]\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)

        return None

    def _extract_account(self, text: str, keyword: str) -> str:
        """从文本中提取银行账号

        Args:
            text: 包含账号的文本
            keyword: 关键词（如 "付款人账号"、"收款人账号"）

        Returns:
            账号字符串
        """
        patterns = [
            rf"{keyword}[：:]\s*([\d\s\-]+)",
            rf"{keyword}[\s：:]*([\d\s\-]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                account = match.group(1).strip()
                account = re.sub(r"[\s\-]", "", account)
                return account

        return ""

    def _extract_name(self, text: str, keyword: str) -> str:
        """从文本中提取名称（付款人/收款人）

        Args:
            text: 包含名称的文本
            keyword: 关键词（如 "付款人"、"收款人"）

        Returns:
            名称字符串
        """
        patterns = [
            rf"{keyword}[名称户名]*[：:]\s*([^\n\r，。；;,]+?)(?=\s*[（(]|[账号开户行]|$))",
            rf"{keyword}[名称户名]*[：:]\s*([^\n\r，。；;,]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                name = match.group(1).strip()
                name = re.sub(r"[\s\r\n]+", " ", name)
                return name.strip("：:")

        return ""

    def _extract_transaction_id(self, text: str) -> str:
        """提取交易流水号

        Args:
            text: 文本内容

        Returns:
            交易流水号
        """
        patterns = [
            r"交易流水号[：:]\s*([A-Za-z0-9]+)",
            r"流水号[：:]\s*([A-Za-z0-9]+)",
            r"交易单号[：:]\s*([A-Za-z0-9]+)",
            r"凭证号[：:]\s*([A-Za-z0-9]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()

        return ""

    def _extract_remark(self, text: str) -> str:
        """提取备注信息

        Args:
            text: 文本内容

        Returns:
            备注信息
        """
        patterns = [
            r"摘要[：:]\s*([^\n\r]+)",
            r"备注[：:]\s*([^\n\r]+)",
            r"用途[：:]\s*([^\n\r]+)",
            r"附言[：:]\s*([^\n\r]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                remark = match.group(1).strip()
                return re.sub(r"[\s\r\n]+", " ", remark)

        return ""


class ICBCParser(BaseBankParser):
    """工商银行回单解析器"""

    bank_name: str = "中国工商银行"

    def can_parse(self, text: str) -> bool:
        return "工商银行" in text or "ICBC" in text or "工行" in text

    def parse(self, text: str, file_path: str, file_hash: str) -> ReceiptInfo:
        receipt = ReceiptInfo(
            file_path=file_path,
            file_hash=file_hash,
            bank_name=self.bank_name,
            raw_text=text,
        )

        receipt.payer_name = self._extract_name(text, "付款人")
        receipt.payer_account = self._extract_account(text, "付款人账号")
        receipt.payee_name = self._extract_name(text, "收款人")
        receipt.payee_account = self._extract_account(text, "收款人账号")
        receipt.amount = self._extract_amount(text)
        receipt.transaction_id = self._extract_transaction_id(text)
        receipt.remark = self._extract_remark(text)

        date_str = self._extract_date(text)
        if date_str:
            receipt.payment_date = parse_date(date_str)
            receipt.payment_time = parse_datetime(date_str)

        return receipt


class ABCParser(BaseBankParser):
    """农业银行回单解析器"""

    bank_name: str = "中国农业银行"

    def can_parse(self, text: str) -> bool:
        return "农业银行" in text or "ABC" in text or "农行" in text

    def parse(self, text: str, file_path: str, file_hash: str) -> ReceiptInfo:
        receipt = ReceiptInfo(
            file_path=file_path,
            file_hash=file_hash,
            bank_name=self.bank_name,
            raw_text=text,
        )

        receipt.payer_name = self._extract_name(text, "付款方")
        receipt.payer_account = self._extract_account(text, "付款方账号")
        receipt.payee_name = self._extract_name(text, "收款方")
        receipt.payee_account = self._extract_account(text, "收款方账号")
        receipt.amount = self._extract_amount(text)
        receipt.transaction_id = self._extract_transaction_id(text)
        receipt.remark = self._extract_remark(text)

        date_str = self._extract_date(text)
        if date_str:
            receipt.payment_date = parse_date(date_str)
            receipt.payment_time = parse_datetime(date_str)

        return receipt


class CCBParser(BaseBankParser):
    """建设银行回单解析器"""

    bank_name: str = "中国建设银行"

    def can_parse(self, text: str) -> bool:
        return "建设银行" in text or "CCB" in text or "建行" in text

    def parse(self, text: str, file_path: str, file_hash: str) -> ReceiptInfo:
        receipt = ReceiptInfo(
            file_path=file_path,
            file_hash=file_hash,
            bank_name=self.bank_name,
            raw_text=text,
        )

        receipt.payer_name = self._extract_name(text, "付款人")
        receipt.payer_account = self._extract_account(text, "付款人账号")
        receipt.payee_name = self._extract_name(text, "收款人")
        receipt.payee_account = self._extract_account(text, "收款人账号")
        receipt.amount = self._extract_amount(text)
        receipt.transaction_id = self._extract_transaction_id(text)
        receipt.remark = self._extract_remark(text)

        date_str = self._extract_date(text)
        if date_str:
            receipt.payment_date = parse_date(date_str)
            receipt.payment_time = parse_datetime(date_str)

        return receipt


class BOCParser(BaseBankParser):
    """中国银行回单解析器"""

    bank_name: str = "中国银行"

    def can_parse(self, text: str) -> bool:
        return "中国银行" in text or "BOC" in text

    def parse(self, text: str, file_path: str, file_hash: str) -> ReceiptInfo:
        receipt = ReceiptInfo(
            file_path=file_path,
            file_hash=file_hash,
            bank_name=self.bank_name,
            raw_text=text,
        )

        receipt.payer_name = self._extract_name(text, "付款人")
        receipt.payer_account = self._extract_account(text, "付款人账号")
        receipt.payee_name = self._extract_name(text, "收款人")
        receipt.payee_account = self._extract_account(text, "收款人账号")
        receipt.amount = self._extract_amount(text)
        receipt.transaction_id = self._extract_transaction_id(text)
        receipt.remark = self._extract_remark(text)

        date_str = self._extract_date(text)
        if date_str:
            receipt.payment_date = parse_date(date_str)
            receipt.payment_time = parse_datetime(date_str)

        return receipt


class GenericBankParser(BaseBankParser):
    """通用银行回单解析器"""

    bank_name: str = "通用银行"

    def can_parse(self, text: str) -> bool:
        return True

    def parse(self, text: str, file_path: str, file_hash: str) -> ReceiptInfo:
        receipt = ReceiptInfo(
            file_path=file_path,
            file_hash=file_hash,
            bank_name=self.bank_name,
            raw_text=text,
        )

        payer_keywords = ["付款人", "付款方", "转出方", "汇出方", "付款单位"]
        payee_keywords = ["收款人", "收款方", "转入方", "汇入方", "收款单位"]

        for keyword in payer_keywords:
            name = self._extract_name(text, keyword)
            if name:
                receipt.payer_name = name
                break

        for keyword in payer_keywords:
            account = self._extract_account(text, keyword + "账号")
            if account:
                receipt.payer_account = account
                break

        for keyword in payee_keywords:
            name = self._extract_name(text, keyword)
            if name:
                receipt.payee_name = name
                break

        for keyword in payee_keywords:
            account = self._extract_account(text, keyword + "账号")
            if account:
                receipt.payee_account = account
                break

        receipt.amount = self._extract_amount(text)
        receipt.transaction_id = self._extract_transaction_id(text)
        receipt.remark = self._extract_remark(text)

        date_str = self._extract_date(text)
        if date_str:
            receipt.payment_date = parse_date(date_str)
            receipt.payment_time = parse_datetime(date_str)

        return receipt


class PDFReceiptParser:
    """PDF 回单解析器主类"""

    PARSERS: List[Type[BaseBankParser]] = [
        ICBCParser,
        ABCParser,
        CCBParser,
        BOCParser,
        GenericBankParser,
    ]

    def __init__(self):
        self._parser_instances: Dict[Type[BaseBankParser], BaseBankParser] = {}

    def _get_parser(self, parser_class: Type[BaseBankParser]) -> BaseBankParser:
        """获取解析器实例（延迟初始化）

        Args:
            parser_class: 解析器类

        Returns:
            解析器实例
        """
        if parser_class not in self._parser_instances:
            self._parser_instances[parser_class] = parser_class()
        return self._parser_instances[parser_class]

    def _extract_text_from_pdf(self, file_path: str) -> str:
        """从 PDF 文件提取文本

        Args:
            file_path: PDF 文件路径

        Returns:
            提取的文本内容
        """
        text_parts: List[str] = []

        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        except Exception as e:
            raise ValueError(f"无法读取 PDF 文件: {e}")

        return "\n".join(text_parts)

    def parse(self, file_path: str, hash_algorithm: str = "sha256") -> ReceiptInfo:
        """解析 PDF 回单文件

        Args:
            file_path: PDF 文件路径
            hash_algorithm: 哈希算法

        Returns:
            回单信息对象
        """
        file_path_obj = Path(file_path)
        if not file_path_obj.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        if not file_path_obj.is_file():
            raise ValueError(f"不是文件: {file_path}")

        file_hash = calculate_file_hash(file_path, hash_algorithm)
        text = self._extract_text_from_pdf(file_path)

        for parser_class in self.PARSERS:
            parser = self._get_parser(parser_class)
            if parser.can_parse(text):
                return parser.parse(text, file_path, file_hash)

        generic_parser = self._get_parser(GenericBankParser)
        return generic_parser.parse(text, file_path, file_hash)

    def parse_text(
        self, text: str, file_path: str = "", file_hash: str = ""
    ) -> ReceiptInfo:
        """直接解析文本内容（用于测试）

        Args:
            text: 文本内容
            file_path: 可选的文件路径
            file_hash: 可选的文件哈希

        Returns:
            回单信息对象
        """
        for parser_class in self.PARSERS:
            parser = self._get_parser(parser_class)
            if parser.can_parse(text):
                return parser.parse(text, file_path, file_hash)

        generic_parser = self._get_parser(GenericBankParser)
        return generic_parser.parse(text, file_path, file_hash)


def parse_pdf_receipt(
    file_path: str,
    hash_algorithm: str = "sha256",
) -> ReceiptInfo:
    """便捷函数：解析 PDF 回单

    Args:
        file_path: PDF 文件路径
        hash_algorithm: 哈希算法

    Returns:
        回单信息对象
    """
    parser = PDFReceiptParser()
    return parser.parse(file_path, hash_algorithm)

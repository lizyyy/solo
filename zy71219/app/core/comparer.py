import re
from datetime import datetime
from typing import List, Dict, Any, Tuple
from dateutil import parser as date_parser
from app.schemas import ClauseParseResult, CompareResultItem


DISCREPANCY_CATEGORIES = {
    "SHIPMENT_DATE_EXCEEDED": {
        "name": "装运期超限",
        "severity": "CRITICAL",
        "impact": "可能导致开证行拒付，需立即联系客户修改信用证或改配船期",
        "next_action": "1. 核实实际装船日期是否可调整\n2. 联系申请人申请改证延展装运期\n3. 准备装船后通知申请人接受不符点"
    },
    "GOODS_DESCRIPTION_MISMATCH": {
        "name": "货描不一致",
        "severity": "HIGH",
        "impact": "单单不符或单证不符，开证行可据此拒付",
        "next_action": "1. 核对信用证条款原文\n2. 如系单据制作错误，立即修改单据\n3. 如信用证货描有误，联系申请人改证"
    },
    "DOCUMENT_AMOUNT_MISMATCH": {
        "name": "金额不一致",
        "severity": "CRITICAL",
        "impact": "金额超支或短支均构成不符点，直接影响收汇",
        "next_action": "1. 核对发票金额与信用证金额及增减幅度\n2. 如超支需联系申请人改证\n3. 确认是否含溢短装条款"
    },
    "PORT_OF_LOADING_MISMATCH": {
        "name": "装运港不符",
        "severity": "HIGH",
        "impact": "违反信用证运输条款，可能被拒付",
        "next_action": "1. 确认提单装运港是否与信用证一致\n2. 如系货代错误，要求改单\n3. 联系申请人接受不符点"
    },
    "PORT_OF_DESTINATION_MISMATCH": {
        "name": "目的港不符",
        "severity": "HIGH",
        "impact": "违反信用证运输条款，可能被拒付",
        "next_action": "1. 确认提单目的港是否与信用证一致\n2. 如系货代错误，要求改单\n3. 联系申请人接受不符点"
    },
    "LATE_PRESENTATION": {
        "name": "交单期超限",
        "severity": "CRITICAL",
        "impact": "迟期交单构成严重不符点，开证行可解除付款责任",
        "next_action": "1. 立即安排交单\n2. 如已超限，联系申请人接受不符点\n3. 下次提前安排单据制作"
    },
    "BENEFICIARY_NAME_MISMATCH": {
        "name": "受益人名称不符",
        "severity": "HIGH",
        "impact": "单据抬头不符，影响款项归属",
        "next_action": "1. 核对信用证受益人名称\n2. 修改单据抬头\n3. 如信用证名称有误，联系改证"
    },
    "APPLICANT_NAME_MISMATCH": {
        "name": "申请人名称不符",
        "severity": "MEDIUM",
        "impact": "单单不符，可能被挑剔",
        "next_action": "1. 核对各单据申请人名称\n2. 统一修改单据"
    },
    "INCONSISTENT_DOCUMENT_NUMBERS": {
        "name": "单据号码不一致",
        "severity": "MEDIUM",
        "impact": "单单不符，可能被拒付",
        "next_action": "1. 核对发票号在各单据中的引用\n2. 统一修改相关单据"
    },
    "PACKAGE_QUANTITY_MISMATCH": {
        "name": "件数/数量不一致",
        "severity": "HIGH",
        "impact": "单单不符，影响货权和结算",
        "next_action": "1. 核对提单、发票、箱单的件数毛重\n2. 如系单据错误，立即修改\n3. 确认是否允许分批装运"
    },
    "WEIGHT_MISMATCH": {
        "name": "重量不一致",
        "severity": "MEDIUM",
        "impact": "单单不符，可能影响清关",
        "next_action": "1. 核对各单据毛重净重\n2. 修改单据使其一致"
    },
    "MARKS_MISMATCH": {
        "name": "唛头不一致",
        "severity": "LOW",
        "impact": "单单不符，可能影响清关提货",
        "next_action": "1. 核对各单据唛头\n2. 修改单据使其与提单一致"
    },
    "DOCUMENT_VERSION_CONFLICT": {
        "name": "单据版本冲突",
        "severity": "HIGH",
        "impact": "修改件未正确覆盖旧件，可能提交错误版本",
        "next_action": "1. 确认最新有效版本\n2. 标记旧版本为失效\n3. 核对修改内容是否完整"
    },
    "MISSING_REQUIRED_DOCUMENT": {
        "name": "缺少所需单据",
        "severity": "CRITICAL",
        "impact": "缺少信用证要求的单据，直接导致拒付",
        "next_action": "1. 对照信用证46A条款逐一核对\n2. 立即准备缺失单据\n3. 确认是否可后补"
    },
    "INCOTERMS_MISMATCH": {
        "name": "贸易术语不符",
        "severity": "HIGH",
        "impact": "价格条款不符，影响责任划分",
        "next_action": "1. 核对信用证贸易术语\n2. 修改单据使其一致"
    }
}


class ClauseParser:
    def __init__(self):
        self.patterns = {
            "goods_description": [r"(?i)description of goods|货描|货物描述|45A", r"(?i)goods:|商品:|品名"],
            "shipment_date": [r"(?i)latest shipment date|最迟装运期|装运期|44C"],
            "expiry_date": [r"(?i)date and place of expiry|有效期|到期日|31D"],
            "presentation_period": [r"(?i)presentation period|交单期|48"],
            "port_of_loading": [r"(?i)port of loading|装运港|起运港|44E"],
            "port_of_destination": [r"(?i)port of discharge|目的港|卸货港|44F"],
            "partial_shipment": [r"(?i)partial shipment|分批装运|43P"],
            "transshipment": [r"(?i)transshipment|转运|43T"],
            "amount": [r"(?i)currency code, amount|金额|币别|32B"],
            "documents_required": [r"(?i)documents required|所需单据|46A"],
            "additional_conditions": [r"(?i)additional conditions|附加条件|47A"],
            "beneficiary": [r"(?i)beneficiary|受益人|59"],
            "applicant": [r"(?i)applicant|申请人|50"],
            "incoterms": [r"(?i)trade terms|price terms|贸易术语|FOB|CIF|CFR|EXW|FCA|CPT|CIP|DAP|DPU|DDP"],
        }

    def parse(self, clauses_text: str) -> List[ClauseParseResult]:
        results = []
        lines = self._split_clauses(clauses_text)

        for idx, clause in enumerate(lines):
            clause_type = self._identify_clause_type(clause)
            clause_number = f"{idx + 1:03d}"
            parsed_fields = self._parse_clause_content(clause, clause_type)

            results.append(ClauseParseResult(
                clause_number=clause_number,
                clause_type=clause_type,
                content=clause.strip(),
                parsed_fields=parsed_fields
            ))

        return results

    def _split_clauses(self, text: str) -> List[str]:
        boundaries = []
        for m in re.finditer(r'(?m)^(?:\d{1,2}[A-Za-z]?\s*[:：]|[A-Z]{2}\d{1,2}[A-Z]?\s*[:：])', text):
            boundaries.append(m.start())

        if not boundaries:
            clauses = re.split(r'\n\s*\n+', text)
            return [c.strip() for c in clauses if c.strip()]

        result = []
        for i, start in enumerate(boundaries):
            end = boundaries[i + 1] if i + 1 < len(boundaries) else len(text)
            clause = text[start:end].strip()
            if clause:
                result.append(clause)

        return result

    def _identify_clause_type(self, clause: str) -> str:
        for clause_type, patterns in self.patterns.items():
            for pattern in patterns:
                if re.search(pattern, clause):
                    return clause_type
        return "other"

    def _parse_clause_content(self, clause: str, clause_type: str) -> Dict[str, Any]:
        parsed = {}

        dates = self._extract_dates(clause)
        if dates:
            parsed["dates"] = [d.isoformat() for d in dates]

        amounts = self._extract_amounts(clause)
        if amounts:
            parsed["amounts"] = amounts

        ports = self._extract_ports(clause)
        if ports:
            parsed["ports"] = ports

        names = self._extract_names(clause)
        if names:
            parsed["entities"] = names

        incoterms = self._extract_incoterms(clause)
        if incoterms:
            parsed["incoterms"] = incoterms

        if clause_type == "goods_description":
            parsed["description"] = self._clean_description(clause)

        return parsed

    def _extract_dates(self, text: str) -> List[datetime]:
        dates = []
        date_patterns = [
            r'\d{4}-\d{2}-\d{2}',
            r'\d{4}/\d{2}/\d{2}',
            r'\d{2}-\d{2}-\d{4}',
            r'\d{2}/\d{2}/\d{4}',
            r'(?i)(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}',
        ]

        for pattern in date_patterns:
            for match in re.finditer(pattern, text):
                try:
                    d = date_parser.parse(match.group(), fuzzy=True)
                    dates.append(d)
                except:
                    continue

        return dates

    def _extract_amounts(self, text: str) -> List[Dict[str, Any]]:
        amounts = []
        currency_codes = ["USD", "EUR", "CNY", "JPY", "GBP", "HKD", "AUD", "CAD", "CHF", "SGD"]

        pattern = r'(?P<currency>' + '|'.join(currency_codes) + r')?\s*[¥$€£]?\s*[\d,]+\.?\d*'
        for match in re.finditer(pattern, text):
            amt_str = match.group().replace(',', '').strip()
            try:
                value = float(re.search(r'[\d.]+', amt_str).group())
                currency = match.group('currency') or (
                    'USD' if '$' in amt_str else
                    'EUR' if '€' in amt_str else
                    'CNY' if '¥' in amt_str else None
                )
                amounts.append({"value": value, "currency": currency})
            except:
                continue

        return amounts

    def _extract_ports(self, text: str) -> List[str]:
        ports = []
        keywords = ["上海", "SHANGHAI", "宁波", "NINGBO", "深圳", "SHENZHEN", "广州", "GUANGZHOU",
                   "青岛", "QINGDAO", "天津", "TIANJIN", "厦门", "XIAMEN", "香港", "HONGKONG", "HONG KONG",
                   "新加坡", "SINGAPORE", "洛杉矶", "LOS ANGELES", "长滩", "LONG BEACH",
                   "纽约", "NEW YORK", "鹿特丹", "ROTTERDAM", "汉堡", "HAMBURG", "东京", "TOKYO",
                   "大阪", "OSAKA", "悉尼", "SYDNEY", "墨尔本", "MELBOURNE"]

        for port in keywords:
            if re.search(r'(?i)\b' + re.escape(port) + r'\b', text):
                ports.append(port)

        return ports

    def _extract_names(self, text: str) -> List[str]:
        names = []
        pattern = r'[A-Z][A-Z\s&,.\'-]{5,}|[\u4e00-\u9fa5]{4,}(?:公司|有限公司|集团|工厂|贸易|进出口)'
        for match in re.finditer(pattern, text):
            name = match.group().strip()
            if len(name) > 3:
                names.append(name)
        return names

    def _extract_incoterms(self, text: str) -> List[str]:
        terms = ["FOB", "CIF", "CFR", "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP"]
        found = []
        for term in terms:
            if re.search(r'(?i)\b' + term + r'\b', text):
                found.append(term.upper())
        return found

    def _clean_description(self, text: str) -> str:
        cleaned = re.sub(r'(?i)(description of goods|货描|货物描述|45A)[^\n]*[:：]?', '', text)
        return cleaned.strip()


class DocumentComparer:
    def __init__(self, clause_parser: ClauseParser = None):
        self.clause_parser = clause_parser or ClauseParser()

    def compare_document_with_lc(self, lc_data: Dict[str, Any], document_data: Dict[str, Any],
                                 clauses_data: List[Dict[str, Any]] = None) -> List[CompareResultItem]:
        results = []
        doc_type = document_data.get("document_type", "").upper()
        doc_content = document_data.get("content", {}) or {}

        if doc_type == "BILL_OF_LADING" or doc_type == "BL":
            results.extend(self._compare_bl(lc_data, doc_content, clauses_data))
        elif doc_type == "COMMERCIAL_INVOICE" or doc_type == "INVOICE":
            results.extend(self._compare_invoice(lc_data, doc_content, clauses_data))
        elif doc_type == "PACKING_LIST" or doc_type == "PL":
            results.extend(self._compare_packing_list(lc_data, doc_content, clauses_data))

        return results

    def compare_documents(self, documents_data: List[Dict[str, Any]]) -> List[CompareResultItem]:
        results = []
        bl_data = None
        invoice_data = None
        pl_data = None

        for doc in documents_data:
            doc_type = doc.get("document_type", "").upper()
            content = doc.get("content", {}) or {}
            if doc_type in ["BILL_OF_LADING", "BL"]:
                bl_data = content
            elif doc_type in ["COMMERCIAL_INVOICE", "INVOICE"]:
                invoice_data = content
            elif doc_type in ["PACKING_LIST", "PL"]:
                pl_data = content

        if bl_data and invoice_data:
            results.extend(self._compare_bl_invoice(bl_data, invoice_data))

        if invoice_data and pl_data:
            results.extend(self._compare_invoice_pl(invoice_data, pl_data))

        if bl_data and pl_data:
            results.extend(self._compare_bl_pl(bl_data, pl_data))

        return results

    def _compare_bl(self, lc_data: Dict[str, Any], bl_content: Dict[str, Any],
                    clauses_data: List[Dict[str, Any]] = None) -> List[CompareResultItem]:
        results = []

        if lc_data.get("latest_shipment_date") and bl_content.get("shipment_date"):
            try:
                lc_date = lc_data["latest_shipment_date"]
                if isinstance(lc_date, str):
                    lc_date = date_parser.parse(lc_date)
                bl_date = bl_content["shipment_date"]
                if isinstance(bl_date, str):
                    bl_date = date_parser.parse(bl_date)

                is_match = bl_date <= lc_date
                cat = DISCREPANCY_CATEGORIES["SHIPMENT_DATE_EXCEEDED"]

                results.append(CompareResultItem(
                    field_name="latest_shipment_date",
                    clause_value=lc_date.isoformat(),
                    document_value=bl_date.isoformat(),
                    match=is_match,
                    discrepancy_type=None if is_match else "SHIPMENT_DATE_EXCEEDED",
                    severity=None if is_match else cat["severity"],
                    description=None if is_match else f"装运期超限：信用证要求{lc_date.strftime('%Y-%m-%d')}前，实际装船日期为{bl_date.strftime('%Y-%m-%d')}",
                    reason=None if is_match else f"实际装船日期({bl_date.strftime('%Y-%m-%d')})晚于信用证规定的最迟装运期({lc_date.strftime('%Y-%m-%d')})",
                    impact_scope=None if is_match else cat["impact"],
                    next_action=None if is_match else cat["next_action"]
                ))
            except Exception as e:
                pass

        results.extend(self._compare_field(
            lc_data, bl_content, "port_of_loading", "PORT_OF_LOADING_MISMATCH",
            "装运港", clauses_data
        ))

        results.extend(self._compare_field(
            lc_data, bl_content, "port_of_destination", "PORT_OF_DESTINATION_MISMATCH",
            "目的港", clauses_data
        ))

        if bl_content.get("beneficiary") and lc_data.get("beneficiary"):
            lc_ben = str(lc_data["beneficiary"]).strip()
            bl_ben = str(bl_content["beneficiary"]).strip()
            is_match = lc_ben in bl_ben or bl_ben in lc_ben
            cat = DISCREPANCY_CATEGORIES["BENEFICIARY_NAME_MISMATCH"]

            results.append(CompareResultItem(
                field_name="beneficiary",
                clause_value=lc_ben,
                document_value=bl_ben,
                match=is_match,
                discrepancy_type=None if is_match else "BENEFICIARY_NAME_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"受益人名称不符：信用证'{lc_ben}'，提单'{bl_ben}'",
                reason=None if is_match else f"提单受益人名称与信用证受益人名称不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        return results

    def _compare_invoice(self, lc_data: Dict[str, Any], invoice_content: Dict[str, Any],
                         clauses_data: List[Dict[str, Any]] = None) -> List[CompareResultItem]:
        results = []

        if lc_data.get("amount") and invoice_content.get("total_amount"):
            lc_amt = float(lc_data["amount"])
            inv_amt = float(invoice_content["total_amount"])
            tolerance = invoice_content.get("tolerance", 0) or 0

            if tolerance:
                min_amt = lc_amt * (1 - float(tolerance) / 100)
                max_amt = lc_amt * (1 + float(tolerance) / 100)
                is_match = min_amt <= inv_amt <= max_amt
            else:
                is_match = inv_amt <= lc_amt

            cat = DISCREPANCY_CATEGORIES["DOCUMENT_AMOUNT_MISMATCH"]
            results.append(CompareResultItem(
                field_name="total_amount",
                clause_value=f"{lc_data.get('currency', 'USD')} {lc_amt:,.2f}",
                document_value=f"{lc_data.get('currency', 'USD')} {inv_amt:,.2f}",
                match=is_match,
                discrepancy_type=None if is_match else "DOCUMENT_AMOUNT_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"金额不一致：信用证金额{lc_amt:,.2f}，发票金额{inv_amt:,.2f}",
                reason=None if is_match else f"发票金额({inv_amt:,.2f})超出信用证金额({lc_amt:,.2f})允许范围",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        lc_desc = lc_data.get("goods_description", "")
        inv_desc = invoice_content.get("goods_description", "")
        if lc_desc and inv_desc:
            is_match = self._fuzzy_match(lc_desc, inv_desc)
            cat = DISCREPANCY_CATEGORIES["GOODS_DESCRIPTION_MISMATCH"]

            results.append(CompareResultItem(
                field_name="goods_description",
                clause_value=lc_desc[:100] + "..." if len(lc_desc) > 100 else lc_desc,
                document_value=inv_desc[:100] + "..." if len(inv_desc) > 100 else inv_desc,
                match=is_match,
                discrepancy_type=None if is_match else "GOODS_DESCRIPTION_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else "货描不一致：发票货物描述与信用证条款存在差异",
                reason=None if is_match else "发票货描未完全照搬信用证货物描述，存在添加或删减",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        results.extend(self._compare_field(
            lc_data, invoice_content, "beneficiary", "BENEFICIARY_NAME_MISMATCH",
            "受益人", clauses_data
        ))

        results.extend(self._compare_field(
            lc_data, invoice_content, "applicant", "APPLICANT_NAME_MISMATCH",
            "申请人", clauses_data
        ))

        if lc_data.get("incoterms") and invoice_content.get("incoterms"):
            lc_term = str(lc_data["incoterms"]).upper()
            inv_term = str(invoice_content["incoterms"]).upper()
            is_match = lc_term == inv_term
            cat = DISCREPANCY_CATEGORIES["INCOTERMS_MISMATCH"]

            results.append(CompareResultItem(
                field_name="incoterms",
                clause_value=lc_term,
                document_value=inv_term,
                match=is_match,
                discrepancy_type=None if is_match else "INCOTERMS_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"贸易术语不符：信用证{lc_term}，发票{inv_term}",
                reason=None if is_match else "发票贸易术语与信用证规定不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        return results

    def _compare_packing_list(self, lc_data: Dict[str, Any], pl_content: Dict[str, Any],
                              clauses_data: List[Dict[str, Any]] = None) -> List[CompareResultItem]:
        results = []

        results.extend(self._compare_field(
            lc_data, pl_content, "applicant", "APPLICANT_NAME_MISMATCH",
            "申请人", clauses_data
        ))

        results.extend(self._compare_field(
            lc_data, pl_content, "beneficiary", "BENEFICIARY_NAME_MISMATCH",
            "受益人", clauses_data
        ))

        return results

    def _compare_bl_invoice(self, bl_content: Dict[str, Any], invoice_content: Dict[str, Any]) -> List[CompareResultItem]:
        results = []

        bl_inv_no = str(bl_content.get("invoice_number", "")).strip()
        inv_no = str(invoice_content.get("invoice_number", "")).strip()
        if bl_inv_no and inv_no:
            is_match = bl_inv_no == inv_no
            cat = DISCREPANCY_CATEGORIES["INCONSISTENT_DOCUMENT_NUMBERS"]

            results.append(CompareResultItem(
                field_name="invoice_number",
                clause_value=inv_no,
                document_value=bl_inv_no,
                match=is_match,
                discrepancy_type=None if is_match else "INCONSISTENT_DOCUMENT_NUMBERS",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"单据号码不一致：发票号{inv_no}，提单引用{bl_inv_no}",
                reason=None if is_match else "提单引用的发票号与实际发票号不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        bl_qty = bl_content.get("package_quantity")
        inv_qty = invoice_content.get("quantity")
        if bl_qty is not None and inv_qty is not None:
            is_match = float(bl_qty) == float(inv_qty)
            cat = DISCREPANCY_CATEGORIES["PACKAGE_QUANTITY_MISMATCH"]

            results.append(CompareResultItem(
                field_name="quantity",
                clause_value=str(inv_qty),
                document_value=str(bl_qty),
                match=is_match,
                discrepancy_type=None if is_match else "PACKAGE_QUANTITY_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"数量不一致：发票{inv_qty}，提单{bl_qty}",
                reason=None if is_match else "提单与发票的货物数量不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        bl_gw = bl_content.get("gross_weight")
        inv_gw = invoice_content.get("gross_weight")
        if bl_gw is not None and inv_gw is not None:
            is_match = abs(float(bl_gw) - float(inv_gw)) < 0.01
            cat = DISCREPANCY_CATEGORIES["WEIGHT_MISMATCH"]

            results.append(CompareResultItem(
                field_name="gross_weight",
                clause_value=str(inv_gw),
                document_value=str(bl_gw),
                match=is_match,
                discrepancy_type=None if is_match else "WEIGHT_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"重量不一致：发票{inv_gw}KGS，提单{bl_gw}KGS",
                reason=None if is_match else "提单与发票的毛重不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        bl_marks = str(bl_content.get("shipping_marks", "")).strip()
        inv_marks = str(invoice_content.get("shipping_marks", "")).strip()
        if bl_marks and inv_marks:
            is_match = bl_marks == inv_marks
            cat = DISCREPANCY_CATEGORIES["MARKS_MISMATCH"]

            results.append(CompareResultItem(
                field_name="shipping_marks",
                clause_value=inv_marks[:50] + "..." if len(inv_marks) > 50 else inv_marks,
                document_value=bl_marks[:50] + "..." if len(bl_marks) > 50 else bl_marks,
                match=is_match,
                discrepancy_type=None if is_match else "MARKS_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else "唛头不一致：提单与发票唛头存在差异",
                reason=None if is_match else "提单唛头与发票唛头不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        return results

    def _compare_invoice_pl(self, invoice_content: Dict[str, Any], pl_content: Dict[str, Any]) -> List[CompareResultItem]:
        results = []

        inv_no = str(invoice_content.get("invoice_number", "")).strip()
        pl_inv_no = str(pl_content.get("invoice_number", "")).strip()
        if inv_no and pl_inv_no:
            is_match = inv_no == pl_inv_no
            cat = DISCREPANCY_CATEGORIES["INCONSISTENT_DOCUMENT_NUMBERS"]

            results.append(CompareResultItem(
                field_name="invoice_number",
                clause_value=inv_no,
                document_value=pl_inv_no,
                match=is_match,
                discrepancy_type=None if is_match else "INCONSISTENT_DOCUMENT_NUMBERS",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"单据号码不一致：发票号{inv_no}，箱单引用{pl_inv_no}",
                reason=None if is_match else "箱单引用的发票号与实际发票号不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        inv_qty = invoice_content.get("quantity")
        pl_qty = pl_content.get("quantity")
        if inv_qty is not None and pl_qty is not None:
            is_match = float(inv_qty) == float(pl_qty)
            cat = DISCREPANCY_CATEGORIES["PACKAGE_QUANTITY_MISMATCH"]

            results.append(CompareResultItem(
                field_name="quantity",
                clause_value=str(inv_qty),
                document_value=str(pl_qty),
                match=is_match,
                discrepancy_type=None if is_match else "PACKAGE_QUANTITY_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"数量不一致：发票{inv_qty}，箱单{pl_qty}",
                reason=None if is_match else "箱单与发票的货物数量不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        inv_gw = invoice_content.get("gross_weight")
        pl_gw = pl_content.get("gross_weight")
        if inv_gw is not None and pl_gw is not None:
            is_match = abs(float(inv_gw) - float(pl_gw)) < 0.01
            cat = DISCREPANCY_CATEGORIES["WEIGHT_MISMATCH"]

            results.append(CompareResultItem(
                field_name="gross_weight",
                clause_value=str(inv_gw),
                document_value=str(pl_gw),
                match=is_match,
                discrepancy_type=None if is_match else "WEIGHT_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"重量不一致：发票{inv_gw}KGS，箱单{pl_gw}KGS",
                reason=None if is_match else "箱单与发票的毛重不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        inv_marks = str(invoice_content.get("shipping_marks", "")).strip()
        pl_marks = str(pl_content.get("shipping_marks", "")).strip()
        if inv_marks and pl_marks:
            is_match = inv_marks == pl_marks
            cat = DISCREPANCY_CATEGORIES["MARKS_MISMATCH"]

            results.append(CompareResultItem(
                field_name="shipping_marks",
                clause_value=inv_marks[:50] + "..." if len(inv_marks) > 50 else inv_marks,
                document_value=pl_marks[:50] + "..." if len(pl_marks) > 50 else pl_marks,
                match=is_match,
                discrepancy_type=None if is_match else "MARKS_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else "唛头不一致：发票与箱单唛头存在差异",
                reason=None if is_match else "箱单唛头与发票唛头不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        return results

    def _compare_bl_pl(self, bl_content: Dict[str, Any], pl_content: Dict[str, Any]) -> List[CompareResultItem]:
        results = []

        bl_qty = bl_content.get("package_quantity")
        pl_qty = pl_content.get("quantity")
        if bl_qty is not None and pl_qty is not None:
            is_match = float(bl_qty) == float(pl_qty)
            cat = DISCREPANCY_CATEGORIES["PACKAGE_QUANTITY_MISMATCH"]

            results.append(CompareResultItem(
                field_name="quantity",
                clause_value=str(bl_qty),
                document_value=str(pl_qty),
                match=is_match,
                discrepancy_type=None if is_match else "PACKAGE_QUANTITY_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"数量不一致：提单{bl_qty}，箱单{pl_qty}",
                reason=None if is_match else "箱单与提单的货物数量不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        bl_gw = bl_content.get("gross_weight")
        pl_gw = pl_content.get("gross_weight")
        if bl_gw is not None and pl_gw is not None:
            is_match = abs(float(bl_gw) - float(pl_gw)) < 0.01
            cat = DISCREPANCY_CATEGORIES["WEIGHT_MISMATCH"]

            results.append(CompareResultItem(
                field_name="gross_weight",
                clause_value=str(bl_gw),
                document_value=str(pl_gw),
                match=is_match,
                discrepancy_type=None if is_match else "WEIGHT_MISMATCH",
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"重量不一致：提单{bl_gw}KGS，箱单{pl_gw}KGS",
                reason=None if is_match else "箱单与提单的毛重不一致",
                impact_scope=None if is_match else cat["impact"],
                next_action=None if is_match else cat["next_action"]
            ))

        return results

    def _compare_field(self, lc_data: Dict[str, Any], doc_content: Dict[str, Any],
                       field_name: str, discrepancy_type: str, field_label: str,
                       clauses_data: List[Dict[str, Any]] = None) -> List[CompareResultItem]:
        results = []

        lc_value = lc_data.get(field_name)
        doc_value = doc_content.get(field_name)

        if lc_value and doc_value:
            lc_str = str(lc_value).strip()
            doc_str = str(doc_value).strip()

            is_match = self._fuzzy_match(lc_str, doc_str)
            cat = DISCREPANCY_CATEGORIES.get(discrepancy_type, {"severity": "MEDIUM", "impact": "", "next_action": ""})

            results.append(CompareResultItem(
                field_name=field_name,
                clause_value=lc_str,
                document_value=doc_str,
                match=is_match,
                discrepancy_type=None if is_match else discrepancy_type,
                severity=None if is_match else cat["severity"],
                description=None if is_match else f"{field_label}不符：信用证'{lc_str}'，单据'{doc_str}'",
                reason=None if is_match else f"单据{field_label}与信用证规定不一致",
                impact_scope=None if is_match else cat.get("impact", ""),
                next_action=None if is_match else cat.get("next_action", "")
            ))

        return results

    def _fuzzy_match(self, str1: str, str2: str, threshold: float = 0.85) -> bool:
        str1 = str1.lower().strip()
        str2 = str2.lower().strip()

        if str1 == str2:
            return True

        if str1 in str2 or str2 in str1:
            return True

        s1 = set(re.findall(r'[\w\u4e00-\u9fa5]+', str1))
        s2 = set(re.findall(r'[\w\u4e00-\u9fa5]+', str2))

        if not s1 or not s2:
            return False

        intersection = s1 & s2
        union = s1 | s2

        similarity = len(intersection) / len(union) if union else 0

        return similarity >= threshold

    def check_version_conflict(self, documents_data: List[Dict[str, Any]]) -> List[CompareResultItem]:
        results = []
        doc_groups = {}

        for doc in documents_data:
            doc_no = doc.get("document_number")
            doc_type = doc.get("document_type")
            key = (doc_type, doc_no)

            if key not in doc_groups:
                doc_groups[key] = []
            doc_groups[key].append(doc)

        for (doc_type, doc_no), docs in doc_groups.items():
            if len(docs) > 1:
                active_docs = [d for d in docs if d.get("is_active", True)]

                if len(active_docs) > 1:
                    cat = DISCREPANCY_CATEGORIES["DOCUMENT_VERSION_CONFLICT"]
                    versions = [f"v{d.get('version', 1)}" for d in active_docs]

                    results.append(CompareResultItem(
                        field_name="document_version",
                        clause_value=f"唯一有效版本",
                        document_value=f"存在{len(active_docs)}个有效版本: {', '.join(versions)}",
                        match=False,
                        discrepancy_type="DOCUMENT_VERSION_CONFLICT",
                        severity=cat["severity"],
                        description=f"单据版本冲突：{doc_type} {doc_no} 存在多个有效版本",
                        reason=f"同一单据编号存在{len(active_docs)}个同时有效的版本，可能提交错误版本",
                        impact_scope=cat["impact"],
                        next_action=cat["next_action"]
                    ))

        return results

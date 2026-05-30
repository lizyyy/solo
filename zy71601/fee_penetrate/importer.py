from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from dateutil.parser import parse as date_parse

from .config import Config
from .database import Database
from .models import (
    Product, FeeRule, SalesChannel, NavFlow, CustomerShare,
    ChannelRebate, FeeType, ShareCaliber, AccrualMethod,
    FeeAccrual, ChannelAllocation
)
class ImportResult:
    def __init__(self, batch_id: int, batch_no: str):
        self.batch_id = batch_id
        self.batch_no = batch_no
        self.total = 0
        self.new = 0
        self.skip = 0
        self.update = 0
        self.conflict = 0
        self.conflicts: List[Dict[str, Any]] = []
        self.updates: List[Dict[str, Any]] = []
        self.new_items: List[Dict[str, Any]] = []

    def add_result(
        self,
        status: str,
        entity_type: str,
        entity_id: Optional[int],
        identifier: str,
        changes: Optional[List[Tuple[str, Any, Any]]] = None
    ):
        self.total += 1
        if status == "new":
            self.new += 1
            self.new_items.append({
                "entity_type": entity_type,
                "entity_id": entity_id,
                "identifier": identifier
            })
        elif status == "skip":
            self.skip += 1
        elif status == "update":
            self.update += 1
            self.updates.append({
                "entity_type": entity_type,
                "entity_id": entity_id,
                "identifier": identifier,
                "changes": changes or []
            })
        elif status == "conflict":
            self.conflict += 1
            self.conflicts.append({
                "entity_type": entity_type,
                "entity_id": entity_id,
                "identifier": identifier,
                "changes": changes or []
            })

    def summary(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "batch_no": self.batch_no,
            "total": self.total,
            "new": self.new,
            "skip": self.skip,
            "update": self.update,
            "conflict": self.conflict
        }


class DataImporter:
    def __init__(self, operator: str, db: Optional[Database] = None):
        self.db = db or Database()
        self.operator = operator

    def _parse_date(self, value: Any) -> Optional[date]:
        if not value:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if pd.isna(value):
            return None
        try:
            return date_parse(str(value)).date()
        except (ValueError, TypeError):
            return None

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        try:
            return Decimal(str(value))
        except (ValueError, TypeError, InvalidOperation):
            return None

    def _parse_int(self, value: Any) -> Optional[int]:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        try:
            return int(value)
        except (ValueError, TypeError):
            return None

    def _read_file(self, file_path: str) -> pd.DataFrame:
        path = Path(file_path)
        if path.suffix.lower() in [".xlsx", ".xls"]:
            return pd.read_excel(path)
        elif path.suffix.lower() == ".csv":
            return pd.read_csv(path)
        elif path.suffix.lower() == ".json":
            return pd.read_json(path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

    def _get_or_create_product_id(
        self,
        session,
        product_code: str,
        product_name: Optional[str] = None
    ) -> Optional[int]:
        product = session.query(Product).filter(
            Product.product_code == product_code
        ).first()
        if product:
            return product.id
        if product_name:
            product = Product(
                product_code=product_code,
                product_name=product_name
            )
            session.add(product)
            session.flush()
            return product.id
        return None

    def _get_or_create_channel_id(
        self,
        session,
        channel_code: str,
        channel_name: Optional[str] = None
    ) -> Optional[int]:
        channel = session.query(SalesChannel).filter(
            SalesChannel.channel_code == channel_code
        ).first()
        if channel:
            return channel.id
        if channel_name:
            channel = SalesChannel(
                channel_code=channel_code,
                channel_name=channel_name
            )
            session.add(channel)
            session.flush()
            return channel.id
        return None

    def import_products(
        self,
        file_path: str,
        update_mode: str = "prompt",
        reason: Optional[str] = None
    ) -> ImportResult:
        df = self._read_file(file_path)
        batch = self.db.create_batch(
            source_type="product",
            source_file=file_path,
            operator=self.operator,
            remark=reason
        )
        result = ImportResult(batch.id, batch.batch_no)

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                product_code = str(row.get("产品代码", row.get("product_code", ""))).strip()
                if not product_code:
                    continue

                data = {
                    "product_code": product_code,
                    "product_name": str(row.get("产品名称", row.get("product_name", ""))).strip(),
                    "product_type": str(row.get("产品类型", row.get("product_type", ""))).strip() or None,
                    "manager": str(row.get("管理人", row.get("manager", ""))).strip() or None,
                    "custodian": str(row.get("托管人", row.get("custodian", ""))).strip() or None,
                    "establish_date": self._parse_date(row.get("成立日期", row.get("establish_date"))),
                    "expire_date": self._parse_date(row.get("到期日期", row.get("expire_date"))),
                    "contract_no": str(row.get("合同编号", row.get("contract_no", ""))).strip() or None,
                    "contract_version": str(row.get("合同版本", row.get("contract_version", ""))).strip() or None,
                    "contract_effective_date": self._parse_date(row.get("合同生效日", row.get("contract_effective_date"))),
                    "risk_level": str(row.get("风险等级", row.get("risk_level", ""))).strip() or None,
                    "memo": str(row.get("备注", row.get("memo", ""))).strip() or None,
                }

                if not data["product_name"]:
                    data["product_name"] = data["product_code"]

                unique_keys = {"product_code": data["product_code"]}
                status, entity_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=Product,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=self.operator,
                    update_mode=update_mode,
                    import_reason=reason
                )

                identifier = f"{data['product_code']}-{data['product_name']}"
                result.add_result(status, "Product", entity_id, identifier, changes)

        self.db.update_batch_stats(
            batch_id=batch.id,
            new_records=result.new,
            skip_records=result.skip,
            update_records=result.update,
            conflict_records=result.conflict
        )
        return result

    def import_fee_rules(
        self,
        file_path: str,
        update_mode: str = "prompt",
        reason: Optional[str] = None
    ) -> ImportResult:
        df = self._read_file(file_path)
        batch = self.db.create_batch(
            source_type="fee_rule",
            source_file=file_path,
            operator=self.operator,
            remark=reason
        )
        result = ImportResult(batch.id, batch.batch_no)

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                product_code = str(row.get("产品代码", row.get("product_code", ""))).strip()
                fee_type_str = str(row.get("费用类型", row.get("fee_type", ""))).strip().lower()
                effective_date = self._parse_date(row.get("生效日期", row.get("effective_date")))

                if not product_code or not fee_type_str or not effective_date:
                    continue

                fee_type_map = {
                    "管理费": "management",
                    "management": "management",
                    "托管费": "custodian",
                    "custodian": "custodian",
                    "销售服务费": "sales_service",
                    "sales_service": "sales_service",
                    "销售": "sales_service",
                }
                fee_type = fee_type_map.get(fee_type_str)
                if not fee_type:
                    continue

                share_caliber_map = {
                    "期初": "beginning",
                    "期初份额": "beginning",
                    "beginning": "beginning",
                    "期末": "ending",
                    "期末份额": "ending",
                    "ending": "ending",
                    "平均": "average",
                    "平均份额": "average",
                    "average": "average",
                    "日均": "daily",
                    "日均余额": "daily",
                    "daily": "daily",
                }

                accrual_map = {
                    "日": "daily",
                    "按日": "daily",
                    "daily": "daily",
                    "月": "monthly",
                    "按月": "monthly",
                    "monthly": "monthly",
                    "季": "quarterly",
                    "按季": "quarterly",
                    "quarterly": "quarterly",
                }

                product_id = self._get_or_create_product_id(
                    session,
                    product_code,
                    str(row.get("产品名称", row.get("product_name", ""))).strip() or None
                )
                if not product_id:
                    continue

                rate = self._parse_decimal(row.get("费率", row.get("rate")))
                if rate is None:
                    continue

                data = {
                    "product_id": product_id,
                    "fee_type": fee_type,
                    "rate": rate,
                    "effective_date": effective_date,
                    "expire_date": self._parse_date(row.get("失效日期", row.get("expire_date"))),
                    "share_caliber": share_caliber_map.get(
                        str(row.get("份额口径", row.get("share_caliber", ""))).strip().lower(),
                        "average"
                    ),
                    "accrual_method": accrual_map.get(
                        str(row.get("计提方式", row.get("accrual_method", ""))).strip().lower(),
                        "daily"
                    ),
                    "calculation_basis": str(row.get("计算基础", row.get("calculation_basis", ""))).strip() or None,
                    "payer": str(row.get("支付方", row.get("payer", ""))).strip() or None,
                    "receiver": str(row.get("收取方", row.get("receiver", ""))).strip() or None,
                    "tax_rate": self._parse_decimal(row.get("税率", row.get("tax_rate"))) or Decimal("0"),
                    "min_fee": self._parse_decimal(row.get("最低费用", row.get("min_fee"))),
                    "max_fee": self._parse_decimal(row.get("最高费用", row.get("max_fee"))),
                    "memo": str(row.get("备注", row.get("memo", ""))).strip() or None,
                }

                unique_keys = {
                    "product_id": data["product_id"],
                    "fee_type": data["fee_type"],
                    "effective_date": data["effective_date"]
                }
                status, entity_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=FeeRule,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=self.operator,
                    update_mode=update_mode,
                    import_reason=reason
                )

                identifier = f"{product_code}-{fee_type}-{effective_date}"
                result.add_result(status, "FeeRule", entity_id, identifier, changes)

        self.db.update_batch_stats(
            batch_id=batch.id,
            new_records=result.new,
            skip_records=result.skip,
            update_records=result.update,
            conflict_records=result.conflict
        )
        return result

    def import_nav_flows(
        self,
        file_path: str,
        update_mode: str = "prompt",
        reason: Optional[str] = None
    ) -> ImportResult:
        df = self._read_file(file_path)
        batch = self.db.create_batch(
            source_type="nav_flow",
            source_file=file_path,
            operator=self.operator,
            remark=reason
        )
        result = ImportResult(batch.id, batch.batch_no)

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                product_code = str(row.get("产品代码", row.get("product_code", ""))).strip()
                nav_date = self._parse_date(row.get("净值日期", row.get("nav_date")))

                if not product_code or not nav_date:
                    continue

                product_id = self._get_or_create_product_id(
                    session,
                    product_code,
                    str(row.get("产品名称", row.get("product_name", ""))).strip() or None
                )
                if not product_id:
                    continue

                unit_nav = self._parse_decimal(row.get("单位净值", row.get("unit_nav")))
                total_share = self._parse_decimal(row.get("总份额", row.get("total_share")))
                total_asset = self._parse_decimal(row.get("总资产", row.get("total_asset")))

                if unit_nav is None or total_share is None or total_asset is None:
                    continue

                data = {
                    "product_id": product_id,
                    "nav_date": nav_date,
                    "unit_nav": unit_nav,
                    "cumulative_nav": self._parse_decimal(row.get("累计净值", row.get("cumulative_nav"))) or unit_nav,
                    "total_share": total_share,
                    "total_asset": total_asset,
                    "daily_profit": self._parse_decimal(row.get("当日收益", row.get("daily_profit"))),
                    "dividend_amount": self._parse_decimal(row.get("分红金额", row.get("dividend_amount"))),
                    "memo": str(row.get("备注", row.get("memo", ""))).strip() or None,
                }

                unique_keys = {
                    "product_id": data["product_id"],
                    "nav_date": data["nav_date"]
                }
                status, entity_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=NavFlow,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=self.operator,
                    update_mode=update_mode,
                    import_reason=reason
                )

                identifier = f"{product_code}-{nav_date}"
                result.add_result(status, "NavFlow", entity_id, identifier, changes)

        self.db.update_batch_stats(
            batch_id=batch.id,
            new_records=result.new,
            skip_records=result.skip,
            update_records=result.update,
            conflict_records=result.conflict
        )
        return result

    def import_channels(
        self,
        file_path: str,
        update_mode: str = "prompt",
        reason: Optional[str] = None
    ) -> ImportResult:
        df = self._read_file(file_path)
        batch = self.db.create_batch(
            source_type="channel",
            source_file=file_path,
            operator=self.operator,
            remark=reason
        )
        result = ImportResult(batch.id, batch.batch_no)

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                channel_code = str(row.get("渠道代码", row.get("channel_code", ""))).strip()
                channel_name = str(row.get("渠道名称", row.get("channel_name", ""))).strip()

                if not channel_code or not channel_name:
                    continue

                data = {
                    "channel_code": channel_code,
                    "channel_name": channel_name,
                    "channel_type": str(row.get("渠道类型", row.get("channel_type", ""))).strip() or None,
                    "settlement_method": str(row.get("结算方式", row.get("settlement_method", ""))).strip() or None,
                    "settlement_cycle": str(row.get("结算周期", row.get("settlement_cycle", ""))).strip() or None,
                    "contact_person": str(row.get("联系人", row.get("contact_person", ""))).strip() or None,
                    "contact_info": str(row.get("联系方式", row.get("contact_info", ""))).strip() or None,
                    "memo": str(row.get("备注", row.get("memo", ""))).strip() or None,
                }

                unique_keys = {"channel_code": data["channel_code"]}
                status, entity_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=SalesChannel,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=self.operator,
                    update_mode=update_mode,
                    import_reason=reason
                )

                identifier = f"{channel_code}-{channel_name}"
                result.add_result(status, "SalesChannel", entity_id, identifier, changes)

        self.db.update_batch_stats(
            batch_id=batch.id,
            new_records=result.new,
            skip_records=result.skip,
            update_records=result.update,
            conflict_records=result.conflict
        )
        return result

    def import_customer_shares(
        self,
        file_path: str,
        update_mode: str = "prompt",
        reason: Optional[str] = None
    ) -> ImportResult:
        df = self._read_file(file_path)
        batch = self.db.create_batch(
            source_type="customer_share",
            source_file=file_path,
            operator=self.operator,
            remark=reason
        )
        result = ImportResult(batch.id, batch.batch_no)

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                product_code = str(row.get("产品代码", row.get("product_code", ""))).strip()
                channel_code = str(row.get("渠道代码", row.get("channel_code", ""))).strip()
                customer_id = str(row.get("客户编号", row.get("customer_id", ""))).strip()
                share_date = self._parse_date(row.get("份额日期", row.get("share_date")))
                share_amount = self._parse_decimal(row.get("持有份额", row.get("share_amount")))

                if not all([product_code, channel_code, customer_id, share_date, share_amount]):
                    continue

                product_id = self._get_or_create_product_id(
                    session,
                    product_code,
                    str(row.get("产品名称", row.get("product_name", ""))).strip() or None
                )
                channel_id = self._get_or_create_channel_id(
                    session,
                    channel_code,
                    str(row.get("渠道名称", row.get("channel_name", ""))).strip() or None
                )

                if not product_id or not channel_id:
                    continue

                data = {
                    "product_id": product_id,
                    "channel_id": channel_id,
                    "customer_id": customer_id,
                    "customer_name": str(row.get("客户名称", row.get("customer_name", ""))).strip() or None,
                    "share_date": share_date,
                    "share_amount": share_amount,
                    "share_ratio": self._parse_decimal(row.get("占比", row.get("share_ratio"))),
                    "cost_value": self._parse_decimal(row.get("成本", row.get("cost_value"))),
                    "profit_amount": self._parse_decimal(row.get("收益", row.get("profit_amount"))),
                    "memo": str(row.get("备注", row.get("memo", ""))).strip() or None,
                }

                unique_keys = {
                    "product_id": data["product_id"],
                    "channel_id": data["channel_id"],
                    "customer_id": data["customer_id"],
                    "share_date": data["share_date"]
                }
                status, entity_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=CustomerShare,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=self.operator,
                    update_mode=update_mode,
                    import_reason=reason
                )

                identifier = f"{product_code}-{channel_code}-{customer_id}-{share_date}"
                result.add_result(status, "CustomerShare", entity_id, identifier, changes)

        self.db.update_batch_stats(
            batch_id=batch.id,
            new_records=result.new,
            skip_records=result.skip,
            update_records=result.update,
            conflict_records=result.conflict
        )
        return result

    def import_channel_rebates(
        self,
        file_path: str,
        update_mode: str = "prompt",
        reason: Optional[str] = None
    ) -> ImportResult:
        df = self._read_file(file_path)
        batch = self.db.create_batch(
            source_type="channel_rebate",
            source_file=file_path,
            operator=self.operator,
            remark=reason
        )
        result = ImportResult(batch.id, batch.batch_no)

        with self.db.get_session() as session:
            for _, row in df.iterrows():
                channel_code = str(row.get("渠道代码", row.get("channel_code", ""))).strip()
                product_code = str(row.get("产品代码", row.get("product_code", ""))).strip()
                period_start = self._parse_date(row.get("开始日期", row.get("period_start")))
                period_end = self._parse_date(row.get("结束日期", row.get("period_end")))
                rebate_rate = self._parse_decimal(row.get("返费比例", row.get("rebate_rate")))

                if not all([channel_code, product_code, period_start, period_end, rebate_rate]):
                    continue

                channel_id = self._get_or_create_channel_id(
                    session,
                    channel_code,
                    str(row.get("渠道名称", row.get("channel_name", ""))).strip() or None
                )
                product_id = self._get_or_create_product_id(
                    session,
                    product_code,
                    str(row.get("产品名称", row.get("product_name", ""))).strip() or None
                )

                if not channel_id or not product_id:
                    continue

                status_map = {
                    "待结算": "pending",
                    "pending": "pending",
                    "已结算": "settled",
                    "settled": "settled",
                    "已开票": "invoiced",
                    "invoiced": "invoiced",
                }

                data = {
                    "channel_id": channel_id,
                    "product_id": product_id,
                    "period_start": period_start,
                    "period_end": period_end,
                    "rebate_rate": rebate_rate,
                    "rebate_base": str(row.get("计算基数", row.get("rebate_base", ""))).strip() or None,
                    "rebate_amount": self._parse_decimal(row.get("返费金额", row.get("rebate_amount"))),
                    "settlement_status": status_map.get(
                        str(row.get("结算状态", row.get("settlement_status", ""))).strip().lower(),
                        "pending"
                    ),
                    "settlement_date": self._parse_date(row.get("结算日期", row.get("settlement_date"))),
                    "invoice_no": str(row.get("发票号", row.get("invoice_no", ""))).strip() or None,
                    "memo": str(row.get("备注", row.get("memo", ""))).strip() or None,
                }

                unique_keys = {
                    "channel_id": data["channel_id"],
                    "product_id": data["product_id"],
                    "period_start": data["period_start"],
                    "period_end": data["period_end"]
                }
                status, entity_id, changes = self.db.upsert_entity(
                    session=session,
                    model_class=ChannelRebate,
                    unique_keys=unique_keys,
                    data=data,
                    batch_id=batch.id,
                    operator=self.operator,
                    update_mode=update_mode,
                    import_reason=reason
                )

                identifier = f"{channel_code}-{product_code}-{period_start}-{period_end}"
                result.add_result(status, "ChannelRebate", entity_id, identifier, changes)

        self.db.update_batch_stats(
            batch_id=batch.id,
            new_records=result.new,
            skip_records=result.skip,
            update_records=result.update,
            conflict_records=result.conflict
        )
        return result

    def add_verbal_note(
        self,
        entity_type: str,
        entity_id: int,
        content: str,
        note_from: str,
        description: Optional[str] = None,
        reason: Optional[str] = None
    ):
        batch = self.db.create_batch(
            source_type="verbal_note",
            operator=self.operator,
            remark=reason
        )
        note_file = f"verbal_note_{batch.batch_no}.txt"
        note_path = Path(Config.ATTACHMENT_DIR) / note_file
        note_path.write_text(content, encoding="utf-8")

        return self.db.add_attachment(
            attachment_type="verbal_note",
            entity_type=entity_type,
            entity_id=entity_id,
            file_name=note_file,
            file_path=str(note_path),
            uploaded_by=self.operator,
            file_size=len(content),
            description=description,
            is_verbal_note=True,
            verbal_note_content=content,
            verbal_note_from=note_from,
            import_batch_id=batch.id
        )

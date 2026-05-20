import csv
import re
from datetime import date, datetime
from typing import List, Dict, Any, Optional
from io import StringIO
from markdown import Markdown

from models.inventory import InventoryItem, MaterialType, InventoryStatus
from models.recall import RecallNotice, RecallBatch, RecallLevel, RecallStatus
from models.consumption import ConsumptionItem
from utils.storage import store


class InventoryCSVParser:
    REQUIRED_FIELDS = ['批号', '物料名称', '物料类型', '规格型号', '数量', '生产日期', '有效期至', '门店名称']

    def parse(self, content: str) -> List[InventoryItem]:
        items = []
        reader = csv.DictReader(StringIO(content))

        for row in reader:
            try:
                material_type = self._parse_material_type(row.get('物料类型', ''))
                manufacture_date = self._parse_date(row.get('生产日期', ''))
                expiry_date = self._parse_date(row.get('有效期至', ''))
                inbound_date = self._parse_date(row.get('入库日期', '')) if row.get('入库日期') else None

                item = InventoryItem(
                    batch_number=row.get('批号', '').strip(),
                    material_name=row.get('物料名称', '').strip(),
                    material_type=material_type,
                    specification=row.get('规格型号', '').strip(),
                    quantity=int(row.get('数量', 0)),
                    unit=row.get('单位', '支').strip(),
                    manufacture_date=manufacture_date,
                    expiry_date=expiry_date,
                    store_name=row.get('门店名称', '').strip(),
                    warehouse_location=row.get('库位', '').strip() or None,
                    supplier=row.get('供应商', '').strip() or None,
                    inbound_date=inbound_date,
                    status=self._check_status(expiry_date),
                    remarks=row.get('备注', '').strip() or None
                )
                items.append(item)
            except Exception as e:
                print(f"解析行失败: {row}, 错误: {e}")
                continue

        return items

    def _parse_material_type(self, value: str) -> MaterialType:
        value = value.strip()
        if '种植体' in value:
            return MaterialType.IMPLANT
        elif '麻药' in value or '麻醉' in value:
            return MaterialType.ANESTHETIC
        elif '包材' in value or '包装' in value:
            return MaterialType.PACKAGING
        return MaterialType.OTHER

    def _parse_date(self, value: str) -> date:
        value = value.strip()
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d', '%Y-%m']:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {value}")

    def _check_status(self, expiry_date: date) -> InventoryStatus:
        today = date.today()
        days_to_expiry = (expiry_date - today).days
        if days_to_expiry < 0:
            return InventoryStatus.EXPIRED
        elif days_to_expiry <= 90:
            return InventoryStatus.NEAR_EXPIRY
        return InventoryStatus.NORMAL


class RecallMarkdownParser:
    def parse(self, content: str) -> RecallNotice:
        lines = content.split('\n')
        title = ""
        notice_number = ""
        issuer = ""
        issue_date = None
        effective_date = None
        recall_level = RecallLevel.LEVEL_2
        material_name = ""
        batches = []
        reason = ""
        requirements = ""

        current_section = None
        batch_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith('# '):
                title = line[2:].strip()
            elif line.startswith('## '):
                section = line[3:].strip()
                if '批号' in section or '召回范围' in section or '产品批号' in section:
                    current_section = 'batches'
                elif '原因' in section:
                    current_section = 'reason'
                elif '要求' in section or '措施' in section:
                    current_section = 'requirements'
                else:
                    current_section = None
            elif current_section == 'batches':
                batch_lines.append(line)
            elif current_section == 'reason':
                reason += line + " "
            elif current_section == 'requirements':
                requirements += line + " "
            else:
                self._parse_metadata_line(line, locals())

        batches = self._parse_batches(batch_lines)

        return RecallNotice(
            notice_number=notice_number or f"RC{datetime.now().strftime('%Y%m%d%H%M')}",
            title=title or "产品召回公告",
            issuer=issuer or "药品监督管理局",
            issue_date=issue_date or date.today(),
            effective_date=effective_date or date.today(),
            recall_level=recall_level,
            material_name=material_name or batches[0].batch_number if batches else "未知产品",
            batches=batches,
            reason=reason.strip() or "存在安全隐患",
            requirements=requirements.strip() or "请立即停止使用并召回"
        )

    def _parse_metadata_line(self, line: str, locals_dict: Dict[str, Any]):
        match = re.search(r'公告编号[：:]\s*(\S+)', line)
        if match:
            locals_dict['notice_number'] = match.group(1)

        match = re.search(r'发布机构[：:]\s*(.+)', line)
        if match:
            locals_dict['issuer'] = match.group(1).strip()

        match = re.search(r'发布日期[：:]\s*(\S+)', line)
        if match:
            locals_dict['issue_date'] = self._try_parse_date(match.group(1))

        match = re.search(r'生效日期[：:]\s*(\S+)', line)
        if match:
            locals_dict['effective_date'] = self._try_parse_date(match.group(1))

        match = re.search(r'召回级别[：:]\s*(.+)', line)
        if match:
            level_text = match.group(1)
            if '一级' in level_text:
                locals_dict['recall_level'] = RecallLevel.LEVEL_1
            elif '三级' in level_text:
                locals_dict['recall_level'] = RecallLevel.LEVEL_3

        match = re.search(r'产品名称[：:]\s*(.+)', line)
        if match:
            locals_dict['material_name'] = match.group(1).strip()

    def _parse_batches(self, lines: List[str]) -> List[RecallBatch]:
        batches = []
        batch_patterns = [
            r'批号[：:]\s*(\S+)',
            r'[（(](\w{6,})[）)]',
            r'^([A-Z0-9-]{6,})\s*$'
        ]

        for line in lines:
            for pattern in batch_patterns:
                match = re.search(pattern, line)
                if match:
                    batch_num = match.group(1)
                    if not any(b.batch_number == batch_num for b in batches):
                        batches.append(RecallBatch(batch_number=batch_num))
                    break

        if not batches:
            for line in lines:
                tokens = re.findall(r'[A-Z0-9]{5,}', line)
                for token in tokens:
                    if len(token) >= 5 and not any(b.batch_number == token for b in batches):
                        batches.append(RecallBatch(batch_number=token))

        return batches or [RecallBatch(batch_number="UNKNOWN")]

    def _try_parse_date(self, value: str) -> Optional[date]:
        try:
            for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y年%m月%d日']:
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue
        except:
            pass
        return date.today()


class ConsumptionCSVParser:
    REQUIRED_FIELDS = ['批号', '物料名称', '规格型号', '数量', '消耗日期', '门店名称']

    def parse(self, content: str) -> List[ConsumptionItem]:
        items = []
        reader = csv.DictReader(StringIO(content))

        for row in reader:
            try:
                consumption_date = self._parse_date(row.get('消耗日期', ''))
                is_transfer = row.get('是否调拨', '否') in ['是', 'true', 'True', '1']

                item = ConsumptionItem(
                    batch_number=row.get('批号', '').strip(),
                    material_name=row.get('物料名称', '').strip(),
                    specification=row.get('规格型号', '').strip(),
                    quantity=int(row.get('数量', 0)),
                    unit=row.get('单位', '支').strip(),
                    consumption_date=consumption_date,
                    store_name=row.get('门店名称', '').strip(),
                    patient_id=row.get('患者ID', '').strip() or None,
                    doctor_name=row.get('医生姓名', '').strip() or None,
                    is_transfer=is_transfer,
                    transfer_from_store=row.get('调拨来源', '').strip() or None,
                    transfer_to_store=row.get('调拨目标', '').strip() or None,
                    remarks=row.get('备注', '').strip() or None
                )
                items.append(item)
            except Exception as e:
                print(f"解析行失败: {row}, 错误: {e}")
                continue

        return items

    def _parse_date(self, value: str) -> date:
        value = value.strip()
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"无法解析日期: {value}")


class ImportService:
    def __init__(self):
        self.inventory_parser = InventoryCSVParser()
        self.recall_parser = RecallMarkdownParser()
        self.consumption_parser = ConsumptionCSVParser()

    def import_inventory(self, csv_content: str) -> Dict[str, Any]:
        items = self.inventory_parser.parse(csv_content)
        imported_ids = []
        for item in items:
            item_id = store.add('inventory', item)
            imported_ids.append(item_id)

        return {
            "success": True,
            "count": len(items),
            "imported_ids": imported_ids,
            "message": f"成功导入 {len(items)} 条库存记录"
        }

    def import_recall(self, md_content: str) -> Dict[str, Any]:
        notice = self.recall_parser.parse(md_content)
        notice_id = store.add('recall', notice)
        return {
            "success": True,
            "notice_id": notice_id,
            "notice": notice.model_dump(),
            "message": f"成功导入召回公告: {notice.title}"
        }

    def import_consumption(self, csv_content: str) -> Dict[str, Any]:
        items = self.consumption_parser.parse(csv_content)
        imported_ids = []
        for item in items:
            item_id = store.add('consumption', item)
            imported_ids.append(item_id)

        return {
            "success": True,
            "count": len(items),
            "imported_ids": imported_ids,
            "message": f"成功导入 {len(items)} 条消耗记录"
        }


import_service = ImportService()

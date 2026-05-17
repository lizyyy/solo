from datetime import datetime, date
from typing import List, Optional, Dict, Tuple
from models import (
    Customer, StorageItem, UsageRecord, TransferRequest,
    TransferStatus, ProductCategory, DataStore, generate_id,
    validate_date, validate_phone
)


class ValidationError(Exception):
    pass


class StorageService:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store

    def add_customer(self, name: str, phone: str) -> Tuple[Optional[Customer], List[str]]:
        errors = []

        if not name or len(name.strip()) == 0:
            errors.append("客户姓名不能为空")

        if not validate_phone(phone):
            errors.append("手机号格式不正确，需要至少10位数字")

        for cust in self.data_store.customers.values():
            if cust.phone == phone:
                errors.append(f"手机号 {phone} 已被注册")

        if errors:
            return None, errors

        customer = Customer(
            customer_id=generate_id(),
            name=name.strip(),
            phone=phone.strip()
        )
        self.data_store.customers[customer.customer_id] = customer
        self.data_store.save_all()
        return customer, []

    def get_customer(self, customer_id: str) -> Optional[Customer]:
        return self.data_store.customers.get(customer_id)

    def find_customer_by_phone(self, phone: str) -> Optional[Customer]:
        for cust in self.data_store.customers.values():
            if cust.phone == phone:
                return cust
        return None

    def add_storage(self, customer_id: str, product_name: str, category: str,
                    batch_no: str, expiry_date: str, quantity: int, unit: str) -> Tuple[Optional[StorageItem], List[str]]:
        errors = []

        if customer_id not in self.data_store.customers:
            errors.append(f"客户ID {customer_id} 不存在")

        if not product_name or len(product_name.strip()) == 0:
            errors.append("商品名称不能为空")

        if not batch_no or len(batch_no.strip()) == 0:
            errors.append("批次号不能为空")

        if not validate_date(expiry_date):
            errors.append("效期日期格式不正确，应使用 YYYY-MM-DD 格式")

        if quantity <= 0:
            errors.append("数量必须大于0")

        if not unit or len(unit.strip()) == 0:
            errors.append("单位不能为空")

        category_map = {
            "milk_powder": ProductCategory.MILK_POWDER,
            "diaper": ProductCategory.DIAPER,
            "奶粉": ProductCategory.MILK_POWDER,
            "尿裤": ProductCategory.DIAPER,
            "其他": ProductCategory.OTHER,
        }
        category_enum = category_map.get(category.lower(), ProductCategory.OTHER)

        if errors:
            return None, errors

        storage = StorageItem(
            storage_id=generate_id(),
            customer_id=customer_id,
            product_name=product_name.strip(),
            category=category,
            category_enum=category_enum,
            batch_no=batch_no.strip(),
            expiry_date=expiry_date,
            quantity=quantity,
            unit=unit.strip()
        )
        self.data_store.storage_items[storage.storage_id] = storage
        self.data_store.save_all()
        return storage, []

    def use_storage(self, storage_id: str, quantity: int, notes: str = "") -> Tuple[Optional[UsageRecord], List[str]]:
        errors = []

        if storage_id not in self.data_store.storage_items:
            errors.append(f"寄存ID {storage_id} 不存在")
            return None, errors

        storage = self.data_store.storage_items[storage_id]

        if quantity <= 0:
            errors.append("领用数量必须大于0")

        if quantity > storage.quantity:
            errors.append(f"领用数量 {quantity} 超过库存 {storage.quantity}")

        if storage.is_expired():
            errors.append(f"商品已过期，效期至 {storage.expiry_date}")

        if errors:
            return None, errors

        storage.quantity -= quantity

        record = UsageRecord(
            usage_id=generate_id(),
            storage_id=storage_id,
            customer_id=storage.customer_id,
            quantity=quantity,
            notes=notes
        )
        self.data_store.usage_records.append(record)

        if storage.quantity == 0:
            del self.data_store.storage_items[storage_id]

        self.data_store.save_all()
        return record, []

    def create_transfer_request(self, from_customer_id: str, to_customer_id: str,
                                storage_id: str, quantity: int, notes: str = "") -> Tuple[Optional[TransferRequest], List[str]]:
        errors = []

        if from_customer_id not in self.data_store.customers:
            errors.append(f"转出客户ID {from_customer_id} 不存在")

        if to_customer_id not in self.data_store.customers:
            errors.append(f"转入客户ID {to_customer_id} 不存在")

        if from_customer_id == to_customer_id:
            errors.append("转出和转入客户不能相同")

        if storage_id not in self.data_store.storage_items:
            errors.append(f"寄存ID {storage_id} 不存在")
        else:
            storage = self.data_store.storage_items[storage_id]
            if storage.customer_id != from_customer_id:
                errors.append("该寄存不属于转出客户")
            if quantity <= 0:
                errors.append("转赠数量必须大于0")
            if quantity > storage.quantity:
                errors.append(f"转赠数量 {quantity} 超过库存 {storage.quantity}")
            if storage.is_expired():
                errors.append(f"商品已过期，不能转赠，效期至 {storage.expiry_date}")

        if errors:
            return None, errors

        request = TransferRequest(
            transfer_id=generate_id(),
            from_customer_id=from_customer_id,
            to_customer_id=to_customer_id,
            storage_id=storage_id,
            quantity=quantity,
            status=TransferStatus.PENDING,
            notes=notes
        )
        self.data_store.transfer_requests[request.transfer_id] = request
        self.data_store.save_all()
        return request, []

    def approve_transfer(self, transfer_id: str, approved_by: str = "system") -> Tuple[Optional[TransferRequest], List[str]]:
        errors = []

        if transfer_id not in self.data_store.transfer_requests:
            errors.append(f"转赠申请ID {transfer_id} 不存在")
            return None, errors

        request = self.data_store.transfer_requests[transfer_id]

        if request.status != TransferStatus.PENDING:
            errors.append(f"转赠申请状态为 {request.status.value}，不能审批")

        storage = self.data_store.storage_items.get(request.storage_id)
        if not storage:
            errors.append("寄存商品已不存在")
        elif request.quantity > storage.quantity:
            errors.append(f"转赠数量 {request.quantity} 超过当前库存 {storage.quantity}")

        if errors:
            return None, errors

        request.status = TransferStatus.APPROVED
        request.approved_at = datetime.now().isoformat()
        request.approved_by = approved_by

        storage.quantity -= request.quantity

        new_storage = StorageItem(
            storage_id=generate_id(),
            customer_id=request.to_customer_id,
            product_name=storage.product_name,
            category=storage.category,
            category_enum=storage.category_enum,
            batch_no=storage.batch_no,
            expiry_date=storage.expiry_date,
            quantity=request.quantity,
            unit=storage.unit
        )
        self.data_store.storage_items[new_storage.storage_id] = new_storage

        if storage.quantity == 0:
            del self.data_store.storage_items[storage.storage_id]

        self.data_store.save_all()
        return request, []

    def reject_transfer(self, transfer_id: str, approved_by: str = "system") -> Tuple[Optional[TransferRequest], List[str]]:
        errors = []

        if transfer_id not in self.data_store.transfer_requests:
            errors.append(f"转赠申请ID {transfer_id} 不存在")
            return None, errors

        request = self.data_store.transfer_requests[transfer_id]

        if request.status != TransferStatus.PENDING:
            errors.append(f"转赠申请状态为 {request.status.value}，不能审批")

        if errors:
            return None, errors

        request.status = TransferStatus.REJECTED
        request.approved_at = datetime.now().isoformat()
        request.approved_by = approved_by

        self.data_store.save_all()
        return request, []

    def get_expiring_items(self, days: int = 30) -> List[StorageItem]:
        items = []
        check_date = date.today()
        for item in self.data_store.storage_items.values():
            days_left = item.days_until_expiry(check_date)
            if days_left <= days and days_left >= 0:
                items.append(item)
        return sorted(items, key=lambda x: x.days_until_expiry())

    def get_expired_items(self) -> List[StorageItem]:
        return [item for item in self.data_store.storage_items.values() if item.is_expired()]

    def get_customer_storage(self, customer_id: str) -> List[StorageItem]:
        return [
            item for item in self.data_store.storage_items.values()
            if item.customer_id == customer_id
        ]

    def get_pending_transfers(self) -> List[TransferRequest]:
        return [
            req for req in self.data_store.transfer_requests.values()
            if req.status == TransferStatus.PENDING
        ]

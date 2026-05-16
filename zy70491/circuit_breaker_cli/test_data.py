from typing import List, Optional
from uuid import uuid4
from datetime import datetime

from .models import HandoverRecord, Material, Attachment
from .storage import Storage


class TestDataGenerator:
    def __init__(self, storage: Storage):
        self.storage = storage

    def create_normal_materials(self) -> List[Material]:
        """创建一组正常材料"""
        materials = []

        mat1 = Material(
            id=str(uuid4()),
            name="会员续费流水表",
            type="财务报表",
            content={
                "period": "2024-Q1",
                "total_amount": 150000,
                "member_count": 1250
            },
            attachments=[
                Attachment(
                    id=str(uuid4()),
                    name="2024-Q1_续费流水.xlsx",
                    file_path="/data/attachments/2024-Q1_renewal.xlsx",
                    upload_time=datetime.now(),
                    expire_time=datetime(2027, 12, 31)
                )
            ]
        )
        materials.append(mat1)

        mat2 = Material(
            id=str(uuid4()),
            name="代码仓库权限清单",
            type="权限文档",
            content={
                "repo_count": 15,
                "admin_users": ["admin1", "admin2"],
                "developer_users": ["dev1", "dev2", "dev3"]
            },
            attachments=[
                Attachment(
                    id=str(uuid4()),
                    name="仓库权限清单_2024.pdf",
                    file_path="/data/attachments/repo_permissions_2024.pdf",
                    upload_time=datetime.now(),
                    expire_time=datetime(2027, 6, 30)
                )
            ]
        )
        materials.append(mat2)

        mat3 = Material(
            id=str(uuid4()),
            name="服务器资产清单",
            type="资产管理",
            content={
                "server_count": 8,
                "total_cpu": 64,
                "total_memory": "256GB",
                "total_storage": "4TB"
            },
            attachments=[
                Attachment(
                    id=str(uuid4()),
                    name="服务器资产清单_2024.xlsx",
                    file_path="/data/attachments/server_assets_2024.xlsx",
                    upload_time=datetime.now(),
                    expire_time=None
                )
            ]
        )
        materials.append(mat3)

        return materials

    def create_expired_materials(self) -> List[Material]:
        """创建一组包含过期附件的材料"""
        materials = []

        mat1 = Material(
            id=str(uuid4()),
            name="会员续费流水表",
            type="财务报表",
            content={
                "period": "2023-Q4",
                "total_amount": 120000,
                "member_count": 1000
            },
            attachments=[
                Attachment(
                    id=str(uuid4()),
                    name="2023-Q4_续费流水.xlsx",
                    file_path="/data/attachments/2023-Q4_renewal.xlsx",
                    upload_time=datetime(2023, 12, 1),
                    expire_time=datetime(2024, 3, 31)
                )
            ]
        )
        materials.append(mat1)

        mat2 = Material(
            id=str(uuid4()),
            name="SSL证书清单",
            type="安全文档",
            content={
                "cert_count": 5,
                "domains": ["example.com", "api.example.com"]
            },
            attachments=[
                Attachment(
                    id=str(uuid4()),
                    name="SSL证书_2023.pdf",
                    file_path="/data/attachments/ssl_certs_2023.pdf",
                    upload_time=datetime(2023, 1, 1),
                    expire_time=datetime(2024, 1, 1)
                )
            ]
        )
        materials.append(mat2)

        return materials

    def create_normal_handover_record(self) -> HandoverRecord:
        """创建正常交接单记录"""
        record = HandoverRecord(
            id=str(uuid4()),
            title="2024年Q1仓库交接单",
            description="第一季度代码仓库及相关资产交接",
            operator="张三",
            materials=self.create_normal_materials()
        )
        return record

    def create_abnormal_handover_record(self) -> HandoverRecord:
        """创建包含过期附件的交接单记录"""
        record = HandoverRecord(
            id=str(uuid4()),
            title="2023年Q4仓库交接单",
            description="第四季度代码仓库及相关资产交接（包含过期附件）",
            operator="李四",
            materials=self.create_expired_materials()
        )
        return record

    def generate_test_data(self) -> None:
        """生成测试数据"""
        normal_record = self.create_normal_handover_record()
        self.storage.save_record(normal_record)

        abnormal_record = self.create_abnormal_handover_record()
        self.storage.save_record(abnormal_record)

        print(f"测试数据已生成:")
        print(f"  - 正常记录: {normal_record.id}")
        print(f"  - 异常记录: {abnormal_record.id}")
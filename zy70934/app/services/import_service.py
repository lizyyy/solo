import pandas as pd
import json
from typing import List, Dict, Any, Tuple
from io import StringIO, BytesIO
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.models import ConstructionNode, PhotoRecord, RectificationOrder, Project
from app.utils.helpers import parse_date, parse_float, parse_int
from app.schemas.schemas import ImportResult


class DataImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_nodes_csv(self, project_id: int, file_content: bytes, filename: str) -> ImportResult:
        try:
            df = pd.read_csv(BytesIO(file_content))
            df = df.where(pd.notnull(df), None)
            
            imported_count = 0
            errors = []
            
            for idx, row in df.iterrows():
                try:
                    node_code = str(row.get("节点编码") or row.get("node_code") or row.get("code") or "")
                    node_name = str(row.get("节点名称") or row.get("node_name") or row.get("name") or "")
                    
                    if not node_code and not node_name:
                        errors.append(f"第{idx+2}行：缺少节点编码或名称")
                        continue
                    
                    existing = self.db.query(ConstructionNode).filter(
                        ConstructionNode.project_id == project_id,
                        ConstructionNode.node_code == node_code
                    ).first()
                    
                    if existing:
                        existing.node_name = node_name or existing.node_name
                        existing.node_type = str(row.get("节点类型") or row.get("node_type") or existing.node_type)
                        existing.planned_date = parse_date(row.get("计划完成日期") or row.get("planned_date"))
                        existing.actual_date = parse_date(row.get("实际完成日期") or row.get("actual_date"))
                        existing.node_amount = parse_float(row.get("节点金额") or row.get("amount") or row.get("node_amount"))
                        existing.required_photos = parse_int(row.get("要求照片数") or row.get("required_photos") or existing.required_photos)
                        existing.status = str(row.get("状态") or row.get("status") or existing.status)
                        existing.csv_source = filename
                        existing.csv_row_data = row.to_dict()
                    else:
                        node = ConstructionNode(
                            project_id=project_id,
                            node_code=node_code,
                            node_name=node_name,
                            node_type=str(row.get("节点类型") or row.get("node_type") or ""),
                            planned_date=parse_date(row.get("计划完成日期") or row.get("planned_date")),
                            actual_date=parse_date(row.get("实际完成日期") or row.get("actual_date")),
                            node_amount=parse_float(row.get("节点金额") or row.get("amount") or row.get("node_amount")),
                            required_photos=parse_int(row.get("要求照片数") or row.get("required_photos") or 0),
                            status=str(row.get("状态") or row.get("status") or "pending"),
                            csv_source=filename,
                            csv_row_data=row.to_dict()
                        )
                        self.db.add(node)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第{idx+2}行：{str(e)}")
            
            self.db.commit()
            return ImportResult(
                success=True,
                message=f"成功导入{imported_count}条节点数据",
                imported_count=imported_count,
                errors=errors
            )
        except Exception as e:
            self.db.rollback()
            return ImportResult(
                success=False,
                message=f"CSV导入失败：{str(e)}",
                imported_count=0,
                errors=[str(e)]
            )

    def import_photos_json(self, project_id: int, file_content: bytes, filename: str) -> ImportResult:
        try:
            content = file_content.decode("utf-8")
            photos_data = json.loads(content)
            
            if isinstance(photos_data, dict) and "photos" in photos_data:
                photos_data = photos_data["photos"]
            if not isinstance(photos_data, list):
                photos_data = [photos_data]
            
            imported_count = 0
            errors = []
            
            for idx, photo_data in enumerate(photos_data):
                try:
                    node_code = str(photo_data.get("节点编码") or photo_data.get("node_code") or "")
                    
                    node = self.db.query(ConstructionNode).filter(
                        ConstructionNode.project_id == project_id,
                        ConstructionNode.node_code == node_code
                    ).first()
                    
                    if not node:
                        errors.append(f"第{idx+1}条：找不到节点编码[{node_code}]对应的节点")
                        continue
                    
                    photo_id = str(photo_data.get("照片ID") or photo_data.get("photo_id") or photo_data.get("id") or "")
                    
                    existing = self.db.query(PhotoRecord).filter(
                        PhotoRecord.node_id == node.id,
                        PhotoRecord.photo_id == photo_id
                    ).first() if photo_id else None
                    
                    if existing:
                        existing.photo_name = str(photo_data.get("照片名称") or photo_data.get("photo_name") or existing.photo_name)
                        existing.photo_url = str(photo_data.get("照片URL") or photo_data.get("photo_url") or photo_data.get("url") or existing.photo_url)
                        existing.upload_time = parse_date(photo_data.get("上传时间") or photo_data.get("upload_time"))
                        existing.photo_type = str(photo_data.get("照片类型") or photo_data.get("photo_type") or existing.photo_type)
                        existing.uploader = str(photo_data.get("上传人") or photo_data.get("uploader") or existing.uploader)
                        existing.json_source = filename
                        existing.json_data = photo_data
                    else:
                        photo = PhotoRecord(
                            node_id=node.id,
                            photo_id=photo_id,
                            photo_name=str(photo_data.get("照片名称") or photo_data.get("photo_name") or ""),
                            photo_url=str(photo_data.get("照片URL") or photo_data.get("photo_url") or photo_data.get("url") or ""),
                            upload_time=parse_date(photo_data.get("上传时间") or photo_data.get("upload_time")),
                            photo_type=str(photo_data.get("照片类型") or photo_data.get("photo_type") or ""),
                            uploader=str(photo_data.get("上传人") or photo_data.get("uploader") or ""),
                            json_source=filename,
                            json_data=photo_data
                        )
                        self.db.add(photo)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第{idx+1}条：{str(e)}")
            
            self.db.commit()
            return ImportResult(
                success=True,
                message=f"成功导入{imported_count}条照片记录",
                imported_count=imported_count,
                errors=errors
            )
        except Exception as e:
            self.db.rollback()
            return ImportResult(
                success=False,
                message=f"JSON导入失败：{str(e)}",
                imported_count=0,
                errors=[str(e)]
            )

    def import_rectification_orders(self, project_id: int, file_content: bytes, filename: str) -> ImportResult:
        try:
            content = file_content.decode("utf-8-sig")
            
            if filename.endswith(".json"):
                orders_data = json.loads(content)
                if isinstance(orders_data, dict) and "orders" in orders_data:
                    orders_data = orders_data["orders"]
                if not isinstance(orders_data, list):
                    orders_data = [orders_data]
                rows = orders_data
            else:
                df = pd.read_csv(BytesIO(file_content))
                df = df.where(pd.notnull(df), None)
                rows = [row.to_dict() for _, row in df.iterrows()]
            
            imported_count = 0
            errors = []
            
            for idx, row_data in enumerate(rows):
                try:
                    order_no = str(row_data.get("整改单号") or row_data.get("order_no") or row_data.get("orderNo") or "")
                    node_code = str(row_data.get("节点编码") or row_data.get("node_code") or "")
                    
                    if not order_no:
                        errors.append(f"第{idx+1}条：缺少整改单号")
                        continue
                    
                    node = None
                    if node_code:
                        node = self.db.query(ConstructionNode).filter(
                            ConstructionNode.project_id == project_id,
                            ConstructionNode.node_code == node_code
                        ).first()
                    
                    existing = self.db.query(RectificationOrder).filter(
                        RectificationOrder.project_id == project_id,
                        RectificationOrder.order_no == order_no
                    ).first()
                    
                    if existing:
                        existing.node_id = node.id if node else existing.node_id
                        existing.issue_description = str(row_data.get("问题描述") or row_data.get("issue_description") or existing.issue_description)
                        existing.required_completion_date = parse_date(row_data.get("要求完成日期") or row_data.get("required_completion_date"))
                        existing.actual_completion_date = parse_date(row_data.get("实际完成日期") or row_data.get("actual_completion_date"))
                        existing.rectification_status = str(row_data.get("整改状态") or row_data.get("rectification_status") or existing.rectification_status)
                        existing.is_rework = bool(row_data.get("是否返工") or row_data.get("is_rework") or existing.is_rework)
                        existing.rework_count = parse_int(row_data.get("返工次数") or row_data.get("rework_count") or existing.rework_count)
                        existing.fine_amount = parse_float(row_data.get("扣款金额") or row_data.get("fine_amount") or existing.fine_amount)
                        existing.source_file = filename
                        existing.raw_data = row_data
                    else:
                        order = RectificationOrder(
                            project_id=project_id,
                            node_id=node.id if node else None,
                            order_no=order_no,
                            issue_description=str(row_data.get("问题描述") or row_data.get("issue_description") or ""),
                            required_completion_date=parse_date(row_data.get("要求完成日期") or row_data.get("required_completion_date")),
                            actual_completion_date=parse_date(row_data.get("实际完成日期") or row_data.get("actual_completion_date")),
                            rectification_status=str(row_data.get("整改状态") or row_data.get("rectification_status") or "pending"),
                            is_rework=bool(row_data.get("是否返工") or row_data.get("is_rework") or False),
                            rework_count=parse_int(row_data.get("返工次数") or row_data.get("rework_count") or 0),
                            fine_amount=parse_float(row_data.get("扣款金额") or row_data.get("fine_amount") or 0),
                            source_file=filename,
                            raw_data=row_data
                        )
                        self.db.add(order)
                    
                    imported_count += 1
                except Exception as e:
                    errors.append(f"第{idx+1}条：{str(e)}")
            
            self.db.commit()
            return ImportResult(
                success=True,
                message=f"成功导入{imported_count}条整改单",
                imported_count=imported_count,
                errors=errors
            )
        except Exception as e:
            self.db.rollback()
            return ImportResult(
                success=False,
                message=f"整改单导入失败：{str(e)}",
                imported_count=0,
                errors=[str(e)]
            )

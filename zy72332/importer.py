from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import uuid
import os
import hashlib
import struct
import zlib

from models import (
    StoreGroupingRecord, StudentAnswer, ScreenshotReference,
    RecordStatus, ProcessingType, AuditTrail
)
from store import DataStore


def _create_demo_png(file_path: str, formula_text: str) -> Tuple[int, str]:
    """创建一个带公式文本元数据的真实 PNG 文件

    返回: (文件字节数, sha256 hash)
    """
    signature = b'\x89PNG\r\n\x1a\n'
    width, height = 320, 240
    raw_data = b''
    text_bytes = formula_text.encode('utf-8')[:200]
    for y in range(height):
        raw_data += b'\x00'
        for x in range(width):
            idx = (y * width + x) % max(1, len(text_bytes))
            r = text_bytes[idx] if idx < len(text_bytes) else 128
            g = (r + 80) % 256
            b = (r + 160) % 256
            raw_data += bytes([r, g, b])

    def make_chunk(chunk_type: bytes, chunk_data: bytes) -> bytes:
        length = struct.pack('>I', len(chunk_data))
        crc = struct.pack('>I', zlib.crc32(chunk_type + chunk_data) & 0xffffffff)
        return length + chunk_type + chunk_data + crc

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    iend = b''
    png_bytes = signature + make_chunk(b'IHDR', ihdr)

    text_keyword = b'Formula\x00'
    text_chunk = make_chunk(b'tEXt', text_keyword + text_bytes)

    idat = make_chunk(b'IDAT', zlib.compress(raw_data, 9))
    iend_chunk = make_chunk(b'IEND', iend)

    data = png_bytes + text_chunk + idat + iend_chunk
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'wb') as f:
        f.write(data)

    size = len(data)
    sha = hashlib.sha256(data).hexdigest()
    return size, sha


def _compute_file_hash(file_path: str) -> Tuple[Optional[int], Optional[str]]:
    """计算文件的 size 和 sha256 hash。文件不存在则返回 (None, None)"""
    if not os.path.exists(file_path):
        return None, None
    size = os.path.getsize(file_path)
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while True:
            buf = f.read(65536)
            if not buf:
                break
            h.update(buf)
    return size, h.hexdigest()


class DataImporter:
    """数据导入模块 - 处理旧公式截图导入，检测重复答案"""

    def __init__(self, store: DataStore):
        self.store = store
        self._ensure_asset_dir()

    def _ensure_asset_dir(self) -> str:
        asset_dir = os.path.join(self.store.base_dir, "assets", "screenshots")
        os.makedirs(asset_dir, exist_ok=True)
        return asset_dir

    def import_screenshot(self, record_id: str, screenshot_path: str,
                          formula_text: str, description: str,
                          operator: str = "小祁",
                          processing_reason: Optional[str] = None,
                          create_asset_if_missing: bool = True) -> ScreenshotReference:
        """导入旧公式截图

        - 如果源文件不存在，且 create_asset_if_missing=True：创建真实带公式元数据的 PNG 资产
        - 计算 hash/size 并保存到 store/assets/screenshots/
        - 校验资产一致性
        """
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if not os.path.exists(screenshot_path) and create_asset_if_missing:
            os.makedirs(os.path.dirname(screenshot_path) or ".", exist_ok=True)
            _create_demo_png(screenshot_path, formula_text)

        file_size, file_hash = _compute_file_hash(screenshot_path)
        if file_hash is None:
            raise FileNotFoundError(f"截图文件不存在且无法创建: {screenshot_path}")

        asset_dir = self._ensure_asset_dir()
        ext = os.path.splitext(screenshot_path)[1] or ".png"
        stored_filename = f"{record_id}_{file_hash[:12]}{ext}"
        stored_path = os.path.join(asset_dir, stored_filename)
        if not os.path.exists(stored_path):
            with open(screenshot_path, 'rb') as sf, open(stored_path, 'wb') as df:
                df.write(sf.read())

        stored_size, stored_hash = _compute_file_hash(stored_path)
        valid = stored_hash == file_hash and stored_size == file_size

        reason = processing_reason or ("数据分析师小祁翻旧公式截图导入，处理原因："
                                       "业务运营晚上催结果，原公式需要作为证据留存")

        screenshot = ScreenshotReference(
            screenshot_id=f"shot_{uuid.uuid4().hex[:8]}",
            file_path=screenshot_path,
            description=description,
            imported_at=datetime.now(),
            formula_text=formula_text,
            file_hash=file_hash,
            file_size=file_size,
            stored_path=stored_path,
            validation_status=("校验通过" if valid else "校验失败：资产哈希不一致"),
            processing_reason=reason
        )
        record.screenshot_refs.append(screenshot)
        record.log_operation("导入旧公式截图", operator, {
            "screenshot_id": screenshot.screenshot_id,
            "description": description,
            "formula_text": formula_text,
            "file_hash": file_hash,
            "file_size": file_size,
            "stored_path": stored_path,
            "validation_status": screenshot.validation_status,
            "processing_reason": reason
        })

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "SCREENSHOT_IMPORTED",
                f"导入旧公式截图: {description} [{screenshot.validation_status}]",
                operator,
                {
                    "screenshot_id": screenshot.screenshot_id,
                    "formula": formula_text,
                    "file_hash": file_hash,
                    "file_size": file_size,
                    "stored_path": stored_path,
                    "validation_status": screenshot.validation_status,
                    "processing_reason": reason
                }
            )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return screenshot

    def import_student_answers(self, record_id: str,
                               answers_data: List[Dict[str, Any]],
                               operator: str = "小祁") -> Tuple[StoreGroupingRecord, List[StudentAnswer]]:
        """导入学生答案，自动检测同一学生交两版答案"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        imported_answers = []
        student_submissions: Dict[str, List[StudentAnswer]] = {}

        for ans_data in answers_data:
            answer = StudentAnswer(
                answer_id=ans_data.get("answer_id") or f"ans_{uuid.uuid4().hex[:8]}",
                student_id=ans_data["student_id"],
                student_name=ans_data["student_name"],
                submission_time=ans_data.get("submission_time", datetime.now()),
                content=ans_data["content"],
                version=ans_data.get("version", 1)
            )
            imported_answers.append(answer)
            record.student_answers.append(answer)

            if ans_data["student_id"] not in student_submissions:
                student_submissions[ans_data["student_id"]] = []
            student_submissions[ans_data["student_id"]].append(answer)

        detected_duplicates = []
        for student_id, submissions in student_submissions.items():
            if len(submissions) > 1:
                for ans in submissions:
                    ans.is_duplicate = True
                    detected_duplicates.append(ans)

        if detected_duplicates:
            record.status = RecordStatus.DUPLICATE_DETECTED
            record.error_explanation.update(
                f"检测到同一学生交了{len(detected_duplicates)}版答案，待业务运营复核后再处理",
                operator
            )
            record.log_operation("检测到重复答案", operator, {
                "duplicate_count": len(detected_duplicates),
                "students": list(student_submissions.keys())
            })
        else:
            record.status = RecordStatus.IMPORTED

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "ANSWERS_IMPORTED",
                f"导入{len(imported_answers)}条学生答案",
                operator,
                {
                    "total_imported": len(imported_answers),
                    "duplicate_detected": len(detected_duplicates) > 0,
                    "duplicate_count": len(detected_duplicates)
                }
            )
            if detected_duplicates:
                audit.add_event(
                    "DUPLICATE_DETECTED",
                    f"检测到同一学生交了{len(detected_duplicates)}版答案，不自动归正常，留给业务运营复核",
                    "系统自动检测",
                    {"student_ids": list(student_submissions.keys())}
                )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return record, imported_answers

    def create_new_record(self, store_id: str, store_name: str,
                          processing_type: ProcessingType,
                          operator: str = "小祁") -> StoreGroupingRecord:
        """创建新的门店分群记录"""
        record_id = f"rec_{uuid.uuid4().hex[:8]}"
        record = StoreGroupingRecord(
            record_id=record_id,
            store_id=store_id,
            store_name=store_name,
            processing_type=processing_type
        )

        audit = AuditTrail(
            trail_id=f"audit_{uuid.uuid4().hex[:8]}",
            record_id=record_id
        )
        audit.add_event(
            "RECORD_CREATED",
            f"创建门店分群记录: {store_name}",
            operator,
            {"store_id": store_id, "processing_type": processing_type.value}
        )

        self.store.save_record(record)
        self.store.save_audit_trail(audit)
        return record

    def mark_for_review(self, record_id: str, operator: str = "小祁") -> StoreGroupingRecord:
        """标记为待业务运营复核 - 检测到重复答案后的状态转换"""
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        record.status = RecordStatus.PENDING_REVIEW
        record.log_operation("提交业务运营复核", operator, {
            "reason": "存在同一学生多版答案，需要运营确认正确版本"
        })

        audit = self.store.get_audit_trail_by_record(record_id)
        if audit:
            audit.add_event(
                "PENDING_REVIEW",
                "标记为待业务运营复核，不自动归正常",
                operator,
                {"reason": "同一学生提交了多版答案"}
            )
            self.store.save_audit_trail(audit)

        self.store.save_record(record)
        return record

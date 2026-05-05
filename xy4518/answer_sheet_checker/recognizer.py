"""答题卡识别模块 - 条码检测和信息提取。"""

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from PIL import Image
from pyzbar.pyzbar import decode as pyzbar_decode

from .models import AnswerSheet


class SheetRecognizer:
    """答题卡识别器。"""

    BARCODE_PATTERN = re.compile(r"^\d{10,}$")
    PAGE_PATTERN = re.compile(r"(\d+)[/\-\s]*(\d+)?")

    @classmethod
    def recognize_file(cls, file_path: str) -> Optional[AnswerSheet]:
        """
        识别单个答题卡文件。

        Args:
            file_path: 文件路径

        Returns:
            AnswerSheet 对象或 None
        """
        path = Path(file_path)

        if not path.exists():
            return None

        ext = path.suffix.lower()

        if ext == ".pdf":
            return cls._recognize_pdf(file_path)
        elif ext in {".jpg", ".jpeg", ".png"}:
            return cls._recognize_image(file_path)
        else:
            return None

    @classmethod
    def _recognize_image(cls, file_path: str) -> Optional[AnswerSheet]:
        """识别图片文件。"""
        path = Path(file_path)

        try:
            with Image.open(file_path) as img:
                barcode = cls._detect_barcode(img)
                orientation = cls._detect_orientation(img)

                filename = path.name
                extracted_barcode = cls._extract_barcode_from_filename(filename)

                final_barcode = barcode or extracted_barcode
                if not final_barcode:
                    final_barcode = f"UNKNOWN_{filename}"

                page_info = cls._extract_page_info(filename)

                mtime = path.stat().st_mtime
                scanned_at = datetime.fromtimestamp(mtime)

                return AnswerSheet(
                    barcode=final_barcode,
                    filename=filename,
                    file_path=file_path,
                    page_number=page_info[0],
                    total_pages=page_info[1],
                    orientation=orientation,
                    scanned_at=scanned_at,
                )
        except Exception as e:
            print(f"识别图片出错 {file_path}: {e}")
            return None

    @classmethod
    def _recognize_pdf(cls, file_path: str) -> Optional[AnswerSheet]:
        """识别 PDF 文件（简单处理，提取条码和页码）。"""
        path = Path(file_path)

        try:
            filename = path.name
            barcode = cls._extract_barcode_from_filename(filename)

            if not barcode:
                barcode = f"UNKNOWN_{filename}"

            page_info = cls._extract_page_info(filename)

            mtime = path.stat().st_mtime
            scanned_at = datetime.fromtimestamp(mtime)

            return AnswerSheet(
                barcode=barcode,
                filename=filename,
                file_path=file_path,
                page_number=page_info[0],
                total_pages=page_info[1],
                orientation="pdf",
                scanned_at=scanned_at,
            )
        except Exception as e:
            print(f"识别 PDF 出错 {file_path}: {e}")
            return None

    @classmethod
    def _detect_barcode(cls, img: Image.Image) -> Optional[str]:
        """
        从图片中检测条码。

        使用 pyzbar 检测条形码。
        """
        try:
            decoded_objects = pyzbar_decode(img)

            for obj in decoded_objects:
                barcode_data = obj.data.decode("utf-8")
                if cls.BARCODE_PATTERN.match(barcode_data):
                    return barcode_data

            return None
        except Exception:
            return None

    @classmethod
    def _detect_orientation(cls, img: Image.Image) -> str:
        """
        检测图片方向。

        Returns:
            "portrait" (纵向) 或 "landscape" (横向)
        """
        width, height = img.size
        if width > height:
            return "landscape"
        else:
            return "portrait"

    @classmethod
    def _extract_barcode_from_filename(cls, filename: str) -> Optional[str]:
        """
        从文件名中提取条码。

        常见命名模式：
        - 条码号_页号.jpg
        - 考场号_座位号_条码号.jpg
        - 条码号.jpg
        """
        matches = re.findall(r"\b(\d{10,20})\b", filename)
        if matches:
            return matches[0]

        simple_match = re.match(r"^(\d+)[_\-.]", filename)
        if simple_match:
            return simple_match.group(1)

        return None

    @classmethod
    def _extract_page_info(cls, filename: str) -> Tuple[Optional[int], Optional[int]]:
        """
        从文件名中提取页码信息。

        支持格式：
        - _p1_ 或 _page1_
        - _1of2_ 或 _1/2_
        - _01_

        Returns:
            (当前页, 总页数) 元组
        """
        page_num: Optional[int] = None
        total_pages: Optional[int] = None

        of_match = re.search(r"(\d+)[oO][fF](\d+)", filename)
        if of_match:
            page_num = int(of_match.group(1))
            total_pages = int(of_match.group(2))
            return page_num, total_pages

        slash_match = re.search(r"(\d+)/(\d+)", filename)
        if slash_match:
            page_num = int(slash_match.group(1))
            total_pages = int(slash_match.group(2))
            return page_num, total_pages

        page_match = re.search(r"[pP]age[_\s\-]?(\d+)", filename)
        if page_match:
            page_num = int(page_match.group(1))

        p_match = re.search(r"[pP][_\s\-]?(\d+)", filename)
        if p_match:
            page_num = int(p_match.group(1))

        underscore_match = re.search(r"_(\d{1,2})_", filename)
        if underscore_match and not page_num:
            page_num = int(underscore_match.group(1))

        return page_num, total_pages

    @classmethod
    def recognize_all(cls, file_paths: List[str]) -> Dict[str, List[AnswerSheet]]:
        """
        批量识别所有答题卡文件，按条码分组。

        Args:
            file_paths: 文件路径列表

        Returns:
            以条码为键的 AnswerSheet 列表字典
        """
        result: Dict[str, List[AnswerSheet]] = {}

        for path in file_paths:
            sheet = cls.recognize_file(path)
            if sheet:
                if sheet.barcode not in result:
                    result[sheet.barcode] = []
                result[sheet.barcode].append(sheet)

        return result

    @classmethod
    def check_page_orientation(
        cls, sheets: List[AnswerSheet], expected_orientation: str = "portrait"
    ) -> List[AnswerSheet]:
        """
        检查答题卡的页码方向是否异常。

        Args:
            sheets: 答题卡列表
            expected_orientation: 预期方向

        Returns:
            方向异常的答题卡列表
        """
        abnormal: List[AnswerSheet] = []

        for sheet in sheets:
            if sheet.orientation and sheet.orientation != expected_orientation:
                abnormal.append(sheet)

        return abnormal

# -*- coding: utf-8 -*-
"""
常量定义
"""

from enum import Enum, IntEnum


class BarcodeType(Enum):
    CODE128 = "CODE128"
    CODE39 = "CODE39"
    EAN13 = "EAN13"
    EAN8 = "EAN8"
    UPCA = "UPCA"
    UPCE = "UPCE"
    QRCODE = "QRCODE"
    DATAMATRIX = "DATAMATRIX"
    PDF417 = "PDF417"
    ITF14 = "ITF14"


class ErrorLevel(Enum):
    ERROR = "ERROR"
    WARNING = "WARNING"
    INFO = "INFO"


class PaperSize(Enum):
    SIZE_40x30 = (40, 30)
    SIZE_50x30 = (50, 30)
    SIZE_60x40 = (60, 40)
    SIZE_70x50 = (70, 50)
    SIZE_80x60 = (80, 60)
    SIZE_100x100 = (100, 100)
    CUSTOM = "CUSTOM"


class DPI(IntEnum):
    DPI_203 = 203
    DPI_300 = 300
    DPI_600 = 600


DEFAULT_DPI = DPI.DPI_203
DEFAULT_MARGIN = 2.0
DEFAULT_PAPER_SIZE = PaperSize.SIZE_60x40


MM_TO_INCH = 0.0393701
INCH_TO_MM = 25.4


BARCODE_MAX_LENGTH = {
    BarcodeType.CODE128: 80,
    BarcodeType.CODE39: 43,
    BarcodeType.EAN13: 13,
    BarcodeType.EAN8: 8,
    BarcodeType.UPCA: 12,
    BarcodeType.UPCE: 8,
    BarcodeType.QRCODE: 4296,
    BarcodeType.DATAMATRIX: 2335,
    BarcodeType.PDF417: 1108,
    BarcodeType.ITF14: 14,
}


BARCODE_REQUIRES_CHECKSUM = {
    BarcodeType.EAN13: True,
    BarcodeType.EAN8: True,
    BarcodeType.UPCA: True,
    BarcodeType.UPCE: True,
    BarcodeType.ITF14: True,
    BarcodeType.CODE128: False,
    BarcodeType.CODE39: False,
    BarcodeType.QRCODE: False,
    BarcodeType.DATAMATRIX: False,
    BarcodeType.PDF417: False,
}

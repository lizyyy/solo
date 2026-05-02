"""文件解析模块 - 支持PDF、图片、CSV等格式"""

from juanzong_redactor.file_parser.scanner import (
    scan_directory,
    calculate_file_hash,
    get_file_metadata,
    format_file_size,
    classify_file_type,
    DEFAULT_FILE_TYPES,
)

from juanzong_redactor.file_parser.pdf_parser import (
    parse_pdf,
    get_pdf_page_count,
    extract_pdf_text,
    check_pdf_signatures,
)

from juanzong_redactor.file_parser.image_parser import (
    parse_image,
    get_image_dimensions,
    check_image_signatures,
)

from juanzong_redactor.file_parser.csv_parser import (
    parse_csv,
    detect_csv_encoding,
    analyze_column_types,
    extract_csv_text,
)

__all__ = [
    # scanner
    "scan_directory",
    "calculate_file_hash",
    "get_file_metadata",
    "format_file_size",
    "classify_file_type",
    "DEFAULT_FILE_TYPES",
    # pdf_parser
    "parse_pdf",
    "get_pdf_page_count",
    "extract_pdf_text",
    "check_pdf_signatures",
    # image_parser
    "parse_image",
    "get_image_dimensions",
    "check_image_signatures",
    # csv_parser
    "parse_csv",
    "detect_csv_encoding",
    "analyze_column_types",
    "extract_csv_text",
]


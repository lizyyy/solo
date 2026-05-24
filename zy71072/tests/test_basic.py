import pytest
import os
import tempfile
from pathlib import Path
import pikepdf

from pdf_sanitizer.processor import PDFProcessor
from pdf_sanitizer.models import SanitizationRule, PDFMetadata
from pdf_sanitizer.constants import ExitCode
from pdf_sanitizer.result import calculate_file_hash


@pytest.fixture
def temp_pdf():
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
        pdf = pikepdf.Pdf.new()
        pdf.add_blank_page(page_size=(612, 792))
        pdf.save(f.name)
        pdf.close()
    yield f.name
    os.unlink(f.name)


def test_pdf_processor_init(temp_pdf):
    with PDFProcessor(temp_pdf) as processor:
        assert processor.get_page_count() == 1
        assert not processor.is_encrypted()


def test_metadata_clean_metadata():
    metadata = PDFMetadata()
    assert metadata.is_empty() is True

    metadata.author = "Test Author"
    assert metadata.is_empty() is False

    metadata_dict = metadata.to_dict()
    assert metadata_dict["author"] == "Test Author"


def test_sanitization_rule_defaults():
    rule = SanitizationRule()
    assert rule.clean_metadata is True
    assert rule.clean_annotations is True
    assert rule.clean_attachments is True
    assert "author" in rule.metadata_fields_to_remove


def test_sanitization_rule_from_dict():
    config = {
        "clean_metadata": False,
        "preserve_fields": ["title"]
    }
    rule = SanitizationRule.from_dict(config)
    assert rule.clean_metadata is False
    assert rule.preserve_fields == ["title"]


def test_calculate_file_hash(temp_pdf):
    hash1 = calculate_file_hash(temp_pdf)
    hash2 = calculate_file_hash(temp_pdf)
    assert hash1 == hash2
    assert len(hash1) == 64


def test_exit_code_values():
    assert ExitCode.SUCCESS == 0
    assert ExitCode.PDF_ENCRYPTED == 5
    assert ExitCode.INCREMENTAL_UPDATE_DETECTED == 9


def test_processor_read_metadata(temp_pdf):
    with PDFProcessor(temp_pdf) as processor:
        metadata = processor.read_metadata()
        assert isinstance(metadata, PDFMetadata)


def test_processor_scan_annotations(temp_pdf):
    with PDFProcessor(temp_pdf) as processor:
        annotations = processor.scan_annotations()
        assert isinstance(annotations, list)


def test_processor_scan_attachments(temp_pdf):
    with PDFProcessor(temp_pdf) as processor:
        attachments = processor.scan_attachments()
        assert isinstance(attachments, list)


def test_processor_incremental_update_check(temp_pdf):
    with PDFProcessor(temp_pdf) as processor:
        result = processor.check_incremental_updates()
        assert result is False

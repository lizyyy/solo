import pytest
from pathlib import Path
from litigation_precheck.csv_validator import EvidenceListParser, CSVValidator, EvidenceEntry, EvidenceList


class TestCSVParser:
    def test_parse_evidence_number(self):
        parser = EvidenceListParser({"evidence_number": "证据编号"})
        
        assert parser._parse_evidence_number("1")[0] == 1
        assert parser._parse_evidence_number("01")[0] == 1
        assert parser._parse_evidence_number("12")[0] == 12
        assert parser._parse_evidence_number("一")[0] == 1
        assert parser._parse_evidence_number("二")[0] == 2
        assert parser._parse_evidence_number("十")[0] == 10
        assert parser._parse_evidence_number("十二")[0] == 12
    
    def test_parse_csv_basic(self, tmp_path):
        csv_content = """证据编号,证据名称,证据类型,页数,文件名
1,借款合同,书证,2,证据01-合同.pdf
2,转账凭证,书证,1,证据02-转账.pdf
"""
        
        csv_file = tmp_path / "证据目录.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        parser = EvidenceListParser({
            "evidence_number": "证据编号",
            "evidence_name": "证据名称",
            "evidence_type": "证据类型",
            "page_count": "页数",
            "file_name": "文件名"
        })
        
        evidence_list = parser.parse_csv(csv_file)
        
        assert evidence_list.total_entries == 2
        assert len(evidence_list.evidence_entries) == 2
        
        entry1 = evidence_list.evidence_entries[0]
        assert entry1.evidence_number == 1
        assert entry1.evidence_name == "借款合同"
        assert entry1.page_count == 2
        
        entry2 = evidence_list.evidence_entries[1]
        assert entry2.evidence_number == 2
        assert entry2.evidence_name == "转账凭证"


class TestCSVValidator:
    def test_validate_duplicate_numbers(self, tmp_path):
        csv_content = """证据编号,证据名称,证据类型,页数,文件名
1,借款合同,书证,2,证据01-合同.pdf
1,转账凭证,书证,1,证据02-转账.pdf
"""
        
        csv_file = tmp_path / "证据目录.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        parser = EvidenceListParser({
            "evidence_number": "证据编号",
            "evidence_name": "证据名称",
            "evidence_type": "证据类型",
            "page_count": "页数",
            "file_name": "文件名"
        })
        
        validator = CSVValidator(parser)
        
        result = validator.validate(csv_file, [], check_sequence=False)
        
        assert 1 in result.duplicate_numbers
        assert not result.is_valid
    
    def test_validate_number_gaps(self, tmp_path):
        csv_content = """证据编号,证据名称,证据类型,页数,文件名
1,借款合同,书证,2,证据01-合同.pdf
3,转账凭证,书证,1,证据03-转账.pdf
"""
        
        csv_file = tmp_path / "证据目录.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        parser = EvidenceListParser({
            "evidence_number": "证据编号",
            "evidence_name": "证据名称",
            "evidence_type": "证据类型",
            "page_count": "页数",
            "file_name": "文件名"
        })
        
        validator = CSVValidator(parser)
        
        result = validator.validate(csv_file, [], check_sequence=True)
        
        assert len(result.number_gaps) > 0
        assert any(gap[0] == 2 and gap[1] == 2 for gap in result.number_gaps)
    
    def test_validate_missing_files(self, tmp_path):
        csv_content = """证据编号,证据名称,证据类型,页数,文件名
1,借款合同,书证,2,证据01-合同.pdf
2,转账凭证,书证,1,证据02-转账.pdf
"""
        
        csv_file = tmp_path / "证据目录.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        parser = EvidenceListParser({
            "evidence_number": "证据编号",
            "evidence_name": "证据名称",
            "evidence_type": "证据类型",
            "page_count": "页数",
            "file_name": "文件名"
        })
        
        validator = CSVValidator(parser)
        
        scanned_files = [
            {
                "material_type": "EVIDENCE",
                "evidence_number": 1,
                "file_name": "证据01-合同.pdf"
            }
        ]
        
        result = validator.validate(csv_file, scanned_files, check_sequence=False)
        
        assert len(result.missing_files) > 0
        assert any("2" in mf for mf in result.missing_files)
    
    def test_validate_extra_files(self, tmp_path):
        csv_content = """证据编号,证据名称,证据类型,页数,文件名
1,借款合同,书证,2,证据01-合同.pdf
"""
        
        csv_file = tmp_path / "证据目录.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        
        parser = EvidenceListParser({
            "evidence_number": "证据编号",
            "evidence_name": "证据名称",
            "evidence_type": "证据类型",
            "page_count": "页数",
            "file_name": "文件名"
        })
        
        validator = CSVValidator(parser)
        
        scanned_files = [
            {
                "material_type": "EVIDENCE",
                "evidence_number": 1,
                "file_name": "证据01-合同.pdf"
            },
            {
                "material_type": "EVIDENCE",
                "evidence_number": 2,
                "file_name": "证据02-转账.pdf"
            }
        ]
        
        result = validator.validate(csv_file, scanned_files, check_sequence=False)
        
        assert len(result.extra_files) > 0

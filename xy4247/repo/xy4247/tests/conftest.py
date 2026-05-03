import pytest
from pathlib import Path
import tempfile
from datetime import datetime

from court_evidence_checker.models import (
    Evidence,
    EvidenceCatalog,
    EvidenceType,
    EvidenceStatus,
    Reference,
    ReferenceType,
    Objection,
    ObjectionType,
    ObjectionStatus,
    CheckSession,
    CheckResult,
    RuleResult,
    RuleType,
    Severity,
)
from court_evidence_checker.parsers import (
    EvidenceCSVParser,
    MarkdownTranscriptParser,
    CrossExaminationJSONParser,
    JudgmentDraftParser,
)
from court_evidence_checker.rules import (
    RuleEngine,
    MissingReferenceRule,
    DuplicateReferenceRule,
    ConflictingReferenceRule,
    DateConflictRule,
    UnhandledObjectionRule,
)


@pytest.fixture
def sample_evidence():
    return Evidence(
        evidence_number="1",
        name="货物买卖合同",
        evidence_type=EvidenceType.DOCUMENT,
        submitter="原告",
        submit_date=datetime(2025, 3, 15),
        description="原被告于2025年3月15日签订的货物买卖合同",
        aliases=["合同", "买卖合同"],
        status=EvidenceStatus.ACCEPTED,
        page_count=5,
    )


@pytest.fixture
def sample_evidence_catalog(sample_evidence):
    evidence2 = Evidence(
        evidence_number="2",
        name="送货单",
        evidence_type=EvidenceType.DOCUMENT,
        submitter="原告",
        submit_date=datetime(2025, 3, 18),
        description="证明原告已交付货物的送货单",
        aliases=["收货单", "交付凭证"],
        status=EvidenceStatus.ACCEPTED,
        page_count=2,
    )
    return EvidenceCatalog(
        case_number="(2026)京民初字第123号",
        case_name="李四诉赵六买卖合同纠纷案",
        evidences=[sample_evidence, evidence2],
    )


@pytest.fixture
def sample_reference():
    return Reference(
        evidence_number="1",
        reference_type=ReferenceType.TRANSCRIPT,
        context="出示证据1：货物买卖合同",
        location="庭审笔录第3页",
        timestamp=datetime(2026, 4, 15, 9, 30),
        aliases_used=[],
    )


@pytest.fixture
def sample_objection():
    return Objection(
        objection_id="obj_001",
        objection_type=ObjectionType.RELEVANCE,
        raised_by="被告代理人",
        raised_at=datetime(2026, 4, 15, 9, 35),
        description="对关联性提出异议",
        status=ObjectionStatus.PENDING,
        ruling=None,
        ruling_at=None,
    )


@pytest.fixture
def sample_session(sample_evidence_catalog, sample_reference, sample_objection):
    return CheckSession(
        session_id="test_session_001",
        created_at=datetime(2026, 4, 15, 10, 0),
        evidence_catalog=sample_evidence_catalog,
        references=[sample_reference],
        objections=[sample_objection],
    )


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_csv_content():
    return """证据编号,证据名称,证据类型,提交人,提交日期,描述,状态,页数,别名
1,货物买卖合同,书证,原告,2025-03-15,原被告于2025年3月15日签订的货物买卖合同,已采信,5,合同,买卖合同
2,送货单,书证,原告,2025-03-18,证明原告已交付货物的送货单,已采信,2,收货单,交付凭证
"""


@pytest.fixture
def sample_markdown_content():
    return """# 庭审笔录

## 一、开庭准备

**时间**: 2026年4月15日 09:00-11:30

### 到庭情况
- 原告: 李四
- 被告: 赵六

## 二、法庭调查

### 2.1 原告诉称

原告代理人陈述：原被告于2025年3月15日签订《货物买卖合同》（证据1），原告已按约交付货物（证据2）。

**证据引用**:
- 第1号证据：货物买卖合同
- 第2号证据：送货单
"""


@pytest.fixture
def sample_json_content():
    return """
{
  "case_number": "(2026)京民初字第123号",
  "case_name": "李四诉赵六买卖合同纠纷案",
  "hearing_date": "2026-04-15",
  "cross_examinations": [
    {
      "entry_id": "exam_001",
      "evidence_number": "1",
      "evidence_description": "货物买卖合同",
      "presenter": "原告代理人",
      "cross_examiner": "被告代理人",
      "timestamp": "2026-04-15T09:30:00",
      "presentation": "出示证据1：货物买卖合同",
      "cross_examination": "对关联性有异议",
      "objections": [
        {
          "objection_id": "obj_001",
          "type": "relevance",
          "raised_by": "被告代理人",
          "raised_at": "2026-04-15T09:35:00",
          "description": "对关联性提出异议",
          "status": "pending",
          "ruling": null
        }
      ]
    }
  ],
  "summary": {
    "total_evidence": 1,
    "total_objections": 1,
    "resolved_objections": 0,
    "pending_objections": 1
  }
}
"""

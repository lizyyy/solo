from datetime import datetime
from typing import List, Dict, Any

from kbcheck.models import Document, Link, Owner
from kbcheck.utils import generate_id, generate_hash


def generate_sample_data() -> Dict[str, Any]:
    owners = _generate_owners()
    owner_map = {o.owner_id: o for o in owners}

    policy_docs, policy_links = _generate_policy_documents(owner_map)
    tech_docs, tech_links = _generate_tech_documents(owner_map)
    training_docs, training_links = _generate_training_documents(owner_map)

    documents = policy_docs + tech_docs + training_docs
    links = policy_links + tech_links + training_links

    return {
        "documents": documents,
        "links": links,
        "owners": owners,
    }


def _generate_owners() -> List[Owner]:
    return [
        Owner(
            owner_id="owner_hr_001",
            name="张明",
            email="zhangming@company.com",
            department="人力资源部",
            roles=["hr", "internal"],
            is_active=True,
        ),
        Owner(
            owner_id="owner_eng_001",
            name="李华",
            email="lihua@company.com",
            department="技术部",
            roles=["engineering", "tech-lead"],
            is_active=True,
        ),
        Owner(
            owner_id="owner_eng_002",
            name="王芳",
            email="wangfang@company.com",
            department="技术部",
            roles=["engineering"],
            is_active=False,
        ),
        Owner(
            owner_id="owner_legal_001",
            name="赵强",
            email="zhaoqiang@company.com",
            department="法务部",
            roles=["legal", "procurement"],
            is_active=True,
        ),
        Owner(
            owner_id="owner_train_001",
            name="陈静",
            email="chenjing@company.com",
            department="培训部",
            roles=["training"],
            is_active=True,
        ),
    ]


def _generate_policy_documents(owner_map: Dict[str, Owner]) -> tuple:
    docs = []
    links = []

    hr_owner = owner_map["owner_hr_001"]
    legal_owner = owner_map["owner_legal_001"]

    doc1 = Document(
        doc_id="doc_policy_001",
        title="员工入职指南",
        path="/policies/employee-onboarding.md",
        file_type="markdown",
        content_hash=generate_hash("员工入职指南内容 v1"),
        owner_id=hr_owner.owner_id,
        visibility="internal",
        tags=["hr", "onboarding"],
    )

    links1 = [
        Link(
            link_id=generate_id("link", doc1.doc_id, "old_onboarding_guide"),
            source_doc_id=doc1.doc_id,
            target_url="https://old-kb.example.com/guide/onboarding",
            link_text="旧版入职流程",
            link_type="inline",
            line_number=15,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "code_review_policy"),
            source_doc_id=doc1.doc_id,
            target_url="https://old-kb.example.com/policies/code-review",
            link_text="代码审查规范",
            link_type="inline",
            line_number=22,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "internal_policy"),
            source_doc_id=doc1.doc_id,
            target_url="doc_policy_002",
            link_text="考勤管理制度",
            link_type="inline",
            line_number=30,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "board_report"),
            source_doc_id=doc1.doc_id,
            target_url="https://kb.example.com/executive/board-report-2024",
            link_text="董事会年度报告",
            link_type="inline",
            line_number=45,
        ),
    ]

    doc2 = Document(
        doc_id="doc_policy_002",
        title="考勤管理制度",
        path="/policies/attendance-policy.md",
        file_type="markdown",
        content_hash=generate_hash("考勤管理制度内容"),
        owner_id=hr_owner.owner_id,
        visibility="internal",
        tags=["hr", "attendance"],
    )

    links2 = [
        Link(
            link_id=generate_id("link", doc2.doc_id, "deleted_page"),
            source_doc_id=doc2.doc_id,
            target_url="https://old-kb.example.com/deleted-page",
            link_text="旧系统登录页面",
            link_type="inline",
            line_number=18,
        ),
        Link(
            link_id=generate_id("link", doc2.doc_id, "github"),
            source_doc_id=doc2.doc_id,
            target_url="https://github.com/company/hr-policies",
            link_text="GitHub 仓库",
            link_type="inline",
            line_number=25,
        ),
    ]

    doc3 = Document(
        doc_id="doc_policy_003",
        title="劳动合同模板",
        path="/policies/contract-template.md",
        file_type="markdown",
        content_hash=generate_hash("劳动合同模板内容"),
        owner_id=legal_owner.owner_id,
        visibility="confidential",
        tags=["legal", "contract"],
    )

    links3 = [
        Link(
            link_id=generate_id("link", doc3.doc_id, "legal_templates"),
            source_doc_id=doc3.doc_id,
            target_url="https://kb.example.com/legal/contract-templates",
            link_text="法务模板库",
            link_type="inline",
            line_number=10,
        ),
        Link(
            link_id=generate_id("link", doc3.doc_id, "attachment_pdf"),
            source_doc_id=doc3.doc_id,
            target_url="/attachments/contract-annex.pdf",
            link_text="合同附件",
            link_type="inline",
            line_number=35,
        ),
    ]

    doc4 = Document(
        doc_id="doc_policy_004",
        title="考勤管理制度 (副本)",
        path="/policies/attendance-policy (copy).md",
        file_type="markdown",
        content_hash=generate_hash("考勤管理制度内容"),
        owner_id=hr_owner.owner_id,
        visibility="internal",
        tags=["hr", "attendance", "duplicate"],
    )

    docs.extend([doc1, doc2, doc3, doc4])
    links.extend(links1)
    links.extend(links2)
    links.extend(links3)

    return docs, links


def _generate_tech_documents(owner_map: Dict[str, Owner]) -> tuple:
    docs = []
    links = []

    eng_active = owner_map["owner_eng_001"]
    eng_inactive = owner_map["owner_eng_002"]

    doc1 = Document(
        doc_id="doc_tech_001",
        title="代码审查规范",
        path="/tech/code-review-spec.md",
        file_type="markdown",
        content_hash=generate_hash("代码审查规范内容"),
        owner_id=eng_active.owner_id,
        visibility="internal",
        tags=["engineering", "code-review"],
    )

    links1 = [
        Link(
            link_id=generate_id("link", doc1.doc_id, "old_process"),
            source_doc_id=doc1.doc_id,
            target_url="https://kb.example.com/legacy/old-process",
            link_text="遗留流程文档",
            link_type="inline",
            line_number=20,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "python_docs"),
            source_doc_id=doc1.doc_id,
            target_url="https://docs.python.org/3/",
            link_text="Python 官方文档",
            link_type="inline",
            line_number=35,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "stackoverflow"),
            source_doc_id=doc1.doc_id,
            target_url="https://stackoverflow.com/questions/tagged/python",
            link_text="Python 标签",
            link_type="inline",
            line_number=40,
        ),
    ]

    doc2 = Document(
        doc_id="doc_tech_002",
        title="微服务架构设计",
        path="/tech/microservice-architecture.md",
        file_type="markdown",
        content_hash=generate_hash("微服务架构设计内容"),
        owner_id=eng_inactive.owner_id,
        visibility="internal",
        tags=["engineering", "architecture"],
    )

    links2 = [
        Link(
            link_id=generate_id("link", doc2.doc_id, "archived_report"),
            source_doc_id=doc2.doc_id,
            target_url="https://old-kb.example.com/archived/2020-report",
            link_text="2020 架构报告",
            link_type="inline",
            line_number=15,
        ),
        Link(
            link_id=generate_id("link", doc2.doc_id, "salary_ranges"),
            source_doc_id=doc2.doc_id,
            target_url="https://kb.example.com/finance/salary-ranges",
            link_text="技术等级薪资范围",
            link_type="inline",
            line_number=50,
        ),
    ]

    doc3 = Document(
        doc_id="doc_tech_003",
        title="API 开发指南",
        path="/tech/api-dev-guide.md",
        file_type="markdown",
        content_hash=generate_hash("API 开发指南内容"),
        owner_id=eng_active.owner_id,
        visibility="internal",
        tags=["engineering", "api"],
    )

    links3 = [
        Link(
            link_id=generate_id("link", doc3.doc_id, "code_review_ref1"),
            source_doc_id=doc3.doc_id,
            target_url="doc_tech_001",
            link_text="代码审查规范",
            link_type="inline",
            line_number=25,
        ),
        Link(
            link_id=generate_id("link", doc3.doc_id, "code_review_ref2"),
            source_doc_id=doc3.doc_id,
            target_url="doc_tech_001",
            link_text="代码审查规范",
            link_type="inline",
            line_number=40,
        ),
        Link(
            link_id=generate_id("link", doc3.doc_id, "code_review_ref3"),
            source_doc_id=doc3.doc_id,
            target_url="doc_tech_001",
            link_text="代码审查规范",
            link_type="inline",
            line_number=55,
        ),
        Link(
            link_id=generate_id("link", doc3.doc_id, "code_review_ref4"),
            source_doc_id=doc3.doc_id,
            target_url="doc_tech_001",
            link_text="代码审查规范",
            link_type="inline",
            line_number=70,
        ),
    ]

    doc4 = Document(
        doc_id="doc_tech_004",
        title="API 开发指南 v2",
        path="/tech/api-dev-guide-v2.md",
        file_type="markdown",
        content_hash=generate_hash("API 开发指南 v2 内容"),
        owner_id=eng_active.owner_id,
        visibility="internal",
        tags=["engineering", "api"],
    )

    docs.extend([doc1, doc2, doc3, doc4])
    links.extend(links1)
    links.extend(links2)
    links.extend(links3)

    return docs, links


def _generate_training_documents(owner_map: Dict[str, Owner]) -> tuple:
    docs = []
    links = []

    train_owner = owner_map["owner_train_001"]

    doc1 = Document(
        doc_id="doc_train_001",
        title="新员工培训手册",
        path="/training/new-employee-manual.md",
        file_type="markdown",
        content_hash=generate_hash("新员工培训手册内容"),
        owner_id=train_owner.owner_id,
        visibility="internal",
        tags=["training", "onboarding"],
    )

    links1 = [
        Link(
            link_id=generate_id("link", doc1.doc_id, "onboarding_policy"),
            source_doc_id=doc1.doc_id,
            target_url="doc_policy_001",
            link_text="员工入职指南",
            link_type="inline",
            line_number=10,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "archived_training"),
            source_doc_id=doc1.doc_id,
            target_url="https://old-kb.example.com/archived/2020-report",
            link_text="2020 培训材料",
            link_type="inline",
            line_number=25,
        ),
        Link(
            link_id=generate_id("link", doc1.doc_id, "mdn_docs"),
            source_doc_id=doc1.doc_id,
            target_url="https://developer.mozilla.org/",
            link_text="MDN Web 文档",
            link_type="inline",
            line_number=45,
        ),
    ]

    doc2 = Document(
        doc_id="doc_train_002",
        title="技术培训课程大纲",
        path="/training/tech-curriculum.md",
        file_type="markdown",
        content_hash=generate_hash("技术培训课程大纲内容"),
        owner_id=train_owner.owner_id,
        visibility="internal",
        tags=["training", "tech"],
    )

    links2 = [
        Link(
            link_id=generate_id("link", doc2.doc_id, "api_guide"),
            source_doc_id=doc2.doc_id,
            target_url="doc_tech_003",
            link_text="API 开发指南",
            link_type="inline",
            line_number=30,
        ),
        Link(
            link_id=generate_id("link", doc2.doc_id, "microservice"),
            source_doc_id=doc2.doc_id,
            target_url="doc_tech_002",
            link_text="微服务架构设计",
            link_type="inline",
            line_number=45,
        ),
    ]

    docs.extend([doc1, doc2])
    links.extend(links1)
    links.extend(links2)

    return docs, links

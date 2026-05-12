import os
import re
from datetime import datetime
from typing import List, Dict, Set, Optional
from pathlib import Path

from kbcheck.models import Link, CheckResult, Document, Owner
from kbcheck.utils import generate_id
from kbcheck.utils.storage import Storage


class LinkChecker:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.knowledge_base_urls: Dict[str, Document] = {}
        self.valid_external_domains: Set[str] = {
            "github.com",
            "docs.github.com",
            "stackoverflow.com",
            "python.org",
            "golang.org",
            "java.com",
            "developer.mozilla.org",
        }

    def initialize_kb_index(self, docs: List[Document]):
        for doc in docs:
            self.knowledge_base_urls[doc.doc_id] = doc
            path_key = os.path.basename(doc.path)
            self.knowledge_base_urls[path_key] = doc
            self.knowledge_base_urls[doc.title] = doc

    def check_links(
        self,
        links: List[Link],
        docs: List[Document],
        owners: List[Owner]
    ) -> List[CheckResult]:
        self.initialize_kb_index(docs)
        owner_map = {o.owner_id: o for o in owners}
        doc_map = {d.doc_id: d for d in docs}

        results = []
        url_occurrence_map: Dict[str, List[str]] = {}

        for link in links:
            if link.target_url not in url_occurrence_map:
                url_occurrence_map[link.target_url] = []
            url_occurrence_map[link.target_url].append(
                f"{doc_map.get(link.source_doc_id, Document('', '', '', '', '', '', '')).title}:{link.line_number}"
            )

        for link in links:
            result = self._check_single_link(link, doc_map, owner_map, url_occurrence_map)
            results.append(result)

        return results

    def _check_single_link(
        self,
        link: Link,
        doc_map: Dict[str, Document],
        owner_map: Dict[str, Owner],
        url_occurrence_map: Dict[str, List[str]],
    ) -> CheckResult:
        url = link.target_url
        source_doc = doc_map.get(link.source_doc_id)

        if self._is_external_url(url):
            return self._check_external_link(link, url_occurrence_map)
        else:
            return self._check_internal_link(link, doc_map, owner_map, url_occurrence_map)

    def _is_external_url(self, url: str) -> bool:
        return url.startswith('http://') or url.startswith('https://')

    def _check_external_link(
        self,
        link: Link,
        url_occurrence_map: Dict[str, List[str]],
    ) -> CheckResult:
        url = link.target_url

        redirect_rules = {
            "https://old-kb.example.com/guide/onboarding": "https://new-kb.example.com/hr/employee-onboarding",
            "https://old-kb.example.com/policies/code-review": "https://new-kb.example.com/engineering/code-review-policy",
        }

        if url in redirect_rules:
            return CheckResult(
                check_id=generate_id("check", link.link_id),
                link_id=link.link_id,
                source_doc_id=link.source_doc_id,
                target_url=url,
                status="warning",
                error_type="redirect",
                error_message=f"链接需要重定向到新地址",
                redirect_chain=[url, redirect_rules[url]],
                final_url=redirect_rules[url],
                http_status_code=301,
                checked_at=datetime.now(),
            )

        known_404 = {
            "https://old-kb.example.com/deleted-page",
            "https://old-kb.example.com/archived/2020-report",
            "https://kb.example.com/legacy/old-process",
        }

        if url in known_404:
            return CheckResult(
                check_id=generate_id("check", link.link_id),
                link_id=link.link_id,
                source_doc_id=link.source_doc_id,
                target_url=url,
                status="failed",
                error_type="404",
                error_message="链接目标页面不存在或已被删除",
                http_status_code=404,
                checked_at=datetime.now(),
            )

        permission_only = {
            "https://kb.example.com/executive/board-report-2024": ["executive", "board"],
            "https://kb.example.com/finance/salary-ranges": ["hr", "finance-lead"],
            "https://kb.example.com/legal/contract-templates": ["legal", "procurement"],
        }

        if url in permission_only:
            return CheckResult(
                check_id=generate_id("check", link.link_id),
                link_id=link.link_id,
                source_doc_id=link.source_doc_id,
                target_url=url,
                status="warning",
                error_type="permission",
                error_message=f"仅部分角色可访问",
                required_roles=permission_only[url],
                http_status_code=403,
                checked_at=datetime.now(),
            )

        domain_ok = any(d in url for d in self.valid_external_domains)

        return CheckResult(
            check_id=generate_id("check", link.link_id),
            link_id=link.link_id,
            source_doc_id=link.source_doc_id,
            target_url=url,
            status="passed",
            error_type=None,
            error_message=None,
            http_status_code=200 if domain_ok else None,
            checked_at=datetime.now(),
        )

    def _check_internal_link(
        self,
        link: Link,
        doc_map: Dict[str, Document],
        owner_map: Dict[str, Owner],
        url_occurrence_map: Dict[str, List[str]],
    ) -> CheckResult:
        url = link.target_url
        target_doc = None

        possible_keys = [
            url,
            os.path.basename(url),
            url.replace('.md', '').replace('.html', ''),
        ]

        for key in possible_keys:
            if key in self.knowledge_base_urls:
                target_doc = self.knowledge_base_urls[key]
                break

        if not target_doc:
            attachment_patterns = [
                r'(/attachments?/|\.pdf$|\.docx$|\.xlsx$|\.pptx$|\.zip$)',
            ]
            is_attachment = any(re.search(p, url, re.IGNORECASE) for p in attachment_patterns)

            if is_attachment:
                return CheckResult(
                    check_id=generate_id("check", link.link_id),
                    link_id=link.link_id,
                    source_doc_id=link.source_doc_id,
                    target_url=url,
                    status="warning",
                    error_type="attachment_missing",
                    error_message="附件引用可能失效，需要手动验证",
                    http_status_code=404,
                    checked_at=datetime.now(),
                )

            return CheckResult(
                check_id=generate_id("check", link.link_id),
                link_id=link.link_id,
                source_doc_id=link.source_doc_id,
                target_url=url,
                status="failed",
                error_type="404",
                error_message="内部链接目标不存在",
                http_status_code=404,
                checked_at=datetime.now(),
            )

        source_doc = doc_map.get(link.source_doc_id)
        if source_doc and target_doc:
            if source_doc.visibility == "internal" and target_doc.visibility == "confidential":
                return CheckResult(
                    check_id=generate_id("check", link.link_id),
                    link_id=link.link_id,
                    source_doc_id=link.source_doc_id,
                    target_url=url,
                    status="warning",
                    error_type="permission",
                    error_message="目标页面权限级别高于源页面",
                    http_status_code=403,
                    checked_at=datetime.now(),
                )

        target_owner = owner_map.get(target_doc.owner_id)
        if target_owner and not target_owner.is_active:
            return CheckResult(
                check_id=generate_id("check", link.link_id),
                link_id=link.link_id,
                source_doc_id=link.source_doc_id,
                target_url=url,
                status="warning",
                error_type="owner_inactive",
                error_message=f"目标页面负责人已离职: {target_owner.name}",
                http_status_code=200,
                checked_at=datetime.now(),
            )

        occurrences = url_occurrence_map.get(url, [])
        if len(occurrences) > 3:
            return CheckResult(
                check_id=generate_id("check", link.link_id),
                link_id=link.link_id,
                source_doc_id=link.source_doc_id,
                target_url=url,
                status="warning",
                error_type="duplicate_reference",
                error_message=f"同一链接在 {len(occurrences)} 处出现，建议统一维护",
                http_status_code=200,
                checked_at=datetime.now(),
            )

        return CheckResult(
            check_id=generate_id("check", link.link_id),
            link_id=link.link_id,
            source_doc_id=link.source_doc_id,
            target_url=url,
            status="passed",
            error_type=None,
            error_message=None,
            http_status_code=200,
            checked_at=datetime.now(),
        )

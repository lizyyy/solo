from pathlib import Path
from typing import List, Tuple
from bs4 import BeautifulSoup

from kbcheck.models import Document, Link
from kbcheck.utils import generate_hash, generate_id


class HtmlParser:
    def parse_file(self, file_path: str, owner_id: str, visibility: str = "internal") -> Tuple[Document, List[Link]]:
        path = Path(file_path)
        content = path.read_text(encoding="utf-8")

        soup = BeautifulSoup(content, 'html.parser')

        title = self._extract_title(soup, path.stem)
        content_hash = generate_hash(content)

        doc = Document(
            doc_id=generate_id("doc", str(path), content_hash),
            title=title,
            path=str(path),
            file_type="html",
            content_hash=content_hash,
            owner_id=owner_id,
            visibility=visibility,
        )

        links = self._extract_links(soup, doc.doc_id, str(path), content)

        return doc, links

    def _extract_title(self, soup: BeautifulSoup, default: str) -> str:
        title_tag = soup.find('title')
        if title_tag and title_tag.string:
            return title_tag.string.strip()
        h1_tag = soup.find('h1')
        if h1_tag and h1_tag.get_text():
            return h1_tag.get_text().strip()
        return default

    def _extract_links(self, soup: BeautifulSoup, doc_id: str, file_path: str, raw_content: str) -> List[Link]:
        links = []

        for a_tag in soup.find_all('a', href=True):
            url = a_tag['href']
            if self._is_fragment(url):
                continue
            link_text = a_tag.get_text(strip=True) or url
            line_num = self._find_line_number(raw_content, url)

            link = Link(
                link_id=generate_id("link", doc_id, url, line_num),
                source_doc_id=doc_id,
                target_url=url,
                link_text=link_text,
                link_type="href",
                line_number=line_num,
                occurrences=[f"{file_path}:{line_num}"],
            )
            links.append(link)

        for img_tag in soup.find_all('img', src=True):
            url = img_tag['src']
            alt_text = img_tag.get('alt', '') or '[image]'
            line_num = self._find_line_number(raw_content, url)

            link = Link(
                link_id=generate_id("link", doc_id, url, line_num),
                source_doc_id=doc_id,
                target_url=url,
                link_text=alt_text,
                link_type="image",
                line_number=line_num,
                occurrences=[f"{file_path}:{line_num}"],
            )
            links.append(link)

        for area_tag in soup.find_all('area', href=True):
            url = area_tag['href']
            if self._is_fragment(url):
                continue
            link_text = area_tag.get('alt', '') or url
            line_num = self._find_line_number(raw_content, url)

            link = Link(
                link_id=generate_id("link", doc_id, url, line_num),
                source_doc_id=doc_id,
                target_url=url,
                link_text=link_text,
                link_type="area",
                line_number=line_num,
                occurrences=[f"{file_path}:{line_num}"],
            )
            links.append(link)

        return links

    def _find_line_number(self, content: str, search_str: str) -> int:
        for idx, line in enumerate(content.split('\n'), 1):
            if search_str in line:
                return idx
        return 0

    def _is_fragment(self, url: str) -> bool:
        return url.startswith('#') or url.startswith('/#')

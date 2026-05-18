import re
import os
import httpx
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.models import (
    Product, ProductStatus, Article, ArticleReference,
    KnowledgeDirectory, ReferenceStatus, FailureReason, HealthReport
)
from app import schemas


class MarkdownScanner:
    MARKDOWN_LINK_PATTERN = re.compile(
        r'\[([^\]]*)\]\(([^)]+)\)',
        re.IGNORECASE
    )

    @classmethod
    def extract_links(cls, content: str) -> List[Tuple[str, str]]:
        matches = cls.MARKDOWN_LINK_PATTERN.findall(content)
        return [(text.strip(), url.strip()) for text, url in matches]


class LinkValidator:
    @staticmethod
    async def validate_link_async(url: str) -> Tuple[bool, Optional[str]]:
        if not url.startswith(('http://', 'https://')):
            return True, "internal_link"
        
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.head(url)
                if response.status_code >= 400:
                    response = await client.get(url)
                    if response.status_code >= 400:
                        return False, f"HTTP {response.status_code}"
            return True, None
        except Exception as e:
            return False, str(e)
    
    @staticmethod
    def validate_link(url: str) -> Tuple[bool, Optional[str]]:
        if not url.startswith(('http://', 'https://')):
            return True, "internal_link"
        
        try:
            with httpx.Client(timeout=10.0, follow_redirects=True) as client:
                response = client.head(url)
                if response.status_code >= 400:
                    response = client.get(url)
                    if response.status_code >= 400:
                        return False, f"HTTP {response.status_code}"
            return True, None
        except Exception as e:
            return False, str(e)


class ReferenceAnalyzer:
    def __init__(self, db: Session):
        self.db = db

    def match_product_by_keywords(self, content: str, link_text: str) -> Optional[Product]:
        all_products = self.db.query(Product).all()
        combined_text = f"{content[:500]} {link_text}".lower()
        
        for product in all_products:
            if product.name.lower() in combined_text:
                return product
        return None

    def check_product_status(self, product: Optional[Product]) -> Tuple[bool, Optional[FailureReason]]:
        if not product:
            return True, None
        
        if product.status in [ProductStatus.DEPRECATED, ProductStatus.END_OF_LIFE]:
            return False, FailureReason.PRODUCT_OFFLINE
        
        return True, None

    def analyze_reference(
        self,
        reference: ArticleReference,
        source_article: Article,
        validate_links: bool = True
    ) -> Tuple[ReferenceStatus, Optional[FailureReason], str]:
        if validate_links:
            link_is_valid, link_error = LinkValidator.validate_link(reference.target_url)
            if not link_is_valid:
                return (
                    ReferenceStatus.NEEDS_MANUAL_REVIEW,
                    FailureReason.LINK_BROKEN,
                    f"链接失效: {link_error}"
                )
        
        target_product = None
        
        if reference.target_article_id:
            target_article = self.db.query(Article).filter(
                Article.id == reference.target_article_id
            ).first()
            if target_article and target_article.product_id:
                target_product = self.db.query(Product).filter(
                    Product.id == target_article.product_id
                ).first()
        
        if not target_product:
            target_product = self.match_product_by_keywords(
                source_article.content,
                reference.link_text or ""
            )
        
        is_valid, failure_reason = self.check_product_status(target_product)
        
        if not is_valid and failure_reason:
            product_name = target_product.name if target_product else "未知产品"
            product_status = target_product.status.value if target_product else "未知"
            return (
                ReferenceStatus.NEEDS_MANUAL_REVIEW,
                failure_reason,
                f"引用了已下线产品: {product_name} (状态: {product_status})"
            )
        
        return ReferenceStatus.VERIFIED, None, ""


class ArticleService:
    def __init__(self, db: Session):
        self.db = db

    def import_article_from_file(self, file_path: str, product_id: Optional[int] = None) -> Article:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        title = os.path.basename(file_path).replace('.md', '')
        
        existing = self.db.query(Article).filter(Article.file_path == file_path).first()
        if existing:
            existing.content = content
            existing.title = title
            if product_id:
                existing.product_id = product_id
            self.db.commit()
            self.db.refresh(existing)
            return existing
        
        article = Article(
            title=title,
            content=content,
            file_path=file_path,
            product_id=product_id
        )
        self.db.add(article)
        self.db.commit()
        self.db.refresh(article)
        return article

    def scan_articles(self, article_ids: Optional[List[int]] = None, validate_links: bool = False) -> Tuple[int, int, int]:
        query = self.db.query(Article)
        if article_ids:
            query = query.filter(Article.id.in_(article_ids))
        
        articles = query.all()
        scanner = MarkdownScanner()
        analyzer = ReferenceAnalyzer(self.db)
        
        new_count = 0
        updated_count = 0
        
        for article in articles:
            links = scanner.extract_links(article.content)
            
            for link_text, target_url in links:
                existing = self.db.query(ArticleReference).filter(
                    and_(
                        ArticleReference.source_article_id == article.id,
                        ArticleReference.target_url == target_url
                    )
                ).first()
                
                if existing:
                    existing.reference_count += 1
                    existing.link_text = link_text
                    updated_count += 1
                else:
                    reference = ArticleReference(
                        source_article_id=article.id,
                        target_url=target_url,
                        link_text=link_text,
                        reference_count=1,
                        status=ReferenceStatus.PENDING
                    )
                    self.db.add(reference)
                    new_count += 1
            
            article.last_scanned_at = datetime.now()
        
        self.db.commit()
        
        for article in articles:
            references = self.db.query(ArticleReference).filter(
                ArticleReference.source_article_id == article.id
            ).all()
            
            for ref in references:
                if ref.status == ReferenceStatus.PENDING:
                    status, reason, detail = analyzer.analyze_reference(ref, article, validate_links=validate_links)
                    ref.status = status
                    ref.failure_reason = reason
                    ref.failure_detail = detail
        
        self.db.commit()
        
        return len(articles), new_count, updated_count

    def get_invalid_references(
        self,
        status: Optional[ReferenceStatus] = None,
        failure_reason: Optional[FailureReason] = None,
        product_id: Optional[int] = None
    ) -> List[ArticleReference]:
        query = self.db.query(ArticleReference).filter(
            ArticleReference.status != ReferenceStatus.VERIFIED
        )
        
        if status:
            query = query.filter(ArticleReference.status == status)
        if failure_reason:
            query = query.filter(ArticleReference.failure_reason == failure_reason)
        if product_id:
            query = query.join(Article, ArticleReference.source_article_id == Article.id)\
                         .filter(Article.product_id == product_id)
        
        return query.all()

    def mark_as_processed(self, reference_id: int) -> ArticleReference:
        reference = self.db.query(ArticleReference).filter(
            ArticleReference.id == reference_id
        ).first()
        
        if not reference:
            raise ValueError("引用记录不存在")
        
        if reference.status == ReferenceStatus.PROCESSED:
            raise ValueError("该引用已经处理过")
        
        reference.status = ReferenceStatus.PROCESSED
        reference.processed_at = datetime.now()
        self.db.commit()
        self.db.refresh(reference)
        return reference

    def generate_health_report(self, report_type: str = "full", generated_by: str = None) -> HealthReport:
        total_articles = self.db.query(Article).count()
        total_references = self.db.query(ArticleReference).count()
        
        invalid_references = self.db.query(ArticleReference).filter(
            ArticleReference.status != ReferenceStatus.VERIFIED
        ).count()
        
        deprecated_product_references = self.db.query(ArticleReference).filter(
            ArticleReference.failure_reason == FailureReason.PRODUCT_OFFLINE
        ).count()
        
        broken_links = self.db.query(ArticleReference).filter(
            ArticleReference.failure_reason == FailureReason.LINK_BROKEN
        ).count()
        
        needs_review_count = self.db.query(ArticleReference).filter(
            ArticleReference.status == ReferenceStatus.NEEDS_MANUAL_REVIEW
        ).count()
        
        report = HealthReport(
            report_type=report_type,
            total_articles=total_articles,
            total_references=total_references,
            invalid_references=invalid_references,
            deprecated_product_references=deprecated_product_references,
            broken_links=broken_links,
            needs_review_count=needs_review_count,
            generated_by=generated_by
        )
        
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        return report


class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def create_product(self, product: schemas.ProductCreate) -> Product:
        existing = self.db.query(Product).filter(Product.name == product.name).first()
        if existing:
            raise ValueError(f"产品 '{product.name}' 已存在")
        
        db_product = Product(**product.dict())
        self.db.add(db_product)
        self.db.commit()
        self.db.refresh(db_product)
        return db_product

    def update_product_status(self, product_id: int, status: ProductStatus) -> Product:
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise ValueError("产品不存在")
        
        if status not in ProductStatus:
            raise ValueError("无效的产品状态")
        
        product.status = status
        self.db.commit()
        self.db.refresh(product)
        
        self._update_references_for_product(product)
        
        return product

    def _update_references_for_product(self, product: Product):
        if product.status in [ProductStatus.DEPRECATED, ProductStatus.END_OF_LIFE]:
            all_references = self.db.query(ArticleReference).all()
            analyzer = ReferenceAnalyzer(self.db)
            
            for ref in all_references:
                if ref.status == ReferenceStatus.PROCESSED:
                    continue
                
                source_article = self.db.query(Article).filter(
                    Article.id == ref.source_article_id
                ).first()
                
                if not source_article:
                    continue
                
                target_product = None
                
                if ref.target_article_id:
                    target_article = self.db.query(Article).filter(
                        Article.id == ref.target_article_id
                    ).first()
                    if target_article and target_article.product_id == product.id:
                        target_product = product
                
                if not target_product:
                    target_product = analyzer.match_product_by_keywords(
                        source_article.content,
                        ref.link_text or ""
                    )
                
                if target_product and target_product.id == product.id:
                    is_valid, failure_reason = analyzer.check_product_status(target_product)
                    if not is_valid and failure_reason:
                        ref.status = ReferenceStatus.NEEDS_MANUAL_REVIEW
                        ref.failure_reason = failure_reason
                        ref.failure_detail = f"引用了已下线产品: {product.name} (状态: {product.status.value})"
            
            self.db.commit()

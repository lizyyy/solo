import os
import io
import logging
from pathlib import Path
from typing import Optional, List, Tuple
import pikepdf
from PyPDF2 import PdfReader, PdfWriter

from .models import (
    PDFMetadata, Annotation, Attachment, SanitizationRule
)
from .constants import (
    PDFEncryptedError, PDFCorruptError, IncrementalUpdateError
)

logger = logging.getLogger(__name__)


class PDFProcessor:
    def __init__(self, file_path: str, password: Optional[str] = None):
        self.file_path = Path(file_path)
        self.password = password
        self._pikepdf: Optional[pikepdf.Pdf] = None
        self._pypdf2_reader: Optional[PdfReader] = None
        self._open()

    def _open(self):
        try:
            self._pikepdf = pikepdf.open(str(self.file_path), password=self.password or "")
        except pikepdf.PasswordError:
            raise PDFEncryptedError(f"文件 {self.file_path.name} 已加密，需要密码")
        except Exception as e:
            raise PDFCorruptError(f"无法打开PDF文件: {str(e)}")

        try:
            self._pypdf2_reader = PdfReader(str(self.file_path), strict=False)
            if self._pypdf2_reader.is_encrypted:
                if self.password:
                    self._pypdf2_reader.decrypt(self.password)
                else:
                    raise PDFEncryptedError(f"文件 {self.file_path.name} 已加密")
        except Exception as e:
            logger.warning(f"PyPDF2 打开失败 (pikepdf 已成功): {e}")

    def close(self):
        if self._pikepdf:
            self._pikepdf.close()
            self._pikepdf = None
        self._pypdf2_reader = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def check_incremental_updates(self) -> bool:
        try:
            with open(self.file_path, 'rb') as f:
                content = f.read()
            eof_markers = content.count(b'%%EOF')
            return eof_markers > 1
        except Exception as e:
            logger.warning(f"检测增量更新失败: {e}")
            return False

    def is_encrypted(self) -> bool:
        return self._pikepdf.is_encrypted

    def get_page_count(self) -> int:
        return len(self._pikepdf.pages)

    def read_metadata(self) -> PDFMetadata:
        metadata = PDFMetadata()
        pdf = self._pikepdf

        with pdf.open_metadata() as meta:
            metadata.title = meta.get('dc:title')
            metadata.author = meta.get('dc:creator')
            metadata.subject = meta.get('dc:description')
            metadata.keywords = meta.get('pdf:Keywords')
            metadata.creator = meta.get('xmp:CreatorTool')
            metadata.producer = meta.get('pdf:Producer')
            metadata.creation_date = meta.get('xmp:CreateDate')
            metadata.modification_date = meta.get('xmp:ModifyDate')

            try:
                if hasattr(meta, 'rdf_root') and meta.rdf_root is not None:
                    for desc in meta.rdf_root.findall('.//{http://www.w3.org/1999/02/22-rdf-syntax-ns#}Description'):
                        for attr, value in desc.attrib.items():
                            if '}' in attr:
                                key = attr.split('}')[-1]
                                if key not in metadata.xmp_metadata:
                                    metadata.xmp_metadata[key] = str(value)
            except Exception as e:
                logger.debug(f"解析XMP元数据失败: {e}")

        docinfo = pdf.docinfo
        if docinfo:
            for key in docinfo.keys():
                try:
                    clean_key = key.lstrip('/')
                    value = str(docinfo[key]) if docinfo[key] else None
                    if clean_key.lower() == 'title' and not metadata.title:
                        metadata.title = value
                    elif clean_key.lower() == 'author' and not metadata.author:
                        metadata.author = value
                    elif clean_key.lower() == 'subject' and not metadata.subject:
                        metadata.subject = value
                    elif clean_key.lower() == 'keywords' and not metadata.keywords:
                        metadata.keywords = value
                    elif clean_key.lower() == 'creator' and not metadata.creator:
                        metadata.creator = value
                    elif clean_key.lower() == 'producer' and not metadata.producer:
                        metadata.producer = value
                    elif clean_key.lower() == 'creationdate' and not metadata.creation_date:
                        metadata.creation_date = value
                    elif clean_key.lower() == 'moddate' and not metadata.modification_date:
                        metadata.modification_date = value
                    else:
                        metadata.custom_fields[clean_key] = value
                except Exception as e:
                    logger.debug(f"读取文档信息字段 {key} 失败: {e}")

        return metadata

    def scan_annotations(self) -> List[Annotation]:
        annotations = []
        pdf = self._pikepdf

        for page_idx, page in enumerate(pdf.pages):
            if '/Annots' not in page:
                continue

            try:
                annots = page['/Annots']
                for annot_ref in annots:
                    try:
                        annot = pdf.get_object(annot_ref) if hasattr(annot_ref, 'objgen') else annot_ref
                        if not annot:
                            continue

                        annot_type = str(annot.get('/Subtype', '')).lstrip('/')
                        if not annot_type:
                            continue

                        annotation = Annotation(
                            page=page_idx + 1,
                            type=annot_type,
                            author=str(annot.get('/T', '')) or None,
                            contents=str(annot.get('/Contents', '')) or None,
                            creation_date=str(annot.get('/CreationDate', '')) or None,
                            modification_date=str(annot.get('/M', '')) or None,
                            subject=str(annot.get('/Subj', '')) or None,
                            is_hidden=bool(annot.get('/F', 0) & 2)
                        )
                        annotations.append(annotation)
                    except Exception as e:
                        logger.debug(f"解析批注失败 (第{page_idx + 1}页): {e}")
            except Exception as e:
                logger.debug(f"读取页面批注失败 (第{page_idx + 1}页): {e}")

        return annotations

    def scan_attachments(self) -> List[Attachment]:
        attachments = []
        pdf = self._pikepdf

        try:
            if '/Names' in pdf.Root and '/EmbeddedFiles' in pdf.Root['/Names']:
                ef_tree = pdf.Root['/Names']['/EmbeddedFiles']
                attachments.extend(self._scan_name_tree(ef_tree))
        except Exception as e:
            logger.debug(f"扫描根目录附件失败: {e}")

        try:
            if '/EmbeddedFiles' in pdf.Root:
                for name in pdf.Root['/EmbeddedFiles'].keys():
                    try:
                        fs = pdf.Root['/EmbeddedFiles'][name]
                        attachments.append(self._parse_filespec(fs, str(name)))
                    except Exception as e:
                        logger.debug(f"解析附件 {name} 失败: {e}")
        except Exception:
            pass

        for page_idx, page in enumerate(pdf.pages):
            if '/Annots' not in page:
                continue
            try:
                for annot_ref in page['/Annots']:
                    try:
                        annot = pdf.get_object(annot_ref) if hasattr(annot_ref, 'objgen') else annot_ref
                        if annot and annot.get('/Subtype') == '/FileAttachment':
                            if '/FS' in annot:
                                fs = annot['/FS']
                                att = self._parse_filespec(fs)
                                att.is_hidden = bool(annot.get('/F', 0) & 2)
                                attachments.append(att)
                    except Exception:
                        pass
            except Exception:
                pass

        return attachments

    def _scan_name_tree(self, tree) -> List[Attachment]:
        attachments = []
        pdf = self._pikepdf

        if '/Kids' in tree:
            for kid in tree['/Kids']:
                attachments.extend(self._scan_name_tree(kid))

        if '/Names' in tree:
            names = tree['/Names']
            for i in range(0, len(names), 2):
                try:
                    if i + 1 < len(names):
                        name = str(names[i])
                        fs = names[i + 1]
                        attachments.append(self._parse_filespec(fs, name))
                except Exception as e:
                    logger.debug(f"解析命名树附件失败: {e}")

        return attachments

    def _parse_filespec(self, fs, name: Optional[str] = None) -> Attachment:
        pdf = self._pikepdf
        file_name = name or str(fs.get('/F', fs.get('/UF', 'unknown')))
        size = 0
        is_embedded = False

        try:
            if '/EF' in fs:
                ef = fs['/EF']
                stream_key = '/F' if '/F' in ef else '/UF'
                if stream_key in ef:
                    stream_obj = pdf.get_object(ef[stream_key]) if hasattr(ef[stream_key], 'objgen') else ef[stream_key]
                    if stream_obj and hasattr(stream_obj, '__len__'):
                        size = len(stream_obj.read_bytes()) if hasattr(stream_obj, 'read_bytes') else len(stream_obj)
                        is_embedded = True
        except Exception as e:
            logger.debug(f"获取附件大小失败: {e}")

        return Attachment(
            name=file_name,
            size=size,
            creation_date=str(fs.get('/CreationDate', '')) or None,
            modification_date=str(fs.get('/ModDate', '')) or None,
            description=str(fs.get('/Desc', '')) or None,
            is_embedded=is_embedded,
            is_hidden=False
        )

    def sanitize(self, rule: SanitizationRule, output_path: str, 
                 force_full_rewrite: bool = True) -> 'SanitizationResult':
        from .result import SanitizationResult

        result = SanitizationResult(
            input_file=str(self.file_path),
            output_file=str(output_path),
            original_metadata=self.read_metadata(),
            original_annotations=self.scan_annotations(),
            original_attachments=self.scan_attachments()
        )

        result.has_incremental_updates = self.check_incremental_updates()

        output_pdf = pikepdf.Pdf.new()

        for page in self._pikepdf.pages:
            output_pdf.pages.append(page)

        if rule.clean_metadata:
            with output_pdf.open_metadata(
                set_pikepdf_as_editor=False, update_docinfo=False
            ) as meta:
                for key in list(meta.keys()):
                    if rule.preserve_fields and any(
                        p.lower() in key.lower() for p in rule.preserve_fields
                    ):
                        continue
                    del meta[key]

            docinfo = output_pdf.docinfo
            if docinfo:
                for key in list(docinfo.keys()):
                    del docinfo[key]

        if rule.clean_annotations:
            for page in output_pdf.pages:
                if '/Annots' in page:
                    kept_annots = []
                    for annot_ref in page['/Annots']:
                        try:
                            annot = output_pdf.get_object(annot_ref) if hasattr(annot_ref, 'objgen') else annot_ref
                            annot_type = str(annot.get('/Subtype', '')).lstrip('/')
                            if annot_type not in rule.annotation_types_to_remove:
                                kept_annots.append(annot_ref)
                            else:
                                result.removed_annotations_count += 1
                        except Exception:
                            pass
                    page['/Annots'] = output_pdf.make_indirect(pikepdf.Array(kept_annots))

        if rule.clean_attachments:
            removed_count = 0
            if '/Names' in output_pdf.Root and '/EmbeddedFiles' in output_pdf.Root['/Names']:
                try:
                    ef = output_pdf.Root['/Names']['/EmbeddedFiles']
                    if '/Kids' in ef:
                        removed_count += len(ef['/Kids'])
                    if '/Names' in ef:
                        removed_count += len(ef['/Names']) // 2
                    del output_pdf.Root['/Names']['/EmbeddedFiles']
                except Exception:
                    pass
            result.removed_attachments_count += removed_count

            if '/EmbeddedFiles' in output_pdf.Root:
                result.removed_attachments_count += len(output_pdf.Root['/EmbeddedFiles'])
                del output_pdf.Root['/EmbeddedFiles']

        if rule.clean_javascript:
            if '/JavaScript' in output_pdf.Root:
                del output_pdf.Root['/JavaScript']
            if '/JS' in output_pdf.Root:
                del output_pdf.Root['/JS']
            for page in output_pdf.pages:
                if '/AA' in page:
                    del page['/AA']

        output_path_obj = Path(output_path)
        output_path_obj.parent.mkdir(parents=True, exist_ok=True)

        output_pdf.save(
            str(output_path),
            fix_metadata_version=True,
            compress_streams=True,
            object_stream_mode=pikepdf.ObjectStreamMode.generate
        )
        output_pdf.close()

        with PDFProcessor(output_path) as result_processor:
            result.final_metadata = result_processor.read_metadata()
            result.final_annotations = result_processor.scan_annotations()
            result.final_attachments = result_processor.scan_attachments()

        result.success = True
        return result

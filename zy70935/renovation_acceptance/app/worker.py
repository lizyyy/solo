import logging
from sqlalchemy.orm import Session

from . import services, database, models
from .models import Conclusion, TaskStatus

logger = logging.getLogger(__name__)


def process_batch(batch_id: int) -> None:
    db = database.SessionLocal()
    try:
        batch = db.query(models.AcceptanceBatch).filter(
            models.AcceptanceBatch.id == batch_id
        ).first()
        if batch is None:
            return

        if batch.status != TaskStatus.PROCESSING:
            return

        photos = services.parse_photos(batch.photos)
        if not photos:
            services.update_conclusion(
                db,
                batch,
                operator="system",
                reason="未上传任何照片，进入待补证",
                new_status=TaskStatus.FAILED,
                new_conclusion=Conclusion.PENDING_EVIDENCE,
            )
        else:
            try:
                services.update_conclusion(
                    db,
                    batch,
                    operator="system",
                    reason="材料已解析完毕，等待人工确认",
                    new_status=TaskStatus.MANUAL_CONFIRM,
                    new_conclusion=Conclusion.PENDING,
                )
            except Exception as exc:  # noqa: BLE001
                logger.exception("处理批次 %s 失败", batch.batch_no)
                services.update_conclusion(
                    db,
                    batch,
                    operator="system",
                    reason=f"自动处理失败：{exc}",
                    new_status=TaskStatus.FAILED,
                    new_conclusion=Conclusion.PENDING,
                )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("后台处理批次 %d 失败", batch_id)
    finally:
        db.close()

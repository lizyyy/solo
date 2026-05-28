#!/usr/bin/env python3
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import load_config
from batch_processor import BatchProcessor


def setup_logging():
    log_dir = Path("./logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_dir / "surrender_batch.log", encoding='utf-8'),
            logging.StreamHandler()
        ]
    )


def main():
    setup_logging()
    logger = logging.getLogger(__name__)
    
    try:
        config = load_config()
        processor = BatchProcessor(config)
        summary = processor.run_batch()
        
        critical_count = len(summary.get('critical_exceptions', []))
        if critical_count > 0:
            logger.warning(f"批处理完成，但存在{critical_count}个严重异常需人工处理")
            sys.exit(1)
        else:
            logger.info("批处理完成，无严重异常")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"批处理执行失败: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()

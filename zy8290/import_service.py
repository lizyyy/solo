from typing import Dict, Any, List, Optional, Callable
from database import (
    BatchManager, ProductManager, FailedRowManager, LogManager,
    get_connection, init_database
)
from validator import FieldValidator
from file_parser import FileParser


class ImportProgress:
    def __init__(self):
        self.current = 0
        self.total = 0
        self.success_count = 0
        self.failed_count = 0
        self.status = 'pending'
        self.current_message = ''


class ImportService:
    def __init__(self):
        init_database()
        self.progress_callback: Optional[Callable[[ImportProgress], None]] = None

    def set_progress_callback(self, callback: Callable[[ImportProgress], None]):
        self.progress_callback = callback

    def _notify_progress(self, progress: ImportProgress):
        if self.progress_callback:
            self.progress_callback(progress)

    def pre_validate_file(self, file_path: str) -> Dict[str, Any]:
        LogManager.add_log(
            batch_id=None,
            log_type='info',
            message=f'开始预检文件: {file_path}'
        )

        try:
            validation_results = FileParser.parse_and_validate(file_path)

            LogManager.add_log(
                batch_id=None,
                log_type='info',
                message=f'文件预检完成: 总计 {validation_results["total_rows"]} 行, '
                       f'有效 {len(validation_results["valid_rows"])} 行, '
                       f'无效 {len(validation_results["invalid_rows"])} 行'
            )

            return validation_results

        except Exception as e:
            LogManager.add_log(
                batch_id=None,
                log_type='error',
                message=f'文件预检失败: {str(e)}'
            )
            raise

    def import_file(self, file_path: str, validation_results: Dict[str, Any] = None) -> int:
        if validation_results is None:
            validation_results = self.pre_validate_file(file_path)

        batch_id = BatchManager.create_batch(
            file_name=FileParser.get_file_info(file_path)['file_name'],
            file_path=file_path,
            total_rows=validation_results['total_rows']
        )

        LogManager.add_log(
            batch_id=batch_id,
            log_type='info',
            message=f'开始导入批次 {batch_id}'
        )

        BatchManager.update_batch_status(batch_id, 'running')

        progress = ImportProgress()
        progress.total = validation_results['total_rows']
        progress.status = 'running'
        self._notify_progress(progress)

        success_count = 0
        failed_count = 0

        for valid_row in validation_results['valid_rows']:
            progress.current += 1
            progress.current_message = f'处理第 {valid_row["row_number"]} 行...'

            try:
                parsed_data = valid_row['parsed_data']

                if ProductManager.add_product(parsed_data):
                    success_count += 1
                    LogManager.add_log(
                        batch_id=batch_id,
                        log_type='success',
                        message=f'第 {valid_row["row_number"]} 行导入成功: '
                               f'商品编码 {parsed_data.get("product_code")}'
                    )
                else:
                    failed_count += 1
                    FailedRowManager.add_failed_row(
                        batch_id=batch_id,
                        row_number=valid_row['row_number'],
                        field_name='商品编码',
                        original_value=parsed_data.get('product_code', ''),
                        error_type='database_error',
                        error_message='数据库写入失败',
                        fix_suggestion='请检查数据库状态或联系技术支持',
                        row_data=valid_row['original_data']
                    )
                    LogManager.add_log(
                        batch_id=batch_id,
                        log_type='error',
                        message=f'第 {valid_row["row_number"]} 行导入失败: 数据库错误'
                    )

            except Exception as e:
                failed_count += 1
                FailedRowManager.add_failed_row(
                    batch_id=batch_id,
                    row_number=valid_row['row_number'],
                    field_name='',
                    original_value='',
                    error_type='exception',
                    error_message=f'异常错误: {str(e)}',
                    fix_suggestion='请联系技术支持',
                    row_data=valid_row['original_data']
                )
                LogManager.add_log(
                    batch_id=batch_id,
                    log_type='error',
                    message=f'第 {valid_row["row_number"]} 行导入异常: {str(e)}'
                )

            progress.success_count = success_count
            progress.failed_count = failed_count
            self._notify_progress(progress)

        for invalid_row in validation_results['invalid_rows']:
            progress.current += 1
            failed_count += 1

            error = invalid_row['error']
            FailedRowManager.add_failed_row(
                batch_id=batch_id,
                row_number=invalid_row['row_number'],
                field_name=error.get('field_name', ''),
                original_value=error.get('original_value', ''),
                error_type=error.get('error_type', ''),
                error_message=error.get('error_message', ''),
                fix_suggestion=error.get('fix_suggestion', ''),
                row_data=invalid_row['original_data']
            )

            LogManager.add_log(
                batch_id=batch_id,
                log_type='error',
                message=f'第 {invalid_row["row_number"]} 行验证失败: {error.get("error_message")}'
            )

            progress.current_message = f'记录失败行 {invalid_row["row_number"]}...'
            progress.failed_count = failed_count
            self._notify_progress(progress)

        if failed_count > 0:
            status = 'completed_with_errors'
        else:
            status = 'completed'

        BatchManager.update_batch_status(
            batch_id=batch_id,
            status=status,
            success_count=success_count,
            failed_count=failed_count
        )

        progress.status = status
        progress.current_message = '导入完成'
        self._notify_progress(progress)

        LogManager.add_log(
            batch_id=batch_id,
            log_type='info',
            message=f'批次 {batch_id} 导入完成: 成功 {success_count} 行, 失败 {failed_count} 行'
        )

        return batch_id

    def retry_failed_rows(self, batch_id: int) -> Dict[str, Any]:
        batch = BatchManager.get_batch_by_id(batch_id)
        if not batch:
            raise ValueError(f'批次不存在: {batch_id}')

        failed_rows = FailedRowManager.get_failed_rows(batch_id)
        if not failed_rows:
            return {
                'success_count': 0,
                'failed_count': 0,
                'message': '没有需要重试的失败行'
            }

        LogManager.add_log(
            batch_id=batch_id,
            log_type='info',
            message=f'开始重试批次 {batch_id} 的失败行，共 {len(failed_rows)} 行'
        )

        progress = ImportProgress()
        progress.total = len(failed_rows)
        progress.status = 'running'
        self._notify_progress(progress)

        success_count = 0
        failed_count = 0

        for failed_row in failed_rows:
            progress.current += 1
            row_data = failed_row['row_data']

            is_valid, errors = FieldValidator.validate_row(
                row_data,
                existing_codes_in_file=set(),
                check_db_duplicate=True
            )

            if is_valid:
                parsed_data = FieldValidator.parse_row(row_data)

                if ProductManager.add_product(parsed_data):
                    success_count += 1
                    FailedRowManager.mark_as_resolved(failed_row['id'])

                    LogManager.add_log(
                        batch_id=batch_id,
                        log_type='success',
                        message=f'重试成功: 第 {failed_row["row_number"]} 行, '
                               f'商品编码 {parsed_data.get("product_code")}'
                    )
                else:
                    failed_count += 1
                    FailedRowManager.mark_as_retried(failed_row['id'])

                    LogManager.add_log(
                        batch_id=batch_id,
                        log_type='error',
                        message=f'重试失败: 第 {failed_row["row_number"]} 行, 数据库写入错误'
                    )
            else:
                failed_count += 1
                FailedRowManager.mark_as_retried(failed_row['id'])

                for error in errors:
                    LogManager.add_log(
                        batch_id=batch_id,
                        log_type='error',
                        message=f'重试验证失败: 第 {failed_row["row_number"]} 行, {error.error_message}'
                    )

            progress.success_count = success_count
            progress.failed_count = failed_count
            self._notify_progress(progress)

        new_success_count = batch['success_count'] + success_count
        new_failed_count = batch['failed_count'] - success_count

        if new_failed_count > 0:
            status = 'completed_with_errors'
        else:
            status = 'completed'

        BatchManager.update_batch_status(
            batch_id=batch_id,
            status=status,
            success_count=new_success_count,
            failed_count=new_failed_count
        )

        progress.status = status
        progress.current_message = '重试完成'
        self._notify_progress(progress)

        LogManager.add_log(
            batch_id=batch_id,
            log_type='info',
            message=f'批次 {batch_id} 重试完成: 成功 {success_count} 行, 失败 {failed_count} 行'
        )

        return {
            'success_count': success_count,
            'failed_count': failed_count,
            'message': f'重试完成: 成功 {success_count} 行, 失败 {failed_count} 行'
        }

    def get_batch_summary(self, batch_id: int) -> Dict[str, Any]:
        batch = BatchManager.get_batch_by_id(batch_id)
        if not batch:
            return None

        failed_rows = FailedRowManager.get_failed_rows(batch_id)
        logs = LogManager.get_logs(batch_id=batch_id, limit=100)

        error_types = {}
        for fr in failed_rows:
            error_type = fr['error_type']
            if error_type not in error_types:
                error_types[error_type] = 0
            error_types[error_type] += 1

        return {
            'batch_info': batch,
            'failed_rows_count': len(failed_rows),
            'error_types': error_types,
            'logs': logs
        }

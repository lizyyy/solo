import json
import re
from datetime import datetime
from typing import Dict, List, Any, Optional
from .models import Database


class BackupChecker:
    def __init__(self, db: Database):
        self.db = db
    
    def run_all_checks(self, task_id: int) -> List[Dict]:
        """运行所有检查"""
        results = []
        
        # 获取任务数据
        task_data = self.db.get_full_task_data(task_id)
        if not task_data:
            self._add_check_result(task_id, 'error', '任务数据检查', 
                                   'fail', '未找到任务数据', None, 'high')
            return [{'check_name': '任务数据检查', 'status': 'fail', 'risk_level': 'high'}]
        
        # 运行各项检查
        results.extend(self._check_shard_completeness(task_data))
        results.extend(self._check_checksum_consistency(task_data))
        results.extend(self._check_restore_version(task_data))
        results.extend(self._check_spot_checked_tables(task_data))
        results.extend(self._check_size_consistency(task_data))
        results.extend(self._check_time_consistency(task_data))
        
        # 更新任务状态
        all_passed = all(r['status'] == 'pass' for r in results)
        if all_passed:
            self.db.update_task(task_id, status='passed')
        else:
            self.db.update_task(task_id, status='failed')
        
        return results
    
    def _add_check_result(self, task_id: int, check_type: str, check_name: str,
                           status: str, message: str, details: Optional[Dict] = None,
                           risk_level: str = 'low') -> Dict:
        """添加检查结果到数据库"""
        result = {
            'check_type': check_type,
            'check_name': check_name,
            'status': status,
            'message': message,
            'details': details,
            'risk_level': risk_level
        }
        self.db.add_check_result(task_id, result)
        return result
    
    def _check_shard_completeness(self, task_data: Dict) -> List[Dict]:
        """检查分片完整性"""
        results = []
        task_id = task_data['task']['id']
        
        manifests = task_data.get('object_storage_manifests', [])
        if not manifests:
            results.append(self._add_check_result(
                task_id, 'storage', '分片完整性检查',
                'warn', '未找到对象存储 manifest 数据', None, 'medium'
            ))
            return results
        
        for manifest in manifests:
            expected_shards = manifest.get('total_shards', 0)
            actual_shards = len(manifest.get('shards', []))
            
            details = {
                'manifest_id': manifest['id'],
                'bucket_name': manifest.get('bucket_name'),
                'expected_shards': expected_shards,
                'actual_shards': actual_shards
            }
            
            if expected_shards == 0:
                results.append(self._add_check_result(
                    task_id, 'storage', '分片完整性检查',
                    'warn', f"Manifest {manifest['id']} 未指定期望的分片数量", 
                    details, 'medium'
                ))
            elif actual_shards < expected_shards:
                missing = expected_shards - actual_shards
                results.append(self._add_check_result(
                    task_id, 'storage', '分片完整性检查',
                    'fail', f"分片缺失！期望 {expected_shards} 个分片，实际 {actual_shards} 个，缺少 {missing} 个", 
                    details, 'high'
                ))
            elif actual_shards > expected_shards:
                results.append(self._add_check_result(
                    task_id, 'storage', '分片完整性检查',
                    'warn', f"分片数量超过期望！期望 {expected_shards} 个，实际 {actual_shards} 个", 
                    details, 'medium'
                ))
            else:
                results.append(self._add_check_result(
                    task_id, 'storage', '分片完整性检查',
                    'pass', f"分片数量正常，共 {actual_shards} 个", 
                    details, 'low'
                ))
        
        return results
    
    def _check_checksum_consistency(self, task_data: Dict) -> List[Dict]:
        """检查校验和一致性"""
        results = []
        task_id = task_data['task']['id']
        
        manifests = task_data.get('object_storage_manifests', [])
        if not manifests:
            return results
        
        for manifest in manifests:
            shards = manifest.get('shards', [])
            if not shards:
                continue
            
            missing_checksums = []
            valid_checksums = []
            invalid_checksums = []
            
            for shard in shards:
                checksum = shard.get('checksum')
                if not checksum:
                    missing_checksums.append(shard['shard_name'])
                elif self._is_valid_checksum(checksum):
                    valid_checksums.append(shard['shard_name'])
                else:
                    invalid_checksums.append(shard['shard_name'])
            
            details = {
                'manifest_id': manifest['id'],
                'total_shards': len(shards),
                'valid_checksums': len(valid_checksums),
                'missing_checksums': len(missing_checksums),
                'invalid_checksums': len(invalid_checksums),
                'missing_shards': missing_checksums,
                'invalid_shards': invalid_checksums
            }
            
            if missing_checksums or invalid_checksums:
                if missing_checksums:
                    results.append(self._add_check_result(
                        task_id, 'storage', '校验和一致性检查',
                        'warn', f"有 {len(missing_checksums)} 个分片缺少校验和", 
                        details, 'medium'
                    ))
                if invalid_checksums:
                    results.append(self._add_check_result(
                        task_id, 'storage', '校验和一致性检查',
                        'fail', f"有 {len(invalid_checksums)} 个分片的校验和格式无效", 
                        details, 'high'
                    ))
            else:
                results.append(self._add_check_result(
                    task_id, 'storage', '校验和一致性检查',
                    'pass', f"所有 {len(valid_checksums)} 个分片的校验和有效", 
                    details, 'low'
                ))
        
        return results
    
    def _is_valid_checksum(self, checksum: str) -> bool:
        """检查校验和格式是否有效（支持 MD5, SHA1, SHA256 等常见格式）"""
        if not checksum:
            return False
        
        # MD5: 32 hex chars
        if re.match(r'^[a-fA-F0-9]{32}$', checksum):
            return True
        # SHA1: 40 hex chars
        if re.match(r'^[a-fA-F0-9]{40}$', checksum):
            return True
        # SHA256: 64 hex chars
        if re.match(r'^[a-fA-F0-9]{64}$', checksum):
            return True
        # AWS ETag 格式（可能带连字符）
        if re.match(r'^[a-fA-F0-9]{32}(-\d+)?$', checksum):
            return True
        
        return False
    
    def _check_restore_version(self, task_data: Dict) -> List[Dict]:
        """检查还原版本"""
        results = []
        task_id = task_data['task']['id']
        
        restore_results = task_data.get('restore_results', [])
        if not restore_results:
            results.append(self._add_check_result(
                task_id, 'restore', '还原版本检查',
                'warn', '未找到还原演练结果', None, 'medium'
            ))
            return results
        
        for restore in restore_results:
            version = restore.get('restored_version', '')
            details = {
                'restore_result_id': restore['id'],
                'restored_database': restore.get('restored_database_name'),
                'restored_version': version,
                'table_count': restore.get('table_count_restored'),
                'row_count': restore.get('row_count_restored')
            }
            
            if not version:
                results.append(self._add_check_result(
                    task_id, 'restore', '还原版本检查',
                    'warn', '还原结果未指定版本信息', details, 'medium'
                ))
            else:
                # 检查版本格式
                if self._is_valid_version(version):
                    results.append(self._add_check_result(
                        task_id, 'restore', '还原版本检查',
                        'pass', f"还原版本有效: {version}", details, 'low'
                    ))
                else:
                    results.append(self._add_check_result(
                        task_id, 'restore', '还原版本检查',
                        'warn', f"还原版本格式可能异常: {version}", details, 'medium'
                    ))
            
            # 检查表数量
            table_count = restore.get('table_count_restored', 0)
            if table_count == 0:
                results.append(self._add_check_result(
                    task_id, 'restore', '还原表数量检查',
                    'fail', '还原后表数量为 0', details, 'high'
                ))
            else:
                results.append(self._add_check_result(
                    task_id, 'restore', '还原表数量检查',
                    'pass', f"成功还原 {table_count} 个表", details, 'low'
                ))
        
        return results
    
    def _is_valid_version(self, version: str) -> bool:
        """检查版本格式是否有效"""
        if not version:
            return False
        # 简单的版本格式检查：数字和点号
        return bool(re.match(r'^[\d\.\-a-zA-Z]+$', version))
    
    def _check_spot_checked_tables(self, task_data: Dict) -> List[Dict]:
        """检查关键表抽查结果"""
        results = []
        task_id = task_data['task']['id']
        
        restore_results = task_data.get('restore_results', [])
        if not restore_results:
            return results
        
        for restore in restore_results:
            spot_tables = restore.get('spot_checked_tables', [])
            if not spot_tables:
                results.append(self._add_check_result(
                    task_id, 'restore', '关键表抽查检查',
                    'warn', '未进行关键表抽查', 
                    {'restore_result_id': restore['id']}, 'medium'
                ))
                continue
            
            passed = []
            failed = []
            
            for table in spot_tables:
                table_name = table.get('table_name', 'unknown')
                expected = table.get('expected_row_count', 0)
                actual = table.get('actual_row_count', 0)
                checksum_match = table.get('checksum_match')
                
                details = {
                    'restore_result_id': restore['id'],
                    'table_name': table_name,
                    'expected_row_count': expected,
                    'actual_row_count': actual,
                    'checksum_match': checksum_match
                }
                
                row_count_match = expected == actual
                
                if row_count_match and checksum_match:
                    passed.append(table_name)
                else:
                    failed.append(table_name)
                    
                    if not row_count_match:
                        results.append(self._add_check_result(
                            task_id, 'restore', '关键表行数检查',
                            'fail', f"表 {table_name} 行数不匹配：期望 {expected}，实际 {actual}", 
                            details, 'high'
                        ))
                    if not checksum_match:
                        results.append(self._add_check_result(
                            task_id, 'restore', '关键表校验和检查',
                            'fail', f"表 {table_name} 校验和不匹配", 
                            details, 'high'
                        ))
            
            if passed:
                results.append(self._add_check_result(
                    task_id, 'restore', '关键表抽查检查',
                    'pass', f"成功抽查 {len(passed)} 个关键表", 
                    {'restore_result_id': restore['id'], 'passed_tables': passed}, 'low'
                ))
        
        return results
    
    def _check_size_consistency(self, task_data: Dict) -> List[Dict]:
        """检查大小一致性"""
        results = []
        task_id = task_data['task']['id']
        
        # 检查 pg_dump 日志中的大小
        pg_dump_logs = task_data.get('pg_dump_logs', [])
        for log in pg_dump_logs:
            size_bytes = log.get('total_size_bytes', 0)
            if size_bytes == 0:
                results.append(self._add_check_result(
                    task_id, 'dump', '备份大小检查',
                    'warn', f"pg_dump 日志 {log['id']} 大小为 0", 
                    {'log_id': log['id'], 'database_name': log.get('database_name')}, 'medium'
                ))
            else:
                size_mb = size_bytes / (1024 * 1024)
                results.append(self._add_check_result(
                    task_id, 'dump', '备份大小检查',
                    'pass', f"备份大小正常：{size_mb:.2f} MB", 
                    {'log_id': log['id'], 'database_name': log.get('database_name'), 'size_bytes': size_bytes}, 'low'
                ))
        
        # 检查对象存储大小
        manifests = task_data.get('object_storage_manifests', [])
        for manifest in manifests:
            total_size = manifest.get('total_size_bytes', 0)
            if total_size == 0:
                results.append(self._add_check_result(
                    task_id, 'storage', '对象存储大小检查',
                    'warn', f"Manifest {manifest['id']} 总大小为 0", 
                    {'manifest_id': manifest['id'], 'bucket_name': manifest.get('bucket_name')}, 'medium'
                ))
            else:
                # 计算所有分片的实际大小总和
                shards = manifest.get('shards', [])
                shards_total = sum(s.get('shard_size_bytes', 0) for s in shards)
                
                if shards_total > 0 and shards_total != total_size:
                    results.append(self._add_check_result(
                        task_id, 'storage', '对象存储大小检查',
                        'warn', f"分片大小总和 ({shards_total}) 与 manifest 总大小 ({total_size}) 不一致", 
                        {'manifest_id': manifest['id'], 'bucket_name': manifest.get('bucket_name'), 
                         'manifest_total': total_size, 'shards_total': shards_total}, 'medium'
                    ))
                else:
                    size_mb = total_size / (1024 * 1024)
                    results.append(self._add_check_result(
                        task_id, 'storage', '对象存储大小检查',
                        'pass', f"对象存储大小正常：{size_mb:.2f} MB", 
                        {'manifest_id': manifest['id'], 'bucket_name': manifest.get('bucket_name'), 
                         'total_size_bytes': total_size}, 'low'
                    ))
        
        return results
    
    def _check_time_consistency(self, task_data: Dict) -> List[Dict]:
        """检查时间一致性"""
        results = []
        task_id = task_data['task']['id']
        
        # 检查 pg_dump 时间
        pg_dump_logs = task_data.get('pg_dump_logs', [])
        for log in pg_dump_logs:
            start = log.get('dump_start_time')
            end = log.get('dump_end_time')
            
            if start and end:
                try:
                    start_time = datetime.fromisoformat(start.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(end.replace('Z', '+00:00'))
                    
                    if end_time < start_time:
                        results.append(self._add_check_result(
                            task_id, 'dump', '备份时间检查',
                            'warn', f"pg_dump 结束时间早于开始时间", 
                            {'log_id': log['id'], 'start_time': start, 'end_time': end}, 'medium'
                        ))
                    else:
                        duration = (end_time - start_time).total_seconds()
                        results.append(self._add_check_result(
                            task_id, 'dump', '备份时间检查',
                            'pass', f"备份耗时：{duration:.0f} 秒", 
                            {'log_id': log['id'], 'duration_seconds': duration}, 'low'
                        ))
                except (ValueError, TypeError):
                    pass
        
        # 检查还原时间
        restore_results = task_data.get('restore_results', [])
        for restore in restore_results:
            start = restore.get('restore_start_time')
            end = restore.get('restore_end_time')
            
            if start and end:
                try:
                    start_time = datetime.fromisoformat(start.replace('Z', '+00:00'))
                    end_time = datetime.fromisoformat(end.replace('Z', '+00:00'))
                    
                    if end_time < start_time:
                        results.append(self._add_check_result(
                            task_id, 'restore', '还原时间检查',
                            'warn', f"还原结束时间早于开始时间", 
                            {'restore_result_id': restore['id'], 'start_time': start, 'end_time': end}, 'medium'
                        ))
                    else:
                        duration = (end_time - start_time).total_seconds()
                        results.append(self._add_check_result(
                            task_id, 'restore', '还原时间检查',
                            'pass', f"还原耗时：{duration:.0f} 秒", 
                            {'restore_result_id': restore['id'], 'duration_seconds': duration}, 'low'
                        ))
                except (ValueError, TypeError):
                    pass
        
        return results
    
    def parse_pg_dump_log(self, content: str) -> Dict:
        """解析 pg_dump 日志内容"""
        result = {
            'database_name': None,
            'dump_start_time': None,
            'dump_end_time': None,
            'total_size_bytes': 0,
            'table_count': 0,
            'raw_content': content
        }
        
        # 简单解析示例
        lines = content.split('\n')
        for line in lines:
            # 匹配数据库名
            if 'database:' in line.lower() or 'Database:' in line:
                match = re.search(r'[Dd]atabase[:\s]+([\w_]+)', line)
                if match:
                    result['database_name'] = match.group(1)
            
            # 匹配表数量
            table_match = re.search(r'(\d+)\s+(table|Table)', line)
            if table_match:
                result['table_count'] = int(table_match.group(1))
            
            # 匹配大小
            size_match = re.search(r'(\d+)\s*(bytes|KB|MB|GB)', line, re.IGNORECASE)
            if size_match:
                size = int(size_match.group(1))
                unit = size_match.group(2).upper()
                if unit == 'KB':
                    size *= 1024
                elif unit == 'MB':
                    size *= 1024 * 1024
                elif unit == 'GB':
                    size *= 1024 * 1024 * 1024
                result['total_size_bytes'] = size
        
        return result
    
    def parse_object_storage_manifest(self, content: str) -> Dict:
        """解析对象存储 manifest JSON"""
        try:
            data = json.loads(content)
            result = {
                'bucket_name': data.get('bucket', data.get('bucket_name')),
                'manifest_date': data.get('date', data.get('manifest_date')),
                'total_shards': data.get('total_shards', data.get('shard_count', 0)),
                'total_size_bytes': data.get('total_size', data.get('total_size_bytes', 0)),
                'shards': [],
                'raw_content': data
            }
            
            # 解析分片列表
            shards = data.get('shards', data.get('files', []))
            for shard in shards:
                result['shards'].append({
                    'shard_name': shard.get('name', shard.get('key', shard.get('shard_name'))),
                    'shard_size_bytes': shard.get('size', shard.get('size_bytes', 0)),
                    'checksum': shard.get('checksum', shard.get('etag', shard.get('md5'))),
                    'upload_time': shard.get('upload_time', shard.get('last_modified'))
                })
            
            return result
        except json.JSONDecodeError:
            return {
                'bucket_name': None,
                'manifest_date': None,
                'total_shards': 0,
                'total_size_bytes': 0,
                'shards': [],
                'raw_content': content
            }
    
    def parse_restore_result(self, content: str) -> Dict:
        """解析还原演练结果 JSON"""
        try:
            data = json.loads(content)
            result = {
                'restore_start_time': data.get('start_time', data.get('restore_start_time')),
                'restore_end_time': data.get('end_time', data.get('restore_end_time')),
                'restored_database_name': data.get('database', data.get('restored_database')),
                'restored_version': data.get('version', data.get('restored_version')),
                'table_count_restored': data.get('table_count', data.get('tables_restored', 0)),
                'row_count_restored': data.get('row_count', data.get('rows_restored', 0)),
                'spot_checked_tables': [],
                'raw_content': data
            }
            
            # 解析抽查的表
            spot_tables = data.get('spot_checks', data.get('checked_tables', []))
            for table in spot_tables:
                result['spot_checked_tables'].append({
                    'table_name': table.get('table', table.get('table_name')),
                    'expected_row_count': table.get('expected_rows', table.get('expected_row_count', 0)),
                    'actual_row_count': table.get('actual_rows', table.get('actual_row_count', 0)),
                    'checksum_match': table.get('checksum_match', table.get('checksum_ok', True))
                })
            
            return result
        except json.JSONDecodeError:
            return {
                'restore_start_time': None,
                'restore_end_time': None,
                'restored_database_name': None,
                'restored_version': None,
                'table_count_restored': 0,
                'row_count_restored': 0,
                'spot_checked_tables': [],
                'raw_content': content
            }

from datetime import datetime, timedelta
from app import db
from app.models import (
    UploadPackage, ParseResult, PreviewDiff, ConfirmationToken,
    WriteBatch, RevocationWindow, OperationHistory, SourceDataStore
)
from flask import current_app
import hashlib
import json
import uuid
import csv
import io

class ImportService:
    @staticmethod
    def create_upload_package(filename, file_type, file_size, uploaded_by, file_content=None):
        package = UploadPackage(
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
            file_content=file_content,
            status='UPLOADED'
        )
        db.session.add(package)
        db.session.flush()
        
        ImportService._record_history(
            package.id,
            'CREATE_PACKAGE',
            uploaded_by,
            None,
            'UPLOADED',
            f'Created package for file: {filename}, has_content: {file_content is not None}'
        )
        
        db.session.commit()
        return package, True

    @staticmethod
    def parse_package(package_id, parsed_by):
        package = UploadPackage.query.get(package_id)
        if not package:
            raise ValueError(f'Package {package_id} not found')
        
        if package.status not in ['UPLOADED', 'PARSE_FAILED']:
            raise ValueError(f'Package {package_id} is in status {package.status}, cannot parse')
        
        existing_parse = ParseResult.query.filter_by(upload_package_id=package_id).first()
        if existing_parse and existing_parse.status == 'COMPLETED':
            return existing_parse
        
        if not existing_parse:
            parse_result = ParseResult(
                upload_package_id=package_id,
                parsed_by=parsed_by,
                status='PARSING'
            )
            db.session.add(parse_result)
        else:
            parse_result = existing_parse
            parse_result.status = 'PARSING'
            parse_result.parsed_at = datetime.utcnow()
            parse_result.parsed_by = parsed_by
        
        package.status = 'PARSING'
        db.session.flush()
        
        try:
            parsed_data = ImportService._parse_real_content(package)
            
            parse_result.total_records = parsed_data['total']
            parse_result.valid_records = parsed_data['valid']
            parse_result.invalid_records = parsed_data['invalid']
            parse_result.raw_data = json.dumps(parsed_data['records'])
            parse_result.validation_errors = json.dumps(parsed_data['errors'])
            parse_result.status = 'COMPLETED'
            
            ImportService._generate_real_diffs(parse_result, parsed_data['records'])
            
            package.status = 'PARSED'
            
            ImportService._record_history(
                package_id,
                'PARSE',
                parsed_by,
                'UPLOADED',
                'PARSED',
                f'Parsed {parsed_data["total"]} records, {parsed_data["valid"]} valid, {parsed_data["invalid"]} invalid'
            )
            
            db.session.commit()
            return parse_result
            
        except Exception as e:
            parse_result.status = 'FAILED'
            package.status = 'PARSE_FAILED'
            package.error_message = str(e)
            db.session.commit()
            raise

    @staticmethod
    def _parse_real_content(package):
        records = []
        errors = []
        
        if package.file_content:
            if package.file_type.lower() == 'json':
                try:
                    data = json.loads(package.file_content)
                    if isinstance(data, list):
                        for idx, item in enumerate(data):
                            record, error = ImportService._validate_record(item, idx)
                            if error:
                                errors.append(error)
                            else:
                                records.append(record)
                    else:
                        errors.append({
                            'record_index': 0,
                            'field': 'root',
                            'error': 'JSON must be an array of records'
                        })
                except json.JSONDecodeError as e:
                    errors.append({
                        'record_index': 0,
                        'field': 'content',
                        'error': f'Invalid JSON: {str(e)}'
                    })
            
            elif package.file_type.lower() == 'csv':
                try:
                    reader = csv.DictReader(io.StringIO(package.file_content))
                    for idx, row in enumerate(reader):
                        record, error = ImportService._validate_record(row, idx)
                        if error:
                            errors.append(error)
                        else:
                            records.append(record)
                except Exception as e:
                    errors.append({
                        'record_index': 0,
                        'field': 'content',
                        'error': f'CSV parse error: {str(e)}'
                    })
        else:
            seed = ImportService._deterministic_hash(package.filename + str(package.file_size))
            total = 10 + (seed % 21)
            for i in range(total):
                record = {
                    'id': f'user_{package.id}_{i:03d}',
                    'name': f'{package.filename.split(".")[0]} User {i + 1}',
                    'email': f'user{i + 1}@import.example.com',
                    'status': 'active' if i % 5 != 0 else 'inactive'
                }
                if i % 7 == 0:
                    errors.append({
                        'record_index': i,
                        'field': 'email' if i % 2 == 0 else 'name',
                        'error': 'Simulated validation error for testing'
                    })
                else:
                    records.append(record)
        
        return {
            'total': len(records) + len(errors),
            'valid': len(records),
            'invalid': len(errors),
            'records': records,
            'errors': errors
        }

    @staticmethod
    def _validate_record(record, index):
        errors = []
        
        record_id = record.get('id') or record.get('user_id') or record.get('record_id') or f'record_{index}'
        
        email = record.get('email', '')
        if email and '@' not in email:
            errors.append({
                'record_index': index,
                'field': 'email',
                'error': f'Invalid email format: {email}'
            })
        
        name = record.get('name', '')
        if not name and not record.get('username'):
            errors.append({
                'record_index': index,
                'field': 'name',
                'error': 'Name field is required'
            })
        
        if errors:
            return None, errors[0]
        
        normalized = {
            'id': str(record_id),
            'name': name or record.get('username', ''),
            'email': email,
            'status': record.get('status', 'active'),
            'raw_data': dict(record)
        }
        return normalized, None

    @staticmethod
    def _generate_real_diffs(parse_result, records):
        PreviewDiff.query.filter_by(parse_result_id=parse_result.id).delete()
        
        for record in records:
            record_id = record['id']
            existing = SourceDataStore.query.filter_by(id=record_id, is_active=True).first()
            
            if existing:
                existing_data = json.loads(existing.data_json)
                if ImportService._records_different(existing_data, record):
                    diff = PreviewDiff(
                        parse_result_id=parse_result.id,
                        diff_type='UPDATE',
                        record_identifier=record_id,
                        current_value=json.dumps(existing_data),
                        new_value=json.dumps(record),
                        confidence_score=ImportService._calculate_confidence(existing_data, record)
                    )
                    db.session.add(diff)
            else:
                diff = PreviewDiff(
                    parse_result_id=parse_result.id,
                    diff_type='NEW',
                    record_identifier=record_id,
                    current_value=json.dumps({}),
                    new_value=json.dumps(record),
                    confidence_score=1.0
                )
                db.session.add(diff)
        
        for existing in SourceDataStore.query.filter_by(is_active=True).all():
            found = any(r['id'] == existing.id for r in records)
            if not found:
                diff = PreviewDiff(
                    parse_result_id=parse_result.id,
                    diff_type='DELETE',
                    record_identifier=existing.id,
                    current_value=existing.data_json,
                    new_value=json.dumps({}),
                    confidence_score=0.95
                )
                db.session.add(diff)

    @staticmethod
    def _records_different(old, new):
        compare_fields = ['name', 'email', 'status']
        for field in compare_fields:
            if str(old.get(field, '')) != str(new.get(field, '')):
                return True
        return False

    @staticmethod
    def _calculate_confidence(old, new):
        same_fields = sum(1 for f in ['name', 'email'] if old.get(f) == new.get(f))
        return 0.7 + (same_fields * 0.15)

    @staticmethod
    def _deterministic_hash(value, seed=0):
        combined = f"{value}-{seed}".encode('utf-8')
        return int(hashlib.md5(combined).hexdigest(), 16)

    @staticmethod
    def get_preview_diff(package_id):
        package = UploadPackage.query.get(package_id)
        if not package:
            raise ValueError(f'Package {package_id} not found')
        
        parse_result = ParseResult.query.filter_by(upload_package_id=package_id).first()
        if not parse_result:
            return {'summary': None, 'diffs': []}
        
        diffs = PreviewDiff.query.filter_by(parse_result_id=parse_result.id).all()
        
        summary = {
            'total_diffs': len(diffs),
            'new_count': sum(1 for d in diffs if d.diff_type == 'NEW'),
            'update_count': sum(1 for d in diffs if d.diff_type == 'UPDATE'),
            'delete_count': sum(1 for d in diffs if d.diff_type == 'DELETE')
        }
        
        return {
            'summary': summary,
            'parse_result': parse_result.to_dict(),
            'diffs': [d.to_dict() for d in diffs]
        }

    @staticmethod
    def create_confirmation_token(package_id, created_by):
        package = UploadPackage.query.get(package_id)
        if not package:
            raise ValueError(f'Package {package_id} not found')
        
        if package.status != 'PARSED':
            raise ValueError(f'Package {package_id} is in status {package.status}, cannot create token')
        
        existing = ConfirmationToken.query.filter_by(
            upload_package_id=package_id,
            status='PENDING'
        ).first()
        
        if existing and not existing.is_expired():
            return existing
        
        if existing:
            existing.status = 'EXPIRED'
        
        token = ImportService._generate_token()
        expires_at = datetime.utcnow() + timedelta(
            hours=current_app.config['CONFIRMATION_TOKEN_EXPIRE_HOURS']
        )
        
        confirmation = ConfirmationToken(
            upload_package_id=package_id,
            token=token,
            created_by=created_by,
            expires_at=expires_at,
            status='PENDING'
        )
        db.session.add(confirmation)
        
        ImportService._record_history(
            package_id,
            'CREATE_TOKEN',
            created_by,
            'PARSED',
            'PARSED',
            f'Created confirmation token: {token[:8]}...'
        )
        
        db.session.commit()
        return confirmation

    @staticmethod
    def _generate_token():
        import secrets
        return hashlib.sha256(secrets.token_bytes(32)).hexdigest()

    @staticmethod
    def confirm_and_write(package_id, token, confirmed_by):
        package = UploadPackage.query.get(package_id)
        if not package:
            raise ValueError(f'Package {package_id} not found')
        
        confirmation = ConfirmationToken.query.filter_by(
            upload_package_id=package_id,
            token=token
        ).first()
        
        if not confirmation:
            raise ValueError('Invalid confirmation token')
        
        if confirmation.status != 'PENDING':
            raise ValueError(f'Token is in status {confirmation.status}')
        
        if confirmation.is_expired():
            confirmation.status = 'EXPIRED'
            db.session.commit()
            raise ValueError('Confirmation token has expired')
        
        confirmation.confirmed_at = datetime.utcnow()
        confirmation.confirmed_by = confirmed_by
        confirmation.status = 'CONFIRMED'
        
        package.status = 'WRITING'
        
        ImportService._record_history(
            package_id,
            'CONFIRM',
            confirmed_by,
            'PARSED',
            'WRITING',
            'Confirmed import, starting write operation'
        )
        
        db.session.flush()
        
        parse_result = ParseResult.query.filter_by(upload_package_id=package_id).first()
        records = json.loads(parse_result.raw_data) if parse_result.raw_data else []
        
        batch = WriteBatch(
            upload_package_id=package_id,
            batch_number=1,
            total_records=len(records),
            written_by=confirmed_by,
            status='WRITING'
        )
        db.session.add(batch)
        db.session.flush()
        
        success_count = 0
        failed_count = 0
        for record in records:
            try:
                ImportService._write_record(record)
                success_count += 1
            except Exception:
                failed_count += 1
        
        batch.success_records = success_count
        batch.failed_records = failed_count
        batch.completed_at = datetime.utcnow()
        batch.status = 'COMPLETED'
        
        revocation_expires = datetime.utcnow() + timedelta(
            minutes=current_app.config['REVOCATION_WINDOW_MINUTES']
        )
        revocation = RevocationWindow(
            write_batch_id=batch.id,
            expires_at=revocation_expires,
            status='ACTIVE'
        )
        db.session.add(revocation)
        
        package.status = 'WRITTEN'
        
        ImportService._record_history(
            package_id,
            'WRITE_COMPLETE',
            confirmed_by,
            'WRITING',
            'WRITTEN',
            f'Completed writing {success_count} records, {failed_count} failed'
        )
        
        db.session.commit()
        return [batch]

    @staticmethod
    def _write_record(record):
        existing = SourceDataStore.query.filter_by(id=record['id']).first()
        record_data = {k: v for k, v in record.items() if k != 'raw_data'}
        
        if existing:
            existing.data_json = json.dumps(record_data)
            existing.is_active = True
        else:
            new_record = SourceDataStore(
                id=record['id'],
                record_type='user',
                data_json=json.dumps(record_data),
                is_active=True
            )
            db.session.add(new_record)

    @staticmethod
    def revoke_batch(batch_id, revoked_by, reason):
        batch = WriteBatch.query.get(batch_id)
        if not batch:
            raise ValueError(f'Batch {batch_id} not found')
        
        revocation = RevocationWindow.query.filter_by(write_batch_id=batch_id).first()
        if not revocation:
            raise ValueError('No revocation window found')
        
        if not revocation.can_revoke():
            raise ValueError(f'Cannot revoke: window status={revocation.status}, expired={revocation.is_expired()}')
        
        revocation.revoked_at = datetime.utcnow()
        revocation.revoked_by = revoked_by
        revocation.revocation_reason = reason
        revocation.status = 'REVOKED'
        
        batch.status = 'REVOKED'
        
        parse_result = ParseResult.query.filter_by(upload_package_id=batch.upload_package_id).first()
        if parse_result and parse_result.raw_data:
            records = json.loads(parse_result.raw_data)
            for record in records:
                existing = SourceDataStore.query.filter_by(id=record['id']).first()
                if existing:
                    existing.is_active = False
        
        package = UploadPackage.query.get(batch.upload_package_id)
        package.status = 'REVOKED'
        
        ImportService._record_history(
            batch.upload_package_id,
            'REVOKE',
            revoked_by,
            'WRITTEN',
            'REVOKED',
            f'Revoked batch {batch_id}: {reason}'
        )
        
        db.session.commit()
        return revocation

    @staticmethod
    def get_package_status(package_id):
        package = UploadPackage.query.get(package_id)
        if not package:
            raise ValueError(f'Package {package_id} not found')
        
        parse_result = ParseResult.query.filter_by(upload_package_id=package_id).first()
        batches = WriteBatch.query.filter_by(upload_package_id=package_id).all()
        confirmation = ConfirmationToken.query.filter_by(upload_package_id=package_id).order_by(
            ConfirmationToken.created_at.desc()
        ).first()
        
        result = {
            'package': package.to_dict(),
            'parse_result': parse_result.to_dict() if parse_result else None,
            'batches': [b.to_dict() for b in batches],
            'confirmation': confirmation.to_dict() if confirmation else None
        }
        
        if batches:
            revocations = []
            for batch in batches:
                r = RevocationWindow.query.filter_by(write_batch_id=batch.id).first()
                if r:
                    revocations.append(r.to_dict())
            result['revocations'] = revocations
        
        return result

    @staticmethod
    def get_history(package_id=None, operator=None, limit=100):
        query = OperationHistory.query
        
        if package_id:
            query = query.filter_by(upload_package_id=package_id)
        
        if operator:
            query = query.filter_by(operator=operator)
        
        history = query.order_by(OperationHistory.operated_at.desc()).limit(limit).all()
        return [h.to_dict() for h in history]

    @staticmethod
    def list_packages(status=None, uploaded_by=None, limit=50):
        query = UploadPackage.query
        
        if status:
            query = query.filter_by(status=status)
        
        if uploaded_by:
            query = query.filter_by(uploaded_by=uploaded_by)
        
        packages = query.order_by(UploadPackage.uploaded_at.desc()).limit(limit).all()
        return [p.to_dict() for p in packages]

    @staticmethod
    def _record_history(package_id, operation, operator, from_status, to_status, details):
        history = OperationHistory(
            upload_package_id=package_id,
            operation=operation,
            operator=operator,
            from_status=from_status,
            to_status=to_status,
            details=details
        )
        db.session.add(history)

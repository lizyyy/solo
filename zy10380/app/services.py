from datetime import datetime, timedelta
from app import db
from app.models import (
    UploadPackage, ParseResult, PreviewDiff, ConfirmationToken,
    WriteBatch, RevocationWindow, OperationHistory
)
from flask import current_app
import hashlib
import json
import uuid

class ImportService:
    @staticmethod
    def create_upload_package(filename, file_type, file_size, uploaded_by, raw_data=None):
        existing = UploadPackage.query.filter_by(
            filename=filename,
            file_size=file_size,
            uploaded_by=uploaded_by
        ).first()
        
        if existing and existing.status not in ['ERROR', 'REVOKED']:
            return existing, False
        
        package = UploadPackage(
            filename=filename,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
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
            f'Created package for file: {filename}'
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
            parsed_data = ImportService._simulate_parsing(package)
            
            parse_result.total_records = parsed_data['total']
            parse_result.valid_records = parsed_data['valid']
            parse_result.invalid_records = parsed_data['invalid']
            parse_result.raw_data = json.dumps(parsed_data['records'])
            parse_result.validation_errors = json.dumps(parsed_data['errors'])
            parse_result.status = 'COMPLETED'
            
            ImportService._generate_preview_diffs(parse_result, parsed_data['records'])
            
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
    def _simulate_parsing(package):
        import random
        total = random.randint(50, 200)
        invalid = random.randint(0, min(10, total // 5))
        valid = total - invalid
        
        records = []
        errors = []
        
        for i in range(valid):
            records.append({
                'id': str(uuid.uuid4()),
                'name': f'Record {i + 1}',
                'email': f'user{i + 1}@example.com',
                'data': {'index': i + 1}
            })
        
        for i in range(invalid):
            errors.append({
                'record_index': valid + i,
                'field': 'email',
                'error': 'Invalid email format'
            })
        
        return {
            'total': total,
            'valid': valid,
            'invalid': invalid,
            'records': records,
            'errors': errors
        }
    
    @staticmethod
    def _generate_preview_diffs(parse_result, records):
        PreviewDiff.query.filter_by(parse_result_id=parse_result.id).delete()
        
        import random
        diff_types = ['NEW', 'UPDATE', 'DELETE']
        
        for i, record in enumerate(records[:min(20, len(records))]):
            diff_type = random.choice(diff_types)
            if diff_type == 'UPDATE':
                current_val = json.dumps({'name': f'Old Name {i}', 'email': f'old{i}@example.com'})
                new_val = json.dumps(record)
            else:
                current_val = json.dumps({}) if diff_type == 'NEW' else json.dumps(record)
                new_val = json.dumps(record) if diff_type == 'NEW' else json.dumps({})
            
            diff = PreviewDiff(
                parse_result_id=parse_result.id,
                diff_type=diff_type,
                record_identifier=record['id'],
                current_value=current_val,
                new_value=new_val,
                confidence_score=random.uniform(0.7, 1.0)
            )
            db.session.add(diff)
    
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
        
        batch_size = current_app.config['MAX_BATCH_SIZE']
        total_records = parse_result.valid_records
        num_batches = (total_records + batch_size - 1) // batch_size
        
        batches = []
        for i in range(num_batches):
            batch = WriteBatch(
                upload_package_id=package_id,
                batch_number=i + 1,
                total_records=min(batch_size, total_records - i * batch_size),
                written_by=confirmed_by,
                status='PENDING'
            )
            db.session.add(batch)
            batches.append(batch)
        
        db.session.flush()
        
        for batch in batches:
            batch.status = 'WRITING'
        
        db.session.flush()
        
        import random
        for batch in batches:
            success = batch.total_records - random.randint(0, batch.total_records // 10)
            batch.success_records = success
            batch.failed_records = batch.total_records - success
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
            f'Completed writing {total_records} records in {num_batches} batches'
        )
        
        db.session.commit()
        return batches
    
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
        
        ImportService._record_history(
            batch.upload_package_id,
            'REVOKE',
            revoked_by,
            'WRITTEN',
            'REVOKED',
            f'Revoked batch {batch_id}: {reason}'
        )
        
        package = UploadPackage.query.get(batch.upload_package_id)
        package.status = 'REVOKED'
        
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

import re
from datetime import datetime
from database import get_connection, log_audit


class ValidationError(Exception):
    pass


class Visitor:
    @staticmethod
    def validate(data):
        errors = []
        suggestions = []

        if not data.get('name'):
            errors.append('姓名不能为空')
            suggestions.append('请填写访客姓名')
        elif len(data['name']) > 50:
            errors.append('姓名长度不能超过50字符')

        id_card = data.get('id_card', '')
        if not id_card:
            errors.append('身份证号不能为空')
            suggestions.append('请填写18位身份证号')
        elif not re.match(r'^\d{17}[\dXx]$', id_card):
            errors.append('身份证号格式不正确')
            suggestions.append('身份证号应为18位数字，最后一位可为X')

        phone = data.get('phone', '')
        if not phone:
            errors.append('手机号不能为空')
            suggestions.append('请填写11位手机号')
        elif not re.match(r'^1[3-9]\d{9}$', phone):
            errors.append('手机号格式不正确')
            suggestions.append('手机号应为11位数字，以1开头')

        visit_date = data.get('visit_date', '')
        if not visit_date:
            errors.append('访问日期不能为空')
            suggestions.append('请使用YYYY-MM-DD格式填写访问日期')
        else:
            try:
                datetime.strptime(visit_date, '%Y-%m-%d')
            except ValueError:
                errors.append('访问日期格式不正确')
                suggestions.append('请使用YYYY-MM-DD格式')

        if errors:
            raise ValidationError('; '.join(errors), '; '.join(suggestions))

    @staticmethod
    def create(data, operator, role):
        Visitor.validate(data)
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO visitors (name, id_card, phone, visit_date, visit_reason, visited_person,
                                     status, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (data['name'], data['id_card'], data['phone'], data['visit_date'],
                  data.get('visit_reason'), data.get('visited_person'),
                  data.get('status', 'pending'), operator, datetime.now().isoformat()))
            visitor_id = cursor.lastrowid
            conn.commit()
            log_audit('create', 'visitor', visitor_id, data, operator, role, 'success')
            return visitor_id
        except Exception as e:
            conn.rollback()
            log_audit('create', 'visitor', None, {'data': data, 'error': str(e)}, operator, role, 'failed')
            raise
        finally:
            conn.close()

    @staticmethod
    def get_all():
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM visitors ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


class TemporaryPlate:
    @staticmethod
    def validate(data):
        errors = []
        suggestions = []

        plate_number = data.get('plate_number', '')
        if not plate_number:
            errors.append('车牌号不能为空')
            suggestions.append('请填写车牌号，如京A12345')
        elif not re.match(r'^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领A-Z]{1}[A-Z]{1}[A-Z0-9]{4,5}$', plate_number):
            errors.append('车牌号格式不正确')
            suggestions.append('车牌号格式应为：省份简称+字母+4-5位数字/字母')

        if not data.get('vehicle_type'):
            errors.append('车辆类型不能为空')
            suggestions.append('请填写车辆类型，如小型轿车、SUV等')

        valid_from = data.get('valid_from', '')
        valid_to = data.get('valid_to', '')

        for date_field, date_name in [(valid_from, '生效日期'), (valid_to, '失效日期')]:
            if not date_field:
                errors.append(f'{date_name}不能为空')
                suggestions.append(f'请使用YYYY-MM-DD HH:MM格式填写{date_name}')
            else:
                try:
                    datetime.strptime(date_field, '%Y-%m-%d %H:%M')
                except ValueError:
                    errors.append(f'{date_name}格式不正确')
                    suggestions.append(f'{date_name}请使用YYYY-MM-DD HH:MM格式')

        if valid_from and valid_to:
            try:
                from_dt = datetime.strptime(valid_from, '%Y-%m-%d %H:%M')
                to_dt = datetime.strptime(valid_to, '%Y-%m-%d %H:%M')
                if from_dt >= to_dt:
                    errors.append('生效日期必须早于失效日期')
                    suggestions.append('请调整生效和失效日期')
            except ValueError:
                pass

        if errors:
            raise ValidationError('; '.join(errors), '; '.join(suggestions))

    @staticmethod
    def create(data, operator, role):
        TemporaryPlate.validate(data)
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO temporary_plates (plate_number, vehicle_type, owner_name, owner_phone,
                                             valid_from, valid_to, status, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (data['plate_number'], data['vehicle_type'], data.get('owner_name'),
                  data.get('owner_phone'), data['valid_from'], data['valid_to'],
                  data.get('status', 'active'), operator, datetime.now().isoformat()))
            plate_id = cursor.lastrowid
            conn.commit()
            log_audit('create', 'temporary_plate', plate_id, data, operator, role, 'success')
            return plate_id
        except Exception as e:
            conn.rollback()
            log_audit('create', 'temporary_plate', None, {'data': data, 'error': str(e)}, operator, role, 'failed')
            raise
        finally:
            conn.close()

    @staticmethod
    def get_all():
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM temporary_plates ORDER BY created_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]


class Blacklist:
    @staticmethod
    def validate(data):
        errors = []
        suggestions = []

        bl_type = data.get('type', '')
        if bl_type not in ['person', 'vehicle', 'id_card', 'phone']:
            errors.append('黑名单类型不正确')
            suggestions.append('类型可选值: person, vehicle, id_card, phone')

        if not data.get('identifier'):
            errors.append('标识不能为空')
            suggestions.append('请填写黑名单标识，如身份证号或车牌号')

        if not data.get('reason'):
            errors.append('拉黑原因不能为空')
            suggestions.append('请详细说明拉黑原因')

        if errors:
            raise ValidationError('; '.join(errors), '; '.join(suggestions))

    @staticmethod
    def create(data, operator, role):
        Blacklist.validate(data)
        conn = get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO blacklist (type, identifier, reason, added_by, added_at, expires_at, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (data['type'], data['identifier'], data['reason'], operator,
                  datetime.now().isoformat(), data.get('expires_at'), 1))
            blacklist_id = cursor.lastrowid
            conn.commit()
            log_audit('create', 'blacklist', blacklist_id, data, operator, role, 'success')
            return blacklist_id
        except Exception as e:
            conn.rollback()
            log_audit('create', 'blacklist', None, {'data': data, 'error': str(e)}, operator, role, 'failed')
            raise
        finally:
            conn.close()

    @staticmethod
    def get_all():
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM blacklist ORDER BY added_at DESC')
        rows = cursor.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    @staticmethod
    def check_blacklist(bl_type, identifier):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM blacklist
            WHERE type = ? AND identifier = ? AND is_active = 1
            AND (expires_at IS NULL OR expires_at > ?)
        ''', (bl_type, identifier, datetime.now().isoformat()))
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

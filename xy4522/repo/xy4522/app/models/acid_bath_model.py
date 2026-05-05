from app.database.connection import get_db_connection


class AcidBathModel:
    @staticmethod
    def create(bath_number, concentration=None, temperature=None, ventilation_status=None, record_time=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO acid_bath_records (bath_number, concentration, temperature, ventilation_status, record_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (bath_number, concentration, temperature, ventilation_status, record_time))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_bath_number(bath_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM acid_bath_records 
            WHERE bath_number = ? 
            ORDER BY record_time DESC 
            LIMIT 1
        ''', (bath_number,))
        return cursor.fetchone()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM acid_bath_records ORDER BY record_time DESC')
        return cursor.fetchall()

    @staticmethod
    def get_latest_by_bath():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT ar.* FROM acid_bath_records ar
            INNER JOIN (
                SELECT bath_number, MAX(record_time) as max_time
                FROM acid_bath_records
                GROUP BY bath_number
            ) latest ON ar.bath_number = latest.bath_number AND ar.record_time = latest.max_time
        ''')
        return cursor.fetchall()

    @staticmethod
    def bulk_insert(records):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            for record in records:
                cursor.execute('''
                    INSERT INTO acid_bath_records 
                    (bath_number, concentration, temperature, ventilation_status, record_time)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    record.get('bath_number'),
                    record.get('concentration'),
                    record.get('temperature'),
                    record.get('ventilation_status'),
                    record.get('record_time')
                ))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e

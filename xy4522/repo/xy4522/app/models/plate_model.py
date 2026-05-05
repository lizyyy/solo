from app.database.connection import get_db_connection


class PlateModel:
    @staticmethod
    def create(plate_number, student_name=None, plate_type=None, plate_size=None, estimated_etching_time=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO plate_inventory (plate_number, student_name, plate_type, plate_size, estimated_etching_time)
                VALUES (?, ?, ?, ?, ?)
            ''', (plate_number, student_name, plate_type, plate_size, estimated_etching_time))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM plate_inventory WHERE plate_number = ?', (plate_number,))
        return cursor.fetchone()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM plate_inventory ORDER BY plate_number')
        return cursor.fetchall()

    @staticmethod
    def update(plate_id, **kwargs):
        conn = get_db_connection()
        cursor = conn.cursor()
        allowed_fields = ['student_name', 'plate_type', 'plate_size', 'estimated_etching_time']
        updates = []
        values = []
        for key, value in kwargs.items():
            if key in allowed_fields:
                updates.append(f'{key} = ?')
                values.append(value)
        if not updates:
            return False
        values.append(plate_id)
        query = f'UPDATE plate_inventory SET {", ".join(updates)} WHERE id = ?'
        cursor.execute(query, values)
        conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    def delete(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM plate_inventory WHERE plate_number = ?', (plate_number,))
        conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    def bulk_insert(plates):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            for plate in plates:
                cursor.execute('''
                    INSERT OR REPLACE INTO plate_inventory 
                    (plate_number, student_name, plate_type, plate_size, estimated_etching_time)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    plate.get('plate_number'),
                    plate.get('student_name'),
                    plate.get('plate_type'),
                    plate.get('plate_size'),
                    plate.get('estimated_etching_time')
                ))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e

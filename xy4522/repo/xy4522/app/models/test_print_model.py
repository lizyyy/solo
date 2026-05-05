from app.database.connection import get_db_connection


class TestPrintModel:
    @staticmethod
    def create(plate_number, photo_path, notes=None, print_order=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO test_print_photos (plate_number, photo_path, notes, print_order)
                VALUES (?, ?, ?, ?)
            ''', (plate_number, photo_path, notes, print_order))
            conn.commit()
            return cursor.lastrowid
        except Exception as e:
            conn.rollback()
            raise e

    @staticmethod
    def get_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM test_print_photos 
            WHERE plate_number = ? 
            ORDER BY print_order
        ''', (plate_number,))
        return cursor.fetchall()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM test_print_photos 
            ORDER BY plate_number, print_order
        ''')
        return cursor.fetchall()

    @staticmethod
    def delete_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM test_print_photos WHERE plate_number = ?', (plate_number,))
        conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    def bulk_insert(photos):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            plate_numbers = set(p.get('plate_number') for p in photos)
            for plate_number in plate_numbers:
                cursor.execute('DELETE FROM test_print_photos WHERE plate_number = ?', (plate_number,))
            
            for photo in photos:
                cursor.execute('''
                    INSERT INTO test_print_photos 
                    (plate_number, photo_path, notes, print_order)
                    VALUES (?, ?, ?, ?)
                ''', (
                    photo.get('plate_number'),
                    photo.get('photo_path'),
                    photo.get('notes'),
                    photo.get('print_order')
                ))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e

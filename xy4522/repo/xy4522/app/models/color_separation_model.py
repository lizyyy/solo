from app.database.connection import get_db_connection


class ColorSeparationModel:
    @staticmethod
    def create(plate_number, color_name=None, color_order=None, etching_depth=None, notes=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO color_separation (plate_number, color_name, color_order, etching_depth, notes)
                VALUES (?, ?, ?, ?, ?)
            ''', (plate_number, color_name, color_order, etching_depth, notes))
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
            SELECT * FROM color_separation 
            WHERE plate_number = ? 
            ORDER BY color_order
        ''', (plate_number,))
        return cursor.fetchall()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM color_separation 
            ORDER BY plate_number, color_order
        ''')
        return cursor.fetchall()

    @staticmethod
    def delete_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM color_separation WHERE plate_number = ?', (plate_number,))
        conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    def bulk_insert(separations):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            plate_numbers = set(s.get('plate_number') for s in separations)
            for plate_number in plate_numbers:
                cursor.execute('DELETE FROM color_separation WHERE plate_number = ?', (plate_number,))
            
            for separation in separations:
                cursor.execute('''
                    INSERT INTO color_separation 
                    (plate_number, color_name, color_order, etching_depth, notes)
                    VALUES (?, ?, ?, ?, ?)
                ''', (
                    separation.get('plate_number'),
                    separation.get('color_name'),
                    separation.get('color_order'),
                    separation.get('etching_depth'),
                    separation.get('notes')
                ))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e

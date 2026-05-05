from app.database.connection import get_db_connection


class AppointmentModel:
    @staticmethod
    def create(plate_number, student_name=None, appointment_date=None, 
               start_time=None, end_time=None, bath_number=None, notes=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO student_appointments 
                (plate_number, student_name, appointment_date, start_time, end_time, bath_number, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (plate_number, student_name, appointment_date, start_time, end_time, bath_number, notes))
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
            SELECT * FROM student_appointments 
            WHERE plate_number = ? 
            ORDER BY appointment_date, start_time
        ''', (plate_number,))
        return cursor.fetchall()

    @staticmethod
    def get_all():
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM student_appointments 
            ORDER BY appointment_date, start_time
        ''')
        return cursor.fetchall()

    @staticmethod
    def get_by_date_and_bath(appointment_date, bath_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM student_appointments 
            WHERE appointment_date = ? AND bath_number = ?
            ORDER BY start_time
        ''', (appointment_date, bath_number))
        return cursor.fetchall()

    @staticmethod
    def delete_by_plate_number(plate_number):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM student_appointments WHERE plate_number = ?', (plate_number,))
        conn.commit()
        return cursor.rowcount > 0

    @staticmethod
    def bulk_insert(appointments):
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            plate_numbers = set(a.get('plate_number') for a in appointments)
            for plate_number in plate_numbers:
                cursor.execute('DELETE FROM student_appointments WHERE plate_number = ?', (plate_number,))
            
            for appointment in appointments:
                cursor.execute('''
                    INSERT INTO student_appointments 
                    (plate_number, student_name, appointment_date, start_time, end_time, bath_number, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    appointment.get('plate_number'),
                    appointment.get('student_name'),
                    appointment.get('appointment_date'),
                    appointment.get('start_time'),
                    appointment.get('end_time'),
                    appointment.get('bath_number'),
                    appointment.get('notes')
                ))
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e

from datetime import datetime, timedelta
from models import Rental, Equipment, Student, DamageRecord, Reminder, Anomaly
from app import db
import hashlib

class RentalService:
    @staticmethod
    def calculate_rental_fee(rental):
        if not rental.rent_date:
            return 0
        
        end_date = rental.return_date or datetime.now()
        days = (end_date - rental.rent_date).days
        if days <= 0:
            days = 1
        
        daily_rate = rental.equipment.daily_rate if rental.equipment else 0
        return days * daily_rate

    @staticmethod
    def calculate_deposit_balance(rental):
        total_due = rental.rental_fee + rental.damage_fee
        return rental.deposit_paid - rental.deposit_refunded - total_due

    @staticmethod
    def update_rental_status(rental):
        now = datetime.now()
        
        if rental.return_date:
            rental.status = 'completed'
            if rental.equipment:
                rental.equipment.status = 'available'
        elif rental.due_date and now > rental.due_date:
            rental.status = 'overdue'
        else:
            rental.status = 'active'
        
        db.session.commit()
        return rental.status

    @staticmethod
    def process_return(rental_id, return_date=None, damage_notes=None, 
                      damage_severity=None, damage_cost=0, operator=None):
        rental = Rental.query.get(rental_id)
        if not rental:
            return {'success': False, 'error': '租赁记录不存在'}
        
        rental.return_date = return_date or datetime.now()
        
        rental.rental_fee = RentalService.calculate_rental_fee(rental)
        
        if damage_notes:
            damage_record = DamageRecord(
                rental_id=rental.id,
                equipment_id=rental.equipment_id,
                description=damage_notes,
                severity=damage_severity or 'minor',
                repair_cost=damage_cost,
                fee_charged=damage_cost,
                reported_by=operator,
                resolved=False
            )
            db.session.add(damage_record)
            rental.damage_fee += damage_cost
        
        deposit_balance = RentalService.calculate_deposit_balance(rental)
        if deposit_balance > 0:
            rental.deposit_refunded += deposit_balance
        
        RentalService.update_rental_status(rental)
        db.session.commit()
        
        return {
            'success': True,
            'rental': rental,
            'deposit_balance': deposit_balance,
            'rental_fee': rental.rental_fee,
            'damage_fee': rental.damage_fee
        }

    @staticmethod
    def get_overdue_rentals(days_overdue=0):
        now = datetime.now()
        query = Rental.query.filter(
            Rental.return_date == None,
            Rental.due_date < now
        )
        
        if days_overdue > 0:
            cutoff_date = now - timedelta(days=days_overdue)
            query = query.filter(Rental.due_date < cutoff_date)
        
        rentals = query.all()
        for r in rentals:
            r.overdue_days = (now - r.due_date).days
        
        return rentals

    @staticmethod
    def get_rentals_nearing_due(days=3):
        now = datetime.now()
        cutoff = now + timedelta(days=days)
        return Rental.query.filter(
            Rental.return_date == None,
            Rental.due_date >= now,
            Rental.due_date <= cutoff
        ).all()

    @staticmethod
    def confirm_rental(rental_id, confirmed_by):
        rental = Rental.query.get(rental_id)
        if not rental:
            return {'success': False, 'error': '租赁记录不存在'}
        
        rental.confirmed_by = confirmed_by
        rental.confirmed_at = datetime.now()
        db.session.commit()
        
        return {'success': True, 'rental': rental}

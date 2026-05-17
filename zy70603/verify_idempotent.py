#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import Reader, BookCopy, ReaderType, CopyStatus
from reservation_engine import ReservationEngine

engine = ReservationEngine()
engine.add_reader(Reader('R1', 'Test', ReaderType.TEACHER, 'CS', 0))
engine.add_copy(BookCopy('C1', 'ISBN1', 'Book1', CopyStatus.AVAILABLE, 'A1'))

r1 = engine.create_reservation('R1', 'C1')
r2 = engine.create_reservation('R1', 'C1')
queue = engine.get_copy_queue('C1')

print(f"queue_length={len(queue)}, same_id={r1.reservation_id == r2.reservation_id}")

if len(queue) == 1 and r1.reservation_id == r2.reservation_id:
    print("SUCCESS: 重复预约幂等性验证通过")
    sys.exit(0)
else:
    print("FAIL: 重复预约幂等性验证失败")
    sys.exit(1)

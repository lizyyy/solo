import sys

code = '''

class InstrumentPackage(Base):
    __tablename__ = "instrument_packages"
    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, unique=True)
    sterilization_cycle = Column(String, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
'''

with open('app.py', 'a', encoding='utf-8') as f:
    f.write(code)

print('Step 2 done')

from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./bus_refund_fee.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class RefundFee(Base):
    __tablename__ = "refund_fees"
    
    id = Column(Integer, primary_key=True, index=True)
    退票单号 = Column(String(50), unique=True, index=True)
    原购票单号 = Column(String(50), index=True)
    乘车日期 = Column(DateTime, index=True)
    退票日期 = Column(DateTime, index=True)
    班次号 = Column(String(30), index=True)
    起点站 = Column(String(50), index=True)
    终点站 = Column(String(50), index=True)
    乘客姓名 = Column(String(50))
    身份证号 = Column(String(50))
    联系电话 = Column(String(30))
    原票价 = Column(Float)
    退票手续费比例 = Column(Float)
    退票手续费金额 = Column(Float)
    实退金额 = Column(Float)
    退票原因 = Column(String(200))
    退票类型 = Column(String(30), index=True)
    班次状态 = Column(String(30), index=True)
    门店名称 = Column(String(100), index=True)
    门店编号 = Column(String(50), index=True)
    负责人姓名 = Column(String(50), index=True)
    审核人 = Column(String(50))
    审核时间 = Column(DateTime)
    当前状态 = Column(String(30), index=True)
    备注 = Column(Text)
    是否旧记录修正 = Column(Boolean, default=False)
    修正原因 = Column(String(200))
    创建时间 = Column(DateTime, default=datetime.now)
    更新时间 = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class RefundFeeHistory(Base):
    __tablename__ = "refund_fee_histories"
    
    id = Column(Integer, primary_key=True, index=True)
    退票单号 = Column(String(50), index=True)
    操作类型 = Column(String(30), index=True)
    操作人 = Column(String(50))
    操作时间 = Column(DateTime, default=datetime.now)
    变更前数据 = Column(Text)
    变更后数据 = Column(Text)
    变更字段 = Column(String(200))
    IP地址 = Column(String(50))
    备注 = Column(Text)


Base.metadata.create_all(bind=engine)

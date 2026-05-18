from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class 班级(db.Model):
    __tablename__ = '班级'
    班级编号 = db.Column(db.String(20), primary_key=True)
    班级名称 = db.Column(db.String(50), nullable=False)
    授课教师 = db.Column(db.String(20))
    创建时间 = db.Column(db.DateTime, default=datetime.now)
    学生列表 = db.relationship('学生', backref='所属班级', lazy=True)


class 学生(db.Model):
    __tablename__ = '学生'
    学号 = db.Column(db.String(20), primary_key=True)
    姓名 = db.Column(db.String(20), nullable=False)
    班级编号 = db.Column(db.String(20), db.ForeignKey('班级.班级编号'), nullable=False)
    年级 = db.Column(db.String(10))
    注册时间 = db.Column(db.DateTime, default=datetime.now)
    分发记录 = db.relationship('画材包分发记录', backref='领取学生', lazy=True)


class 画材包类型(db.Model):
    __tablename__ = '画材包类型'
    包类型编号 = db.Column(db.String(20), primary_key=True)
    包类型名称 = db.Column(db.String(50), nullable=False)
    适用课程 = db.Column(db.String(100))
    包含物品清单 = db.Column(db.Text)
    标准单价 = db.Column(db.Numeric(10, 2))
    创建时间 = db.Column(db.DateTime, default=datetime.now)


class 画材库存(db.Model):
    __tablename__ = '画材库存'
    库存编号 = db.Column(db.Integer, primary_key=True, autoincrement=True)
    包类型编号 = db.Column(db.String(20), db.ForeignKey('画材包类型.包类型编号'), nullable=False)
    仓库位置 = db.Column(db.String(50))
    当前库存量 = db.Column(db.Integer, nullable=False, default=0)
    安全库存线 = db.Column(db.Integer, default=10)
    最后更新时间 = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    包类型 = db.relationship('画材包类型', backref='库存记录')


class 画材包分发记录(db.Model):
    __tablename__ = '画材包分发记录'
    分发记录编号 = db.Column(db.String(30), primary_key=True)
    学号 = db.Column(db.String(20), db.ForeignKey('学生.学号'), nullable=False)
    包类型编号 = db.Column(db.String(20), db.ForeignKey('画材包类型.包类型编号'), nullable=False)
    分发时间 = db.Column(db.DateTime, default=datetime.now)
    分发人 = db.Column(db.String(20))
    领取状态 = db.Column(db.String(10), nullable=False, default='待领取')
    领取确认时间 = db.Column(db.DateTime)
    补领标记 = db.Column(db.Boolean, default=False)
    原分发记录编号 = db.Column(db.String(30))
    备注 = db.Column(db.Text)
    创建时间 = db.Column(db.DateTime, default=datetime.now)
    最后更新时间 = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)
    包类型 = db.relationship('画材包类型', backref='分发记录')


class 分发异常日志(db.Model):
    __tablename__ = '分发异常日志'
    异常编号 = db.Column(db.Integer, primary_key=True, autoincrement=True)
    异常类型 = db.Column(db.String(50), nullable=False)
    异常描述 = db.Column(db.Text, nullable=False)
    涉及学号 = db.Column(db.String(20))
    涉及分发记录编号 = db.Column(db.String(30))
    涉及包类型编号 = db.Column(db.String(20))
    原班级编号 = db.Column(db.String(20))
    新班级编号 = db.Column(db.String(20))
    处理状态 = db.Column(db.String(20), default='待处理')
    异常发生时间 = db.Column(db.DateTime, default=datetime.now)
    处理人 = db.Column(db.String(20))
    处理时间 = db.Column(db.DateTime)
    处理备注 = db.Column(db.Text)

from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base


class RuleType(str, enum.Enum):
    LESION_DETECTION = "病斑检测"
    VERIFICATION = "核验规则"
    ROLLBACK = "回滚规则"
    REPORT = "报告规则"


class RuleStatus(str, enum.Enum):
    DRAFT = "草稿"
    ACTIVE = "启用"
    DISABLED = "停用"
    DEPRECATED = "弃用"


class RuleDefinition(Base):
    __tablename__ = "rule_definitions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    rule_code = Column(String(50), unique=True, nullable=False, index=True, comment="规则编号")
    rule_name = Column(String(200), nullable=False, comment="规则名称")
    
    rule_type = Column(Enum(RuleType), nullable=False, comment="规则类型")
    rule_description = Column(Text, nullable=False, comment="规则描述")
    
    rule_condition = Column(JSON, nullable=False, comment="规则条件(JSON格式)")
    rule_action = Column(JSON, comment="规则动作(JSON格式)")
    
    priority = Column(Integer, default=0, comment="优先级(数字越大优先级越高)")
    version = Column(Integer, default=1, comment="版本号")
    
    is_auto_apply = Column(Boolean, default=True, comment="是否自动应用")
    
    status = Column(Enum(RuleStatus), default=RuleStatus.DRAFT, comment="规则状态")
    
    created_by = Column(String(100), nullable=False, comment="创建人")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_by = Column(String(100), comment="更新人")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    remark = Column(Text, comment="备注")
    
    execution_logs = relationship("RuleExecutionLog", back_populates="rule")
    
    def __repr__(self):
        return f"<RuleDefinition {self.rule_code} - {self.rule_name}>"


class RuleExecutionLog(Base):
    __tablename__ = "rule_execution_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    log_code = Column(String(50), unique=True, nullable=False, index=True, comment="日志编号")
    
    rule_id = Column(Integer, ForeignKey("rule_definitions.id"), nullable=False, comment="规则ID")
    rule = relationship("RuleDefinition", back_populates="execution_logs")
    
    rule_code = Column(String(50), index=True, comment="规则编号（冗余字段）")
    rule_name = Column(String(200), comment="规则名称（冗余字段）")
    
    target_type = Column(String(50), nullable=False, comment="目标类型(lesion/verification等)")
    target_id = Column(Integer, nullable=False, comment="目标ID")
    target_code = Column(String(50), index=True, comment="目标编号")
    
    input_data = Column(JSON, comment="输入数据快照")
    execution_result = Column(JSON, comment="执行结果")
    match_reason = Column(Text, comment="匹配原因")
    is_matched = Column(Boolean, default=False, comment="是否匹配")
    
    executed_by = Column(String(100), comment="执行人")
    executed_at = Column(DateTime, default=datetime.now, comment="执行时间")
    
    remark = Column(Text, comment="备注")
    
    def __repr__(self):
        return f"<RuleExecutionLog {self.log_code} - {self.rule_code}>"

package com.bus.notify.service;

import com.bus.notify.entity.AuditLog;
import com.bus.notify.entity.Operator;
import com.bus.notify.entity.RouteChange;
import com.bus.notify.enums.RouteChangeStatus;
import com.bus.notify.repository.AuditLogRepository;
import com.bus.notify.repository.OperatorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AuditService {
    private final AuditLogRepository auditLogRepository;
    private final OperatorRepository operatorRepository;
    
    public AuditService(AuditLogRepository auditLogRepository, OperatorRepository operatorRepository) {
        this.auditLogRepository = auditLogRepository;
        this.operatorRepository = operatorRepository;
    }
    
    @Transactional
    public AuditLog createAuditLog(RouteChange routeChange, String action, String actionReason,
                                   RouteChangeStatus oldStatus, RouteChangeStatus newStatus,
                                   String oldConclusion, String newConclusion, String operatorUsername, String remark) {
        AuditLog auditLog = new AuditLog();
        auditLog.setRouteChange(routeChange);
        auditLog.setAction(action);
        auditLog.setActionReason(actionReason);
        auditLog.setOldStatus(oldStatus);
        auditLog.setNewStatus(newStatus);
        auditLog.setOldConclusion(oldConclusion);
        auditLog.setNewConclusion(newConclusion);
        auditLog.setRemark(remark);
        
        if (operatorUsername != null) {
            operatorRepository.findByUsername(operatorUsername).ifPresent(auditLog::setOperator);
        }
        
        return auditLogRepository.save(auditLog);
    }
    
    @Transactional
    public AuditLog logStatusChange(RouteChange routeChange, String action, String reason,
                                    RouteChangeStatus oldStatus, RouteChangeStatus newStatus, String operatorUsername) {
        return createAuditLog(routeChange, action, reason, oldStatus, newStatus, null, null, operatorUsername, null);
    }
    
    @Transactional
    public AuditLog logCorrection(RouteChange routeChange, String action, String reason,
                                  String oldConclusion, String newConclusion, String operatorUsername, String remark) {
        return createAuditLog(routeChange, action, reason, routeChange.getStatus(), routeChange.getStatus(),
                oldConclusion, newConclusion, operatorUsername, remark);
    }
    
    public List<AuditLog> getAuditLogsByRouteChange(Long routeChangeId) {
        return auditLogRepository.findByRouteChangeIdOrderByCreatedAtDesc(routeChangeId);
    }
}

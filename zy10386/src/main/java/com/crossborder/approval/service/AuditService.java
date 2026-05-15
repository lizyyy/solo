package com.crossborder.approval.service;

import com.crossborder.approval.model.entity.AccessToken;
import com.crossborder.approval.model.entity.AuditLog;
import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Transactional
    public void logAction(DataAccessApplication application, String action, 
                          String operatorId, String operatorName, String details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setApplication(application);
        auditLog.setAction(action);
        auditLog.setOperatorId(operatorId);
        auditLog.setOperatorName(operatorName);
        auditLog.setDetails(details);
        
        auditLogRepository.save(auditLog);
        log.info("审计日志: 申请编号={}, 操作={}, 操作人={}", 
                application.getApplicationNo(), action, operatorName);
    }

    @Transactional
    public void logTokenAction(AccessToken token, String action, 
                               String operatorId, String operatorName, String details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setApplication(token.getApplication());
        auditLog.setAccessToken(token);
        auditLog.setAction(action);
        auditLog.setOperatorId(operatorId);
        auditLog.setOperatorName(operatorName);
        auditLog.setDetails(details);
        
        auditLogRepository.save(auditLog);
        log.info("令牌审计日志: 令牌={}, 操作={}, 操作人={}", 
                token.getToken().substring(0, 10) + "...", action, operatorName);
    }
}

package com.manufacture.outsourcing.service;

import com.manufacture.outsourcing.entity.OperationLog;
import com.manufacture.outsourcing.repository.OperationLogRepository;
import com.manufacture.outsourcing.util.SecurityUtil;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
public class OperationLogService {

    private final OperationLogRepository operationLogRepository;
    private final ObjectMapper objectMapper;

    public OperationLogService(OperationLogRepository operationLogRepository, ObjectMapper objectMapper) {
        this.operationLogRepository = operationLogRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public OperationLog logSuccess(String entityType, Long entityId, String entityNo, String action, 
                                    String fromStatus, String toStatus, String summary, Object beforeData, Object afterData) {
        return log(entityType, entityId, entityNo, action, fromStatus, toStatus, summary, beforeData, afterData, true, null);
    }

    @Transactional
    public OperationLog logFailure(String entityType, Long entityId, String entityNo, String action, 
                                    String fromStatus, String toStatus, String summary, Object beforeData, Object afterData, 
                                    String errorMessage) {
        return log(entityType, entityId, entityNo, action, fromStatus, toStatus, summary, beforeData, afterData, false, errorMessage);
    }

    private OperationLog log(String entityType, Long entityId, String entityNo, String action,
                             String fromStatus, String toStatus, String summary, Object beforeData, Object afterData,
                             boolean success, String errorMessage) {
        OperationLog operationLog = new OperationLog();
        operationLog.setEntityType(entityType);
        operationLog.setEntityId(entityId);
        operationLog.setEntityNo(entityNo);
        operationLog.setOperator(SecurityUtil.getCurrentRealName());
        operationLog.setAction(action);
        operationLog.setFromStatus(fromStatus);
        operationLog.setToStatus(toStatus);
        operationLog.setSummary(summary);
        operationLog.setSuccess(success);
        operationLog.setErrorMessage(errorMessage);

        if (beforeData != null) {
            try {
                operationLog.setBeforeData(objectMapper.writeValueAsString(beforeData));
            } catch (JsonProcessingException e) {
                log.warn("序列化beforeData失败", e);
            }
        }

        if (afterData != null) {
            try {
                operationLog.setAfterData(objectMapper.writeValueAsString(afterData));
            } catch (JsonProcessingException e) {
                log.warn("序列化afterData失败", e);
            }
        }

        return operationLogRepository.save(operationLog);
    }

    public List<OperationLog> findByEntity(String entityType, Long entityId) {
        return operationLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId);
    }

    public List<OperationLog> findByEntityNo(String entityNo) {
        return operationLogRepository.findByEntityNoOrderByCreatedAtDesc(entityNo);
    }

    public List<OperationLog> findByOperator(String operator) {
        return operationLogRepository.findByOperatorOrderByCreatedAtDesc(operator);
    }
}

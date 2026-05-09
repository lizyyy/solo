package com.mold.service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mold.service.domain.entity.OperationHistory;
import com.mold.service.domain.repository.OperationHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class OperationHistoryService {
    
    private final OperationHistoryRepository historyRepository;
    private final ObjectMapper objectMapper;
    
    @Transactional
    public <T> void recordHistory(String entityType, Long entityId, String entityCode,
                                   OperationHistory.OperationType operationType,
                                   T beforeValue, T afterValue, String remark,
                                   String operator, String operatorRole) {
        OperationHistory history = new OperationHistory();
        history.setEntityType(entityType);
        history.setEntityId(entityId);
        history.setEntityCode(entityCode);
        history.setOperationType(operationType);
        history.setOperationRemark(remark);
        history.setOperator(operator);
        history.setOperatorRole(operatorRole);
        
        try {
            if (beforeValue != null) {
                history.setBeforeValue(objectMapper.writeValueAsString(beforeValue));
            }
            if (afterValue != null) {
                history.setAfterValue(objectMapper.writeValueAsString(afterValue));
            }
        } catch (JsonProcessingException e) {
            log.warn("序列化历史记录值失败", e);
        }
        
        historyRepository.save(history);
    }
    
    @Transactional
    public void recordSimpleHistory(String entityType, Long entityId, String entityCode,
                                    OperationHistory.OperationType operationType,
                                    String diffDetail, String remark,
                                    String operator, String operatorRole) {
        OperationHistory history = new OperationHistory();
        history.setEntityType(entityType);
        history.setEntityId(entityId);
        history.setEntityCode(entityCode);
        history.setOperationType(operationType);
        history.setDiffDetail(diffDetail);
        history.setOperationRemark(remark);
        history.setOperator(operator);
        history.setOperatorRole(operatorRole);
        
        historyRepository.save(history);
    }
}

package com.account.freeze.service;

import com.account.freeze.entity.OperationLog;
import com.account.freeze.mapper.OperationLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class OperationLogService {

    private final OperationLogMapper operationLogMapper;

    @Transactional(rollbackFor = Exception.class)
    public void logOperation(Long batchId, Long batchItemId, 
                             String operationType, String operationDesc, String operator) {
        OperationLog logEntry = new OperationLog();
        logEntry.setLogNo("LOG" + System.currentTimeMillis());
        logEntry.setBatchId(batchId);
        logEntry.setBatchItemId(batchItemId);
        logEntry.setOperationType(operationType);
        logEntry.setOperationDesc(operationDesc);
        logEntry.setOperator(operator);
        logEntry.setCreatedTime(LocalDateTime.now());
        
        operationLogMapper.insert(logEntry);
        
        log.info("记录操作日志: {}", operationDesc);
    }
}

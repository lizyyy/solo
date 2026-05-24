package com.hotel.lostfound.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hotel.lostfound.entity.IdempotentRecord;
import com.hotel.lostfound.exception.DuplicateRequestException;
import com.hotel.lostfound.repository.IdempotentRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotentService {

    private final IdempotentRecordRepository idempotentRecordRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public void checkDuplicate(String requestId, String operationType) {
        Optional<IdempotentRecord> existing = idempotentRecordRepository.findByRequestId(requestId);
        if (existing.isPresent()) {
            IdempotentRecord record = existing.get();
            if (operationType.equals(record.getOperationType())) {
                Object data = null;
                if (record.getResponseData() != null) {
                    try {
                        data = objectMapper.readValue(record.getResponseData(), Object.class);
                    } catch (Exception e) {
                        log.warn("解析幂等记录响应数据失败", e);
                    }
                }
                throw new DuplicateRequestException(requestId, data);
            }
        }
    }

    @Transactional
    public void recordResult(String requestId, String operationType, Object responseData, boolean success) {
        IdempotentRecord record = new IdempotentRecord();
        record.setRequestId(requestId);
        record.setOperationType(operationType);
        record.setSuccess(success);
        if (responseData != null) {
            try {
                record.setResponseData(objectMapper.writeValueAsString(responseData));
            } catch (Exception e) {
                log.warn("序列化幂等记录响应数据失败", e);
            }
        }
        idempotentRecordRepository.save(record);
    }

    @Transactional(readOnly = true)
    public boolean exists(String requestId) {
        return idempotentRecordRepository.existsByRequestId(requestId);
    }
}

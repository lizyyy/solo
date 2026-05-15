package com.privacy.replay.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.privacy.replay.dto.ApiResponse;
import com.privacy.replay.exception.BusinessException;
import com.privacy.replay.exception.ErrorCode;
import com.privacy.replay.model.IdempotentRecord;
import com.privacy.replay.repository.IdempotentRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotentService {

    private final IdempotentRecordRepository idempotentRecordRepository;
    private final ObjectMapper objectMapper;

    public Optional<IdempotentRecord> checkDuplicate(String requestKey) {
        return idempotentRecordRepository.findByRequestKey(requestKey);
    }

    @Transactional(rollbackFor = Exception.class)
    public void saveRecord(String requestKey, String requestType, String requestBody,
                            ApiResponse<?> response, int responseStatus) {
        IdempotentRecord record = new IdempotentRecord();
        record.setRequestKey(requestKey);
        record.setRequestType(requestType);
        record.setRequestBody(requestBody);
        try {
            record.setResponseBody(objectMapper.writeValueAsString(response));
        } catch (Exception e) {
            log.error("Serialize response error", e);
        }
        record.setResponseStatus(responseStatus);
        record.setExpiredAt(LocalDateTime.now().plusHours(24));
        idempotentRecordRepository.save(record);
    }

    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional(rollbackFor = Exception.class)
    public void cleanExpiredRecords() {
        LocalDateTime now = LocalDateTime.now();
        idempotentRecordRepository.deleteByExpiredAtBefore(now);
        log.info("Cleaned expired idempotent records");
    }
}

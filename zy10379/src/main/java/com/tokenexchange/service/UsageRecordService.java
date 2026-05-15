package com.tokenexchange.service;

import com.tokenexchange.entity.UsageRecord;
import com.tokenexchange.repository.UsageRecordRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class UsageRecordService {
    private final UsageRecordRepository usageRecordRepository;
    private final ObjectMapper objectMapper;

    public void recordUsage(String tokenValue, String tokenType, String userId, String serviceId,
                            String operation, String requestId, Object requestDetails,
                            String clientIp, String userAgent, boolean success, String errorMessage) {
        UsageRecord record = new UsageRecord();
        record.setTokenValue(tokenValue);
        record.setTokenType(tokenType);
        record.setUserId(userId);
        record.setServiceId(serviceId);
        record.setOperation(operation);
        record.setRequestId(requestId);
        record.setClientIp(clientIp);
        record.setUserAgent(userAgent);
        record.setSuccess(success);
        record.setErrorMessage(errorMessage);

        if (requestDetails != null) {
            try {
                record.setRequestDetails(objectMapper.writeValueAsString(requestDetails));
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize request details", e);
                record.setRequestDetails(requestDetails.toString());
            }
        }

        usageRecordRepository.save(record);
        log.info("Usage recorded: {} - {} - {} - {}", tokenType, operation, userId, success);
    }

    public List<UsageRecord> getTokenUsageHistory(String tokenValue) {
        return usageRecordRepository.findByTokenValueOrderByTimestampDesc(tokenValue);
    }

    public List<UsageRecord> getUserUsageHistory(String userId) {
        return usageRecordRepository.findByUserIdOrderByTimestampDesc(userId);
    }

    public List<UsageRecord> getUserUsageHistory(String userId, LocalDateTime start, LocalDateTime end) {
        return usageRecordRepository.findByUserIdAndTimeRange(userId, start, end);
    }

    public List<UsageRecord> getServiceUsageHistory(String serviceId) {
        return usageRecordRepository.findByServiceIdOrderByTimestampDesc(serviceId);
    }

    public List<UsageRecord> getTimeRangeUsageHistory(LocalDateTime start, LocalDateTime end) {
        return usageRecordRepository.findByTimestampBetweenOrderByTimestampDesc(start, end);
    }
}

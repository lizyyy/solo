package com.tokenexchange.service;

import com.tokenexchange.entity.IdempotentRequest;
import com.tokenexchange.repository.IdempotentRequestRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotencyService {
    private final IdempotentRequestRepository idempotentRequestRepository;
    private final ObjectMapper objectMapper;

    public Optional<String> getCachedResponse(String requestId, String operationType) {
        if (requestId == null || requestId.isBlank()) {
            return Optional.empty();
        }

        return idempotentRequestRepository.findByRequestIdAndOperationType(requestId, operationType)
                .map(IdempotentRequest::getResponseData);
    }

    @Transactional
    public void cacheResponse(String requestId, String operationType, Object response, int expireMinutes) {
        if (requestId == null || requestId.isBlank()) {
            return;
        }

        IdempotentRequest request = new IdempotentRequest();
        request.setRequestId(requestId);
        request.setOperationType(operationType);
        request.setExpiresAt(LocalDateTime.now().plusMinutes(expireMinutes));

        try {
            request.setResponseData(objectMapper.writeValueAsString(response));
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize response for idempotency cache", e);
            request.setResponseData(response.toString());
        }

        idempotentRequestRepository.save(request);
        log.info("Response cached for idempotency: {} - {}", operationType, requestId);
    }

    public String generateRequestId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    @Transactional
    public void cleanupExpiredRequests() {
        idempotentRequestRepository.deleteByExpiresAtBefore(LocalDateTime.now());
        log.info("Expired idempotent requests cleaned up");
    }
}

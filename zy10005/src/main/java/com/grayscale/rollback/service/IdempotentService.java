package com.grayscale.rollback.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grayscale.rollback.config.RollbackSystemConfig;
import com.grayscale.rollback.entity.IdempotentRecord;
import com.grayscale.rollback.repository.IdempotentRecordRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

@Service
@Slf4j
public class IdempotentService {
    
    private final IdempotentRecordRepository repository;
    private final RollbackSystemConfig config;
    private final ObjectMapper objectMapper;
    
    public IdempotentService(IdempotentRecordRepository repository,
                            RollbackSystemConfig config,
                            ObjectMapper objectMapper) {
        this.repository = repository;
        this.config = config;
        this.objectMapper = objectMapper;
    }
    
    public String generateIdempotentKey(String releaseId, String operationType, Object request) {
        String requestHash = hashRequest(request);
        return String.format("%s:%s:%s", releaseId, operationType, requestHash);
    }
    
    private String hashRequest(Object request) {
        if (request == null) {
            return "null";
        }
        try {
            String json = objectMapper.writeValueAsString(request);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(json.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (JsonProcessingException | NoSuchAlgorithmException e) {
            log.warn("Failed to hash request, using UUID instead", e);
            return UUID.randomUUID().toString();
        }
    }
    
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public IdempotentRecord createIdempotentRecordInNewTransaction(String idempotentKey, 
                                                                     String releaseId, 
                                                                     String operationType, 
                                                                     String requestHash) {
        IdempotentRecord newRecord = IdempotentRecord.builder()
                .idempotentKey(idempotentKey)
                .releaseId(releaseId)
                .operationType(operationType)
                .requestHash(requestHash)
                .processed(false)
                .expiresAt(LocalDateTime.now().plusSeconds(config.getIdempotentTtlSeconds()))
                .build();
        IdempotentRecord saved = repository.save(newRecord);
        log.info("Idempotent record created in NEW transaction: key={}", idempotentKey);
        return saved;
    }
    
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markIdempotentSuccessInNewTransaction(String idempotentKey, String responseData) {
        Optional<IdempotentRecord> recordOpt = repository.findByIdempotentKey(idempotentKey);
        if (recordOpt.isPresent()) {
            IdempotentRecord record = recordOpt.get();
            record.setProcessed(true);
            record.setResponseData(responseData);
            repository.save(record);
            log.info("Idempotent record marked as success in NEW transaction: key={}", idempotentKey);
        }
    }
    
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markIdempotentFailedInNewTransaction(String idempotentKey, String errorMessage) {
        Optional<IdempotentRecord> recordOpt = repository.findByIdempotentKey(idempotentKey);
        if (recordOpt.isPresent()) {
            IdempotentRecord record = recordOpt.get();
            record.setProcessed(false);
            record.setErrorMessage(errorMessage);
            repository.save(record);
            log.info("Idempotent record marked as failed in NEW transaction: key={}, error={}", 
                    idempotentKey, errorMessage);
        }
    }
    
    @Transactional(propagation = Propagation.REQUIRED)
    public <T> T executeIdempotent(String releaseId, String operationType, Object request,
                                    Supplier<T> action, Class<T> responseType) {
        String idempotentKey = generateIdempotentKey(releaseId, operationType, request);
        String requestHash = hashRequest(request);
        
        Optional<IdempotentRecord> existingRecord = repository.findByIdempotentKey(idempotentKey);
        
        if (existingRecord.isPresent()) {
            IdempotentRecord record = existingRecord.get();
            if (record.getProcessed()) {
                log.info("Idempotent request detected, returning cached response: {}", idempotentKey);
                try {
                    return objectMapper.readValue(record.getResponseData(), responseType);
                } catch (JsonProcessingException e) {
                    log.warn("Failed to deserialize cached response, executing request again", e);
                }
            } else {
                throw new IllegalStateException("Previous request is still processing");
            }
        }
        
        createIdempotentRecordInNewTransaction(idempotentKey, releaseId, operationType, requestHash);
        
        try {
            T result = action.get();
            
            markIdempotentSuccessInNewTransaction(idempotentKey, objectMapper.writeValueAsString(result));
            
            return result;
        } catch (Exception e) {
            markIdempotentFailedInNewTransaction(idempotentKey, e.getMessage());
            throw e;
        }
    }
    
    @Transactional
    public void executeIdempotent(String releaseId, String operationType, Object request,
                                  Runnable action) {
        executeIdempotent(releaseId, operationType, request, () -> {
            action.run();
            return null;
        }, Void.class);
    }
}

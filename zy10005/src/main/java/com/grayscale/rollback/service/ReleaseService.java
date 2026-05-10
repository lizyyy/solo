package com.grayscale.rollback.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grayscale.rollback.config.RollbackSystemConfig;
import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.enums.OperationType;
import com.grayscale.rollback.enums.ReleaseEvent;
import com.grayscale.rollback.enums.ReleaseStatus;
import com.grayscale.rollback.repository.ReleaseRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.statemachine.StateMachine;
import org.springframework.statemachine.config.StateMachineFactory;
import org.springframework.statemachine.support.DefaultStateMachineContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class ReleaseService {
    
    private final ReleaseRepository releaseRepository;
    private final StateMachineFactory<ReleaseStatus, ReleaseEvent> stateMachineFactory;
    private final DistributedLockService lockService;
    private final IdempotentService idempotentService;
    private final OperationLogService logService;
    private final RollbackSystemConfig config;
    private final ObjectMapper objectMapper;
    
    private static final String OPERATOR = "system";
    private static final String CACHE_NAME = "releases";
    
    public ReleaseService(ReleaseRepository releaseRepository,
                          StateMachineFactory<ReleaseStatus, ReleaseEvent> stateMachineFactory,
                          DistributedLockService lockService,
                          IdempotentService idempotentService,
                          OperationLogService logService,
                          RollbackSystemConfig config,
                          ObjectMapper objectMapper) {
        this.releaseRepository = releaseRepository;
        this.stateMachineFactory = stateMachineFactory;
        this.lockService = lockService;
        this.idempotentService = idempotentService;
        this.logService = logService;
        this.config = config;
        this.objectMapper = objectMapper;
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, allEntries = true)
    public Release createRelease(String serviceName, String currentVersion, 
                                  String targetVersion, int totalInstances, String metadata) {
        String idempotentReleaseId = generateDeterministicId(
            serviceName, currentVersion, targetVersion, totalInstances, metadata
        );
        
        Map<String, Object> requestContext = new HashMap<>();
        requestContext.put("serviceName", serviceName);
        requestContext.put("currentVersion", currentVersion);
        requestContext.put("targetVersion", targetVersion);
        requestContext.put("totalInstances", totalInstances);
        requestContext.put("metadata", metadata);
        requestContext.put("deterministicId", idempotentReleaseId);
        
        return idempotentService.executeIdempotent(
            idempotentReleaseId,
            OperationType.CREATE_RELEASE.name(),
            requestContext,
            () -> {
                long startTime = System.currentTimeMillis();
                Release release = Release.builder()
                        .id(idempotentReleaseId)
                        .serviceName(serviceName)
                        .currentVersion(currentVersion)
                        .targetVersion(targetVersion)
                        .status(ReleaseStatus.PENDING)
                        .totalInstances(totalInstances)
                        .updatedInstances(0)
                        .metadata(metadata)
                        .build();
                
                Release savedRelease = releaseRepository.save(release);
                
                logService.logSuccess(savedRelease.getId(), OperationType.CREATE_RELEASE,
                        null, savedRelease, OPERATOR, 
                        String.format("Created release for %s from %s to %s", serviceName, currentVersion, targetVersion),
                        System.currentTimeMillis() - startTime);
                
                return savedRelease;
            },
            Release.class
        );
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, key = "#releaseId")
    public Release startRelease(String releaseId) {
        return idempotentService.executeIdempotent(
            releaseId,
            OperationType.START_PREPARING.name(),
            Map.of("releaseId", releaseId),
            () -> {
                return lockService.executeWithLock(
                    "release:" + releaseId,
                    5, config.getLockTimeoutSeconds(), TimeUnit.SECONDS,
                    () -> {
                        long startTime = System.currentTimeMillis();
                        Optional<Release> releaseOpt = releaseRepository.findByIdWithLock(releaseId);
                        if (releaseOpt.isEmpty()) {
                            throw new IllegalArgumentException("Release not found: " + releaseId);
                        }
                        
                        Release release = releaseOpt.get();
                        Release beforeRelease = copyRelease(release);
                        
                        if (release.getStatus() != ReleaseStatus.PENDING) {
                            throw new IllegalStateException("Release must be in PENDING state to start, current: " + release.getStatus());
                        }
                        
                        try {
                            StateMachine<ReleaseStatus, ReleaseEvent> sm = buildStateMachine(release);
                            if (!sendEvent(sm, ReleaseEvent.START_PREPARING, release)) {
                                throw new IllegalStateException("Failed to transition to PREPARING state");
                            }
                            
                            release.setStatus(ReleaseStatus.PREPARING);
                            release.setStartedAt(LocalDateTime.now());
                            release.setRollbackCheckpoint(createCheckpoint(release));
                            
                            Release savedRelease = releaseRepository.save(release);
                            
                            logService.logSuccess(savedRelease.getId(), OperationType.START_PREPARING,
                                    beforeRelease, savedRelease, OPERATOR, null,
                                    System.currentTimeMillis() - startTime);
                            
                            return savedRelease;
                        } catch (Exception e) {
                            logService.logFailure(releaseId, OperationType.START_PREPARING,
                                    beforeRelease, release, e.getMessage(), OPERATOR, null,
                                    System.currentTimeMillis() - startTime);
                            throw e;
                        }
                    },
                    () -> {
                        throw new IllegalStateException("Failed to acquire lock for release: " + releaseId);
                    }
                );
            },
            Release.class
        );
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, key = "#releaseId")
    public Release advanceCanary(String releaseId) {
        return idempotentService.executeIdempotent(
            releaseId,
            OperationType.ADVANCE_CANARY.name(),
            Map.of("releaseId", releaseId),
            () -> {
                return lockService.executeWithLock(
                    "release:" + releaseId,
                    5, config.getLockTimeoutSeconds(), TimeUnit.SECONDS,
                    () -> {
                        long startTime = System.currentTimeMillis();
                        Optional<Release> releaseOpt = releaseRepository.findByIdWithLock(releaseId);
                        if (releaseOpt.isEmpty()) {
                            throw new IllegalArgumentException("Release not found: " + releaseId);
                        }
                        
                        Release release = releaseOpt.get();
                        Release beforeRelease = copyRelease(release);
                        
                        try {
                            ReleaseStatus currentStatus = release.getStatus();
                            ReleaseEvent event = getNextEvent(currentStatus);
                            
                            if (event == null) {
                                throw new IllegalStateException("Cannot advance from state: " + currentStatus);
                            }
                            
                            StateMachine<ReleaseStatus, ReleaseEvent> sm = buildStateMachine(release);
                            if (!sendEvent(sm, event, release)) {
                                throw new IllegalStateException("Failed to advance canary stage");
                            }
                            
                            ReleaseStatus nextStatus = getNextStatus(currentStatus);
                            int targetInstances = calculateTargetInstances(release.getTotalInstances(), nextStatus);
                            
                            release.setStatus(nextStatus);
                            release.setUpdatedInstances(targetInstances);
                            
                            if (nextStatus == ReleaseStatus.COMPLETED) {
                                release.setCompletedAt(LocalDateTime.now());
                            }
                            
                            Release savedRelease = releaseRepository.save(release);
                            
                            logService.logSuccess(savedRelease.getId(), OperationType.ADVANCE_CANARY,
                                    beforeRelease, savedRelease, OPERATOR,
                                    String.format("Advanced to %s with %d instances", nextStatus, targetInstances),
                                    System.currentTimeMillis() - startTime);
                            
                            return savedRelease;
                        } catch (Exception e) {
                            logService.logFailure(releaseId, OperationType.ADVANCE_CANARY,
                                    beforeRelease, release, e.getMessage(), OPERATOR, null,
                                    System.currentTimeMillis() - startTime);
                            throw e;
                        }
                    },
                    () -> {
                        throw new IllegalStateException("Failed to acquire lock for release: " + releaseId);
                    }
                );
            },
            Release.class
        );
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, key = "#releaseId")
    public Release triggerRollback(String releaseId, String reason) {
        return idempotentService.executeIdempotent(
            releaseId,
            OperationType.TRIGGER_ROLLBACK.name(),
            Map.of("releaseId", releaseId, "reason", reason),
            () -> {
                return lockService.executeWithLock(
                    "release:" + releaseId,
                    5, config.getLockTimeoutSeconds(), TimeUnit.SECONDS,
                    () -> {
                        long startTime = System.currentTimeMillis();
                        Optional<Release> releaseOpt = releaseRepository.findByIdWithLock(releaseId);
                        if (releaseOpt.isEmpty()) {
                            throw new IllegalArgumentException("Release not found: " + releaseId);
                        }
                        
                        Release release = releaseOpt.get();
                        Release beforeRelease = copyRelease(release);
                        
                        if (!isRollbackable(release.getStatus())) {
                            throw new IllegalStateException("Cannot rollback from state: " + release.getStatus());
                        }
                        
                        try {
                            StateMachine<ReleaseStatus, ReleaseEvent> sm = buildStateMachine(release);
                            if (!sendEvent(sm, ReleaseEvent.TRIGGER_ROLLBACK, release)) {
                                throw new IllegalStateException("Failed to transition to ROLLBACKING state");
                            }
                            
                            release.setStatus(ReleaseStatus.ROLLBACKING);
                            release.setErrorMessage(reason);
                            
                            Release savedRelease = releaseRepository.save(release);
                            
                            logService.logSuccess(savedRelease.getId(), OperationType.TRIGGER_ROLLBACK,
                                    beforeRelease, savedRelease, OPERATOR, reason,
                                    System.currentTimeMillis() - startTime);
                            
                            return savedRelease;
                        } catch (Exception e) {
                            logService.logFailure(releaseId, OperationType.TRIGGER_ROLLBACK,
                                    beforeRelease, release, e.getMessage(), OPERATOR, reason,
                                    System.currentTimeMillis() - startTime);
                            throw e;
                        }
                    },
                    () -> {
                        throw new IllegalStateException("Failed to acquire lock for release: " + releaseId);
                    }
                );
            },
            Release.class
        );
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, key = "#releaseId")
    public Release executeRollback(String releaseId) {
        return idempotentService.executeIdempotent(
            releaseId,
            OperationType.EXECUTE_ROLLBACK.name(),
            Map.of("releaseId", releaseId),
            () -> {
                return lockService.executeWithLock(
                    "release:" + releaseId,
                    5, config.getLockTimeoutSeconds(), TimeUnit.SECONDS,
                    () -> {
                        long startTime = System.currentTimeMillis();
                        Optional<Release> releaseOpt = releaseRepository.findByIdWithLock(releaseId);
                        if (releaseOpt.isEmpty()) {
                            throw new IllegalArgumentException("Release not found: " + releaseId);
                        }
                        
                        Release release = releaseOpt.get();
                        Release beforeRelease = copyRelease(release);
                        
                        if (release.getStatus() != ReleaseStatus.ROLLBACKING) {
                            throw new IllegalStateException("Release must be in ROLLBACKING state, current: " + release.getStatus());
                        }
                        
                        try {
                            ReleaseStatus originalStatus = restoreFromCheckpoint(release);
                            
                            StateMachine<ReleaseStatus, ReleaseEvent> sm = buildStateMachine(release);
                            if (!sendEvent(sm, ReleaseEvent.ROLLBACK_COMPLETE, release)) {
                                throw new IllegalStateException("Failed to complete rollback");
                            }
                            
                            release.setStatus(ReleaseStatus.ROLLED_BACK);
                            release.setUpdatedInstances(0);
                            
                            Release savedRelease = releaseRepository.save(release);
                            
                            logService.logSuccess(savedRelease.getId(), OperationType.COMPLETE_ROLLBACK,
                                    beforeRelease, savedRelease, OPERATOR,
                                    "Rolled back from " + originalStatus,
                                    System.currentTimeMillis() - startTime);
                            
                            return savedRelease;
                        } catch (Exception e) {
                            logService.logFailure(releaseId, OperationType.EXECUTE_ROLLBACK,
                                    beforeRelease, release, e.getMessage(), OPERATOR, null,
                                    System.currentTimeMillis() - startTime);
                            
                            release.setStatus(ReleaseStatus.FAILED);
                            release.setFailedAt(LocalDateTime.now());
                            release.setErrorMessage("Rollback failed: " + e.getMessage());
                            releaseRepository.save(release);
                            
                            throw e;
                        }
                    },
                    () -> {
                        throw new IllegalStateException("Failed to acquire lock for release: " + releaseId);
                    }
                );
            },
            Release.class
        );
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, key = "#releaseId")
    public Release failRelease(String releaseId, String reason) {
        return idempotentService.executeIdempotent(
            releaseId,
            OperationType.FAIL_RELEASE.name(),
            Map.of("releaseId", releaseId, "reason", reason),
            () -> {
                long startTime = System.currentTimeMillis();
                Optional<Release> releaseOpt = releaseRepository.findById(releaseId);
                if (releaseOpt.isEmpty()) {
                    throw new IllegalArgumentException("Release not found: " + releaseId);
                }
                
                Release release = releaseOpt.get();
                Release beforeRelease = copyRelease(release);
                
                try {
                    StateMachine<ReleaseStatus, ReleaseEvent> sm = buildStateMachine(release);
                    if (!sendEvent(sm, ReleaseEvent.FAIL, release)) {
                        throw new IllegalStateException("Failed to transition to FAILED state");
                    }
                    
                    release.setStatus(ReleaseStatus.FAILED);
                    release.setFailedAt(LocalDateTime.now());
                    release.setErrorMessage(reason);
                    
                    Release savedRelease = releaseRepository.save(release);
                    
                    logService.logSuccess(savedRelease.getId(), OperationType.FAIL_RELEASE,
                            beforeRelease, savedRelease, OPERATOR, reason,
                            System.currentTimeMillis() - startTime);
                    
                    return savedRelease;
                } catch (Exception e) {
                    logService.logFailure(releaseId, OperationType.FAIL_RELEASE,
                            beforeRelease, release, e.getMessage(), OPERATOR, reason,
                            System.currentTimeMillis() - startTime);
                    throw e;
                }
            },
            Release.class
        );
    }
    
    @Cacheable(value = CACHE_NAME, key = "#releaseId")
    public Optional<Release> getRelease(String releaseId) {
        log.info("Cache miss for release: {}", releaseId);
        return releaseRepository.findById(releaseId);
    }
    
    public List<Release> getActiveReleases() {
        List<ReleaseStatus> activeStatuses = List.of(
            ReleaseStatus.PENDING,
            ReleaseStatus.PREPARING,
            ReleaseStatus.CANARY_10,
            ReleaseStatus.CANARY_30,
            ReleaseStatus.CANARY_50,
            ReleaseStatus.CANARY_100,
            ReleaseStatus.ROLLBACKING
        );
        return releaseRepository.findByStatusIn(activeStatuses);
    }
    
    @Transactional
    @CacheEvict(value = CACHE_NAME, key = "#releaseId")
    public Release restoreReleaseFromCheckpoint(String releaseId, Release checkpointRelease) {
        Optional<Release> currentReleaseOpt = releaseRepository.findById(releaseId);
        if (currentReleaseOpt.isEmpty()) {
            throw new IllegalArgumentException("Release not found: " + releaseId);
        }
        
        Release currentRelease = currentReleaseOpt.get();
        Release beforeRelease = copyRelease(currentRelease);
        
        checkpointRelease.setVersion(currentRelease.getVersion());
        
        Release savedRelease = releaseRepository.save(checkpointRelease);
        
        logService.logSuccess(releaseId, OperationType.REPLAY_OPERATION,
                beforeRelease, savedRelease, OPERATOR,
                "Restored from checkpoint state: " + checkpointRelease.getStatus(),
                0);
        
        return savedRelease;
    }
    
    private StateMachine<ReleaseStatus, ReleaseEvent> buildStateMachine(Release release) {
        StateMachine<ReleaseStatus, ReleaseEvent> sm = stateMachineFactory.getStateMachine(release.getId());
        sm.stopReactively().block();
        sm.getStateMachineAccessor()
            .doWithAllRegions(accessor -> {
                accessor.resetStateMachineReactively(new DefaultStateMachineContext<>(
                    release.getStatus(), null, null, null
                )).block();
            });
        sm.startReactively().block();
        return sm;
    }
    
    private boolean sendEvent(StateMachine<ReleaseStatus, ReleaseEvent> sm, 
                              ReleaseEvent event, Release release) {
        return sm.sendEvent(org.springframework.messaging.support.MessageBuilder
                .withPayload(event)
                .setHeader("releaseId", release.getId())
                .build()).block();
    }
    
    private ReleaseEvent getNextEvent(ReleaseStatus status) {
        return switch (status) {
            case PREPARING -> ReleaseEvent.ADVANCE_TO_CANARY_10;
            case CANARY_10 -> ReleaseEvent.ADVANCE_TO_CANARY_30;
            case CANARY_30 -> ReleaseEvent.ADVANCE_TO_CANARY_50;
            case CANARY_50 -> ReleaseEvent.ADVANCE_TO_CANARY_100;
            case CANARY_100 -> ReleaseEvent.COMPLETE;
            default -> null;
        };
    }
    
    private ReleaseStatus getNextStatus(ReleaseStatus status) {
        return switch (status) {
            case PREPARING -> ReleaseStatus.CANARY_10;
            case CANARY_10 -> ReleaseStatus.CANARY_30;
            case CANARY_30 -> ReleaseStatus.CANARY_50;
            case CANARY_50 -> ReleaseStatus.CANARY_100;
            case CANARY_100 -> ReleaseStatus.COMPLETED;
            default -> status;
        };
    }
    
    private int calculateTargetInstances(int totalInstances, ReleaseStatus status) {
        int percentage = switch (status) {
            case CANARY_10 -> 10;
            case CANARY_30 -> 30;
            case CANARY_50 -> 50;
            case CANARY_100, COMPLETED -> 100;
            default -> 0;
        };
        return (int) Math.ceil(totalInstances * percentage / 100.0);
    }
    
    private boolean isRollbackable(ReleaseStatus status) {
        return status == ReleaseStatus.PREPARING ||
               status == ReleaseStatus.CANARY_10 ||
               status == ReleaseStatus.CANARY_30 ||
               status == ReleaseStatus.CANARY_50 ||
               status == ReleaseStatus.CANARY_100;
    }
    
    public String createCheckpoint(Release release) {
        try {
            return objectMapper.writeValueAsString(release);
        } catch (JsonProcessingException e) {
            log.warn("Failed to create checkpoint", e);
            return null;
        }
    }
    
    public Release parseCheckpoint(String checkpointJson) {
        if (checkpointJson == null) {
            return null;
        }
        try {
            return objectMapper.readValue(checkpointJson, Release.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse checkpoint", e);
            return null;
        }
    }
    
    private ReleaseStatus restoreFromCheckpoint(Release release) {
        if (release.getRollbackCheckpoint() != null) {
            try {
                Release checkpoint = objectMapper.readValue(release.getRollbackCheckpoint(), Release.class);
                return checkpoint.getStatus();
            } catch (JsonProcessingException e) {
                log.warn("Failed to restore from checkpoint", e);
            }
        }
        return release.getStatus();
    }
    
    public Release copyRelease(Release release) {
        return Release.builder()
                .id(release.getId())
                .serviceName(release.getServiceName())
                .currentVersion(release.getCurrentVersion())
                .targetVersion(release.getTargetVersion())
                .status(release.getStatus())
                .totalInstances(release.getTotalInstances())
                .updatedInstances(release.getUpdatedInstances())
                .rollbackCheckpoint(release.getRollbackCheckpoint())
                .errorMessage(release.getErrorMessage())
                .metadata(release.getMetadata())
                .createdAt(release.getCreatedAt())
                .startedAt(release.getStartedAt())
                .completedAt(release.getCompletedAt())
                .failedAt(release.getFailedAt())
                .version(release.getVersion())
                .build();
    }
    
    private String generateDeterministicId(String serviceName, String currentVersion,
                                            String targetVersion, int totalInstances,
                                            String metadata) {
        try {
            Map<String, Object> idSource = new HashMap<>();
            idSource.put("serviceName", serviceName);
            idSource.put("currentVersion", currentVersion);
            idSource.put("targetVersion", targetVersion);
            idSource.put("totalInstances", totalInstances);
            idSource.put("metadata", metadata);
            idSource.put("timestamp", LocalDateTime.now().toLocalDate().toString());
            
            String json = objectMapper.writeValueAsString(idSource);
            
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            
            return "rel-" + hexString.toString().substring(0, 32);
        } catch (Exception e) {
            log.warn("Failed to generate deterministic ID, falling back to UUID", e);
            return "rel-" + UUID.randomUUID().toString();
        }
    }
}

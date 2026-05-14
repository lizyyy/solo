package com.example.lock.service;

import com.example.lock.dto.LockRequest;
import com.example.lock.dto.LockResponse;
import com.example.lock.dto.ReleaseRequest;
import com.example.lock.entity.IdempotentRequest;
import com.example.lock.entity.ReleaseAudit;
import com.example.lock.entity.ResourceLock;
import com.example.lock.entity.WaitQueueItem;
import com.example.lock.enums.LockStatus;
import com.example.lock.enums.OperationSource;
import com.example.lock.exception.LockException;
import com.example.lock.repository.IdempotentRequestRepository;
import com.example.lock.repository.ReleaseAuditRepository;
import com.example.lock.repository.ResourceLockRepository;
import com.example.lock.repository.WaitQueueItemRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResourceLockService {

    private final ResourceLockRepository lockRepository;
    private final WaitQueueItemRepository queueRepository;
    private final ReleaseAuditRepository auditRepository;
    private final IdempotentRequestRepository idempotentRepository;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Transactional
    public LockResponse acquireLock(LockRequest request) {
        log.debug("尝试获取锁: resourceId={}, lockHolder={}, requestId={}", 
                request.getResourceId(), request.getLockHolder(), request.getRequestId());

        Optional<LockResponse> idempotentResult = checkIdempotentRequest(request.getRequestId(), LockResponse.class);
        if (idempotentResult.isPresent()) {
            log.debug("命中幂等缓存: requestId={}", request.getRequestId());
            return idempotentResult.get();
        }

        if (lockRepository.existsByRequestId(request.getRequestId()) || 
            queueRepository.existsByRequestId(request.getRequestId())) {
            return handleIdempotentRequest(request);
        }

        Optional<ResourceLock> existingLock = lockRepository.findByResourceId(request.getResourceId());

        if (!existingLock.isPresent()) {
            LockResponse response = createNewLock(request);
            saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "ACQUIRE", response);
            return response;
        }

        ResourceLock lock = existingLock.get();

        if (lock.getStatus() == LockStatus.LOCKED) {
            if (lock.getLockHolder().equals(request.getLockHolder())) {
                LockResponse response = extendLock(lock, request);
                saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "ACQUIRE", response);
                return response;
            }

            if (isLockExpired(lock)) {
                releaseLockInternal(lock, OperationSource.TIMEOUT, "锁超时自动释放");
                LockResponse response = createNewLock(request);
                saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "ACQUIRE", response);
                return response;
            }

            if (request.isWaitInQueue()) {
                LockResponse response = addToWaitQueue(request);
                saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "ACQUIRE", response);
                return response;
            }

            LockResponse response = createConflictResponse(lock, request);
            saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "ACQUIRE", response);
            return response;
        }

        if (lock.getStatus() == LockStatus.AVAILABLE || 
            lock.getStatus() == LockStatus.RELEASED || 
            lock.getStatus() == LockStatus.EXPIRED) {
            LockResponse response = updateExistingLock(lock, request);
            saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "ACQUIRE", response);
            return response;
        }

        throw new LockException(500, "未知的锁状态", request.getRequestId());
    }

    private LockResponse handleIdempotentRequest(LockRequest request) {
        Optional<ResourceLock> lock = lockRepository.findByRequestId(request.getRequestId());
        if (lock.isPresent()) {
            return buildLockResponse(lock.get(), true, "重复请求，返回已有结果");
        }

        Optional<WaitQueueItem> queueItem = queueRepository.findByRequestId(request.getRequestId());
        if (queueItem.isPresent()) {
            return buildQueueResponse(queueItem.get(), true, "重复请求，返回已有排队结果");
        }

        throw new LockException(500, "幂等性检查失败", request.getRequestId());
    }

    private <T> Optional<T> checkIdempotentRequest(String requestId, Class<T> responseType) {
        return idempotentRepository.findByRequestId(requestId)
                .map(req -> {
                    try {
                        return objectMapper.readValue(req.getResponseData(), responseType);
                    } catch (JsonProcessingException e) {
                        log.warn("解析幂等响应失败: {}", e.getMessage());
                        return null;
                    }
                });
    }

    private <T> void saveIdempotentResponse(String requestId, String resourceId, String operationType, T response) {
        try {
            IdempotentRequest idempotent = new IdempotentRequest();
            idempotent.setRequestId(requestId);
            idempotent.setResourceId(resourceId);
            idempotent.setOperationType(operationType);
            idempotent.setResponseData(objectMapper.writeValueAsString(response));
            idempotentRepository.save(idempotent);
        } catch (JsonProcessingException e) {
            log.warn("序列化幂等响应失败: {}", e.getMessage());
        }
    }

    private LockResponse createNewLock(LockRequest request) {
        ResourceLock lock = new ResourceLock();
        lock.setResourceId(request.getResourceId());
        lock.setLockHolder(request.getLockHolder());
        lock.setRequestId(request.getRequestId());
        lock.setStatus(LockStatus.LOCKED);
        lock.setOperationSource(request.getOperationSource());
        lock.setTimeoutStrategy(request.getTimeoutStrategy());
        lock.setTimeoutSeconds(request.getTimeoutSeconds());
        lock.setLockTime(LocalDateTime.now());
        lock.setExpireTime(LocalDateTime.now().plusSeconds(request.getTimeoutSeconds()));

        lockRepository.save(lock);
        log.info("成功获取锁: resourceId={}, lockHolder={}", request.getResourceId(), request.getLockHolder());

        return buildLockResponse(lock, true, "成功获取锁");
    }

    private LockResponse updateExistingLock(ResourceLock lock, LockRequest request) {
        lock.setLockHolder(request.getLockHolder());
        lock.setRequestId(request.getRequestId());
        lock.setStatus(LockStatus.LOCKED);
        lock.setOperationSource(request.getOperationSource());
        lock.setTimeoutStrategy(request.getTimeoutStrategy());
        lock.setTimeoutSeconds(request.getTimeoutSeconds());
        lock.setLockTime(LocalDateTime.now());
        lock.setExpireTime(LocalDateTime.now().plusSeconds(request.getTimeoutSeconds()));
        lock.setConflictReason(null);
        lock.setWaitQueuePosition(null);
        lock.setReleaseTime(null);

        lockRepository.save(lock);
        log.info("重新获取锁: resourceId={}, lockHolder={}", request.getResourceId(), request.getLockHolder());

        return buildLockResponse(lock, true, "成功获取锁");
    }

    private LockResponse extendLock(ResourceLock lock, LockRequest request) {
        lock.setExpireTime(LocalDateTime.now().plusSeconds(request.getTimeoutSeconds()));
        lock.setTimeoutSeconds(request.getTimeoutSeconds());
        lockRepository.save(lock);
        log.info("锁续期成功: resourceId={}, lockHolder={}", request.getResourceId(), request.getLockHolder());
        return buildLockResponse(lock, true, "锁续期成功");
    }

    private LockResponse addToWaitQueue(LockRequest request) {
        int queueSize = queueRepository.countByResourceIdAndStatus(request.getResourceId(), LockStatus.WAITING);
        int position = queueSize + 1;

        WaitQueueItem queueItem = new WaitQueueItem();
        queueItem.setResourceId(request.getResourceId());
        queueItem.setLockHolder(request.getLockHolder());
        queueItem.setRequestId(request.getRequestId());
        queueItem.setQueuePosition(position);
        queueItem.setStatus(LockStatus.WAITING);
        queueItem.setTimeoutSeconds(request.getTimeoutSeconds());

        queueRepository.save(queueItem);
        log.info("加入等待队列: resourceId={}, lockHolder={}, position={}", 
                request.getResourceId(), request.getLockHolder(), position);

        return buildQueueResponse(queueItem, true, "已加入等待队列，当前位置: " + position);
    }

    private LockResponse createConflictResponse(ResourceLock lock, LockRequest request) {
        String conflictReason = String.format("资源已被锁定，当前持有人: %s，超时时间: %s", 
                lock.getLockHolder(), lock.getExpireTime());

        LockResponse response = new LockResponse();
        response.setResourceId(request.getResourceId());
        response.setLockHolder(request.getLockHolder());
        response.setRequestId(request.getRequestId());
        response.setStatus(LockStatus.AVAILABLE);
        response.setConflictReason(conflictReason);
        response.setSuccess(false);
        response.setMessage("获取锁失败: " + conflictReason);

        return response;
    }

    @Transactional
    public LockResponse releaseLock(ReleaseRequest request) {
        log.debug("尝试释放锁: resourceId={}, lockHolder={}, requestId={}", 
                request.getResourceId(), request.getLockHolder(), request.getRequestId());

        Optional<LockResponse> idempotentResult = checkIdempotentRequest(request.getRequestId(), LockResponse.class);
        if (idempotentResult.isPresent()) {
            log.debug("命中释放幂等缓存: requestId={}", request.getRequestId());
            LockResponse cached = idempotentResult.get();
            cached.setMessage("重复请求，返回已有释放结果");
            return cached;
        }

        Optional<ResourceLock> lockOpt = lockRepository.findByResourceId(request.getResourceId());

        if (!lockOpt.isPresent()) {
            LockResponse errorResponse = new LockResponse();
            errorResponse.setResourceId(request.getResourceId());
            errorResponse.setLockHolder(request.getLockHolder());
            errorResponse.setRequestId(request.getRequestId());
            errorResponse.setSuccess(false);
            errorResponse.setMessage("锁不存在，无需重复释放");
            saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "RELEASE", errorResponse);
            return errorResponse;
        }

        ResourceLock lock = lockOpt.get();

        if (!lock.getLockHolder().equals(request.getLockHolder())) {
            throw new LockException(403, "无权释放该锁，锁持有人不匹配", request.getRequestId());
        }

        if (lock.getStatus() != LockStatus.LOCKED) {
            LockResponse errorResponse = buildLockResponse(lock, false, "锁当前不处于锁定状态，无需重复释放");
            saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "RELEASE", errorResponse);
            return errorResponse;
        }

        releaseLockInternal(lock, request.getOperationSource(), request.getReleaseReason());
        processNextInQueue(request.getResourceId());

        LockResponse response = buildLockResponse(lock, true, "锁已成功释放");
        response.setStatus(LockStatus.RELEASED);
        saveIdempotentResponse(request.getRequestId(), request.getResourceId(), "RELEASE", response);
        return response;
    }

    private void releaseLockInternal(ResourceLock lock, OperationSource source, String reason) {
        LocalDateTime now = LocalDateTime.now();
        lock.setStatus(LockStatus.RELEASED);
        lock.setReleaseTime(now);
        lockRepository.save(lock);

        ReleaseAudit audit = new ReleaseAudit();
        audit.setResourceId(lock.getResourceId());
        audit.setLockHolder(lock.getLockHolder());
        audit.setRequestId(lock.getRequestId());
        audit.setReleaseSource(source);
        audit.setReleaseReason(reason);

        if (lock.getLockTime() != null) {
            audit.setLockDurationSeconds(Duration.between(lock.getLockTime(), now).getSeconds());
        }

        auditRepository.save(audit);
        log.info("锁已释放: resourceId={}, lockHolder={}, source={}", lock.getResourceId(), lock.getLockHolder(), source);
    }

    private void processNextInQueue(String resourceId) {
        Optional<WaitQueueItem> nextItem = queueRepository.findFirstByResourceIdAndStatusOrderByQueuePositionAsc(
                resourceId, LockStatus.WAITING);

        if (nextItem.isPresent()) {
            WaitQueueItem item = nextItem.get();

            Optional<ResourceLock> lockOpt = lockRepository.findByResourceId(resourceId);
            if (lockOpt.isPresent()) {
                ResourceLock lock = lockOpt.get();
                lock.setLockHolder(item.getLockHolder());
                lock.setRequestId(item.getRequestId());
                lock.setStatus(LockStatus.LOCKED);
                lock.setLockTime(LocalDateTime.now());
                lock.setExpireTime(LocalDateTime.now().plusSeconds(item.getTimeoutSeconds()));
                lock.setConflictReason(null);
                lockRepository.save(lock);

                item.setStatus(LockStatus.LOCKED);
                item.setAcquiredAt(LocalDateTime.now());
                queueRepository.save(item);

                updateQueuePositions(resourceId);

                log.info("等待队列中的锁已获取: resourceId={}, lockHolder={}", resourceId, item.getLockHolder());
            }
        }
    }

    private void updateQueuePositions(String resourceId) {
        List<WaitQueueItem> items = queueRepository.findByResourceIdAndStatusOrderByQueuePositionAsc(
                resourceId, LockStatus.WAITING);
        int position = 1;
        for (WaitQueueItem item : items) {
            item.setQueuePosition(position++);
            queueRepository.save(item);
        }
    }

    @Transactional
    public void processExpiredLocks() {
        log.debug("检查超时锁...");
        List<ResourceLock> expiredLocks = lockRepository.findExpiredLocks(LockStatus.LOCKED, LocalDateTime.now());

        for (ResourceLock lock : expiredLocks) {
            releaseLockInternal(lock, OperationSource.TIMEOUT, "锁超时自动释放");
            processNextInQueue(lock.getResourceId());
        }

        log.debug("处理了 {} 个超时锁", expiredLocks.size());
    }

    public boolean isLockExpired(ResourceLock lock) {
        return lock.getExpireTime() != null && lock.getExpireTime().isBefore(LocalDateTime.now());
    }

    public Optional<ResourceLock> getLockByResourceId(String resourceId) {
        return lockRepository.findByResourceId(resourceId);
    }

    public List<WaitQueueItem> getWaitQueue(String resourceId) {
        return queueRepository.findByResourceIdOrderByQueuePositionAsc(resourceId);
    }

    public List<ReleaseAudit> getReleaseHistory(String resourceId) {
        return auditRepository.findByResourceIdOrderByReleasedAtDesc(resourceId);
    }

    public List<ReleaseAudit> getReleaseHistoryByTimeRange(String resourceId, LocalDateTime start, LocalDateTime end) {
        return auditRepository.findByResourceIdAndReleasedAtBetweenOrderByReleasedAtDesc(resourceId, start, end);
    }

    public List<ResourceLock> getAllLocks() {
        return lockRepository.findAll();
    }

    public Map<String, Object> exportLockStatus(String resourceId) {
        Map<String, Object> export = new LinkedHashMap<>();

        Optional<ResourceLock> lockOpt = getLockByResourceId(resourceId);
        if (lockOpt.isPresent()) {
            ResourceLock lock = lockOpt.get();
            Map<String, Object> lockInfo = new LinkedHashMap<>();
            lockInfo.put("resourceId", lock.getResourceId());
            lockInfo.put("lockHolder", lock.getLockHolder());
            lockInfo.put("status", lock.getStatus());
            lockInfo.put("lockTime", lock.getLockTime());
            lockInfo.put("expireTime", lock.getExpireTime());
            lockInfo.put("releaseTime", lock.getReleaseTime());
            lockInfo.put("operationSource", lock.getOperationSource());
            lockInfo.put("timeoutSeconds", lock.getTimeoutSeconds());
            export.put("lockStatus", lockInfo);
        } else {
            export.put("lockStatus", null);
        }

        List<WaitQueueItem> queue = getWaitQueue(resourceId);
        List<Map<String, Object>> queueList = queue.stream().map(item -> {
            Map<String, Object> itemMap = new LinkedHashMap<>();
            itemMap.put("position", item.getQueuePosition());
            itemMap.put("lockHolder", item.getLockHolder());
            itemMap.put("requestId", item.getRequestId());
            itemMap.put("status", item.getStatus());
            itemMap.put("queuedAt", item.getQueuedAt());
            itemMap.put("acquiredAt", item.getAcquiredAt());
            return itemMap;
        }).collect(Collectors.toList());
        export.put("waitQueue", queueList);
        export.put("waitQueueCount", queueList.size());

        List<ReleaseAudit> history = getReleaseHistory(resourceId);
        List<Map<String, Object>> historyList = history.stream().map(audit -> {
            Map<String, Object> auditMap = new LinkedHashMap<>();
            auditMap.put("lockHolder", audit.getLockHolder());
            auditMap.put("requestId", audit.getRequestId());
            auditMap.put("releaseSource", audit.getReleaseSource());
            auditMap.put("releaseReason", audit.getReleaseReason());
            auditMap.put("lockDurationSeconds", audit.getLockDurationSeconds());
            auditMap.put("releasedAt", audit.getReleasedAt());
            return auditMap;
        }).collect(Collectors.toList());
        export.put("releaseHistory", historyList);
        export.put("releaseHistoryCount", historyList.size());

        export.put("exportTime", LocalDateTime.now());
        export.put("resourceId", resourceId);

        return export;
    }

    public Map<String, Object> exportAllLocks() {
        Map<String, Object> export = new LinkedHashMap<>();

        List<ResourceLock> locks = getAllLocks();
        List<Map<String, Object>> locksList = locks.stream().map(lock -> {
            Map<String, Object> lockMap = new LinkedHashMap<>();
            lockMap.put("resourceId", lock.getResourceId());
            lockMap.put("lockHolder", lock.getLockHolder());
            lockMap.put("status", lock.getStatus());
            lockMap.put("lockTime", lock.getLockTime());
            lockMap.put("expireTime", lock.getExpireTime());
            lockMap.put("operationSource", lock.getOperationSource());
            return lockMap;
        }).collect(Collectors.toList());

        export.put("locks", locksList);
        export.put("totalLocks", locksList.size());
        export.put("lockedCount", locks.stream().filter(l -> l.getStatus() == LockStatus.LOCKED).count());
        export.put("releasedCount", locks.stream().filter(l -> l.getStatus() == LockStatus.RELEASED).count());
        export.put("exportTime", LocalDateTime.now());

        return export;
    }

    private LockResponse buildLockResponse(ResourceLock lock, boolean success, String message) {
        LockResponse response = new LockResponse();
        response.setResourceId(lock.getResourceId());
        response.setLockHolder(lock.getLockHolder());
        response.setRequestId(lock.getRequestId());
        response.setStatus(lock.getStatus());
        response.setLockTime(lock.getLockTime());
        response.setExpireTime(lock.getExpireTime());
        response.setConflictReason(lock.getConflictReason());
        response.setSuccess(success);
        response.setMessage(message);
        return response;
    }

    private LockResponse buildQueueResponse(WaitQueueItem item, boolean success, String message) {
        LockResponse response = new LockResponse();
        response.setResourceId(item.getResourceId());
        response.setLockHolder(item.getLockHolder());
        response.setRequestId(item.getRequestId());
        response.setStatus(item.getStatus());
        response.setWaitQueuePosition(item.getQueuePosition());
        response.setSuccess(success);
        response.setMessage(message);
        return response;
    }
}

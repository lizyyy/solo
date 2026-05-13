package com.example.lock.service;

import com.example.lock.dto.LockRequest;
import com.example.lock.dto.LockResponse;
import com.example.lock.dto.ReleaseRequest;
import com.example.lock.entity.ReleaseAudit;
import com.example.lock.entity.ResourceLock;
import com.example.lock.entity.WaitQueueItem;
import com.example.lock.enums.LockStatus;
import com.example.lock.enums.OperationSource;
import com.example.lock.exception.LockException;
import com.example.lock.repository.ReleaseAuditRepository;
import com.example.lock.repository.ResourceLockRepository;
import com.example.lock.repository.WaitQueueItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResourceLockService {

    private final ResourceLockRepository lockRepository;
    private final WaitQueueItemRepository queueRepository;
    private final ReleaseAuditRepository auditRepository;

    @Transactional
    public LockResponse acquireLock(LockRequest request) {
        log.debug("尝试获取锁: resourceId={}, lockHolder={}, requestId={}", 
                request.getResourceId(), request.getLockHolder(), request.getRequestId());

        if (lockRepository.existsByRequestId(request.getRequestId()) || 
            queueRepository.existsByRequestId(request.getRequestId())) {
            return handleIdempotentRequest(request);
        }

        Optional<ResourceLock> existingLock = lockRepository.findByResourceId(request.getResourceId());

        if (!existingLock.isPresent()) {
            return createNewLock(request);
        }

        ResourceLock lock = existingLock.get();

        if (lock.getStatus() == LockStatus.LOCKED) {
            if (lock.getLockHolder().equals(request.getLockHolder())) {
                return extendLock(lock, request);
            }

            if (isLockExpired(lock)) {
                releaseLockInternal(lock, OperationSource.TIMEOUT, "锁超时自动释放");
                return createNewLock(request);
            }

            if (request.isWaitInQueue()) {
                return addToWaitQueue(request);
            }

            return createConflictResponse(lock, request);
        }

        if (lock.getStatus() == LockStatus.AVAILABLE || 
            lock.getStatus() == LockStatus.RELEASED || 
            lock.getStatus() == LockStatus.EXPIRED) {
            return updateExistingLock(lock, request);
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
        log.debug("尝试释放锁: resourceId={}, lockHolder={}", request.getResourceId(), request.getLockHolder());

        Optional<ResourceLock> lockOpt = lockRepository.findByResourceId(request.getResourceId());

        if (!lockOpt.isPresent()) {
            throw new LockException(404, "锁不存在", request.getRequestId());
        }

        ResourceLock lock = lockOpt.get();

        if (!lock.getLockHolder().equals(request.getLockHolder())) {
            throw new LockException(403, "无权释放该锁，锁持有人不匹配", request.getRequestId());
        }

        if (lock.getStatus() != LockStatus.LOCKED) {
            throw new LockException(400, "锁当前不处于锁定状态", request.getRequestId());
        }

        releaseLockInternal(lock, request.getOperationSource(), request.getReleaseReason());
        processNextInQueue(request.getResourceId());

        LockResponse response = buildLockResponse(lock, true, "锁已成功释放");
        response.setStatus(LockStatus.RELEASED);
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

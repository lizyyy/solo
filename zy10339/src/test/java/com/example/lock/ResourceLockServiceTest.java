package com.example.lock;

import com.example.lock.dto.LockRequest;
import com.example.lock.dto.LockResponse;
import com.example.lock.dto.ReleaseRequest;
import com.example.lock.entity.ReleaseAudit;
import com.example.lock.entity.ResourceLock;
import com.example.lock.entity.WaitQueueItem;
import com.example.lock.enums.LockStatus;
import com.example.lock.enums.OperationSource;
import com.example.lock.enums.TimeoutStrategy;
import com.example.lock.repository.ReleaseAuditRepository;
import com.example.lock.repository.ResourceLockRepository;
import com.example.lock.repository.WaitQueueItemRepository;
import com.example.lock.service.ResourceLockService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ResourceLockServiceTest {

    @Autowired
    private ResourceLockService lockService;

    @Autowired
    private ResourceLockRepository lockRepository;

    @Autowired
    private WaitQueueItemRepository queueRepository;

    @Autowired
    private ReleaseAuditRepository auditRepository;

    @BeforeEach
    void setUp() {
        auditRepository.deleteAll();
        queueRepository.deleteAll();
        lockRepository.deleteAll();
    }

    @Test
    void testAcquireLock_Success() {
        LockRequest request = new LockRequest();
        request.setResourceId("res:001");
        request.setLockHolder("user:alice");
        request.setRequestId("req:001");
        request.setOperationSource(OperationSource.API);
        request.setTimeoutStrategy(TimeoutStrategy.AUTO_RELEASE);
        request.setTimeoutSeconds(300);
        request.setWaitInQueue(true);

        LockResponse response = lockService.acquireLock(request);

        assertTrue(response.isSuccess());
        assertEquals(LockStatus.LOCKED, response.getStatus());
        assertEquals("user:alice", response.getLockHolder());
    }

    @Test
    void testAcquireLock_Idempotent() {
        LockRequest request = new LockRequest();
        request.setResourceId("res:002");
        request.setLockHolder("user:alice");
        request.setRequestId("req:002");
        request.setOperationSource(OperationSource.API);
        request.setTimeoutSeconds(300);
        request.setWaitInQueue(true);

        LockResponse first = lockService.acquireLock(request);
        LockResponse second = lockService.acquireLock(request);

        assertTrue(second.isSuccess());
        assertEquals("重复请求，返回已有结果", second.getMessage());
    }

    @Test
    void testAcquireLock_Conflict() {
        LockRequest aliceRequest = new LockRequest();
        aliceRequest.setResourceId("res:003");
        aliceRequest.setLockHolder("user:alice");
        aliceRequest.setRequestId("req:alice");
        aliceRequest.setOperationSource(OperationSource.API);
        aliceRequest.setTimeoutSeconds(300);
        aliceRequest.setWaitInQueue(false);

        lockService.acquireLock(aliceRequest);

        LockRequest bobRequest = new LockRequest();
        bobRequest.setResourceId("res:003");
        bobRequest.setLockHolder("user:bob");
        bobRequest.setRequestId("req:bob");
        bobRequest.setOperationSource(OperationSource.API);
        bobRequest.setTimeoutSeconds(300);
        bobRequest.setWaitInQueue(false);

        LockResponse bobResponse = lockService.acquireLock(bobRequest);

        assertFalse(bobResponse.isSuccess());
        assertNotNull(bobResponse.getConflictReason());
    }

    @Test
    void testAcquireLock_WaitQueue() {
        LockRequest aliceRequest = new LockRequest();
        aliceRequest.setResourceId("res:004");
        aliceRequest.setLockHolder("user:alice");
        aliceRequest.setRequestId("req:alice");
        aliceRequest.setOperationSource(OperationSource.API);
        aliceRequest.setTimeoutSeconds(300);
        aliceRequest.setWaitInQueue(true);
        lockService.acquireLock(aliceRequest);

        LockRequest bobRequest = new LockRequest();
        bobRequest.setResourceId("res:004");
        bobRequest.setLockHolder("user:bob");
        bobRequest.setRequestId("req:bob");
        bobRequest.setOperationSource(OperationSource.API);
        bobRequest.setTimeoutSeconds(300);
        bobRequest.setWaitInQueue(true);

        LockResponse bobResponse = lockService.acquireLock(bobRequest);

        assertTrue(bobResponse.isSuccess());
        assertEquals(LockStatus.WAITING, bobResponse.getStatus());
        assertEquals(Integer.valueOf(1), bobResponse.getWaitQueuePosition());
    }

    @Test
    void testReleaseLock_Success() {
        LockRequest aliceRequest = new LockRequest();
        aliceRequest.setResourceId("res:005");
        aliceRequest.setLockHolder("user:alice");
        aliceRequest.setRequestId("req:alice");
        aliceRequest.setOperationSource(OperationSource.API);
        aliceRequest.setTimeoutSeconds(300);
        aliceRequest.setWaitInQueue(true);
        lockService.acquireLock(aliceRequest);

        ReleaseRequest releaseRequest = new ReleaseRequest();
        releaseRequest.setResourceId("res:005");
        releaseRequest.setLockHolder("user:alice");
        releaseRequest.setRequestId("req:release");
        releaseRequest.setOperationSource(OperationSource.API);
        releaseRequest.setReleaseReason("测试完成");

        LockResponse releaseResponse = lockService.releaseLock(releaseRequest);

        assertTrue(releaseResponse.isSuccess());
        assertEquals(LockStatus.RELEASED, releaseResponse.getStatus());

        List<ReleaseAudit> history = lockService.getReleaseHistory("res:005");
        assertEquals(1, history.size());
        assertEquals("测试完成", history.get(0).getReleaseReason());
    }

    @Test
    void testReleaseLock_ProcessQueue() {
        LockRequest aliceRequest = new LockRequest();
        aliceRequest.setResourceId("res:006");
        aliceRequest.setLockHolder("user:alice");
        aliceRequest.setRequestId("req:alice");
        aliceRequest.setOperationSource(OperationSource.API);
        aliceRequest.setTimeoutSeconds(300);
        aliceRequest.setWaitInQueue(true);
        lockService.acquireLock(aliceRequest);

        LockRequest bobRequest = new LockRequest();
        bobRequest.setResourceId("res:006");
        bobRequest.setLockHolder("user:bob");
        bobRequest.setRequestId("req:bob");
        bobRequest.setOperationSource(OperationSource.API);
        bobRequest.setTimeoutSeconds(300);
        bobRequest.setWaitInQueue(true);
        lockService.acquireLock(bobRequest);

        ReleaseRequest releaseRequest = new ReleaseRequest();
        releaseRequest.setResourceId("res:006");
        releaseRequest.setLockHolder("user:alice");
        releaseRequest.setRequestId("req:release");
        releaseRequest.setOperationSource(OperationSource.API);
        lockService.releaseLock(releaseRequest);

        Optional<ResourceLock> lock = lockService.getLockByResourceId("res:006");
        assertTrue(lock.isPresent());
        assertEquals("user:bob", lock.get().getLockHolder());
        assertEquals(LockStatus.LOCKED, lock.get().getStatus());
    }

    @Test
    void testLockExpiration() {
        LockRequest request = new LockRequest();
        request.setResourceId("res:007");
        request.setLockHolder("user:alice");
        request.setRequestId("req:007");
        request.setOperationSource(OperationSource.API);
        request.setTimeoutSeconds(1);
        request.setWaitInQueue(true);
        lockService.acquireLock(request);

        try {
            Thread.sleep(1500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        lockService.processExpiredLocks();

        Optional<ResourceLock> lock = lockService.getLockByResourceId("res:007");
        assertTrue(lock.isPresent());
        assertEquals(LockStatus.RELEASED, lock.get().getStatus());

        List<ReleaseAudit> history = lockService.getReleaseHistory("res:007");
        assertEquals(1, history.size());
        assertEquals(OperationSource.TIMEOUT, history.get(0).getReleaseSource());
    }

    @Test
    void testRelease_Idempotent() {
        LockRequest lockRequest = new LockRequest();
        lockRequest.setResourceId("res:008");
        lockRequest.setLockHolder("user:alice");
        lockRequest.setRequestId("req:lock:008");
        lockRequest.setOperationSource(OperationSource.API);
        lockRequest.setTimeoutSeconds(300);
        lockRequest.setWaitInQueue(true);
        lockService.acquireLock(lockRequest);

        ReleaseRequest releaseRequest = new ReleaseRequest();
        releaseRequest.setResourceId("res:008");
        releaseRequest.setLockHolder("user:alice");
        releaseRequest.setRequestId("req:release:008");
        releaseRequest.setOperationSource(OperationSource.API);

        LockResponse first = lockService.releaseLock(releaseRequest);
        LockResponse second = lockService.releaseLock(releaseRequest);

        assertTrue(first.isSuccess());
        assertTrue(second.isSuccess());
        assertEquals("重复请求，返回已有释放结果", second.getMessage());
    }

    @Test
    void testRelease_Idempotent_NonExistingLock() {
        ReleaseRequest releaseRequest = new ReleaseRequest();
        releaseRequest.setResourceId("res:009");
        releaseRequest.setLockHolder("user:alice");
        releaseRequest.setRequestId("req:release:009");
        releaseRequest.setOperationSource(OperationSource.API);

        LockResponse first = lockService.releaseLock(releaseRequest);
        LockResponse second = lockService.releaseLock(releaseRequest);

        assertFalse(first.isSuccess());
        assertFalse(second.isSuccess());
        assertEquals("锁不存在，无需重复释放", first.getMessage());
        assertEquals("重复请求，返回已有释放结果", second.getMessage());
    }

    @Test
    void testExportLockStatus() {
        LockRequest request = new LockRequest();
        request.setResourceId("res:010");
        request.setLockHolder("user:alice");
        request.setRequestId("req:010");
        request.setOperationSource(OperationSource.API);
        request.setTimeoutSeconds(300);
        request.setWaitInQueue(true);
        lockService.acquireLock(request);

        Map<String, Object> export = lockService.exportLockStatus("res:010");

        assertNotNull(export);
        assertTrue(export.containsKey("lockStatus"));
        assertTrue(export.containsKey("waitQueue"));
        assertTrue(export.containsKey("releaseHistory"));
        assertTrue(export.containsKey("waitQueueCount"));
        assertTrue(export.containsKey("releaseHistoryCount"));
        assertTrue(export.containsKey("exportTime"));
        assertEquals("res:010", export.get("resourceId"));
    }

    @Test
    void testExportAllLocks() {
        LockRequest request1 = new LockRequest();
        request1.setResourceId("res:011");
        request1.setLockHolder("user:alice");
        request1.setRequestId("req:011");
        request1.setOperationSource(OperationSource.API);
        request1.setTimeoutSeconds(300);
        request1.setWaitInQueue(true);
        lockService.acquireLock(request1);

        LockRequest request2 = new LockRequest();
        request2.setResourceId("res:012");
        request2.setLockHolder("user:bob");
        request2.setRequestId("req:012");
        request2.setOperationSource(OperationSource.API);
        request2.setTimeoutSeconds(300);
        request2.setWaitInQueue(true);
        lockService.acquireLock(request2);

        Map<String, Object> export = lockService.exportAllLocks();

        assertNotNull(export);
        assertTrue(export.containsKey("locks"));
        assertTrue(export.containsKey("totalLocks"));
        assertTrue(export.containsKey("lockedCount"));
        assertTrue(export.containsKey("releasedCount"));
        assertTrue(export.containsKey("exportTime"));

        List<?> locks = (List<?>) export.get("locks");
        assertTrue(locks.size() >= 2);
    }
}

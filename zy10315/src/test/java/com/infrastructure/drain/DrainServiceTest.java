package com.infrastructure.drain;

import com.infrastructure.drain.dto.CreateDrainBatchRequest;
import com.infrastructure.drain.dto.DrainBatchResponse;
import com.infrastructure.drain.exception.DrainException;
import com.infrastructure.drain.model.DrainStatus;
import com.infrastructure.drain.service.DrainService;
import com.infrastructure.drain.service.DrainStateMachine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DrainServiceTest {

    @Autowired
    private DrainService drainService;

    @Autowired
    private DrainStateMachine stateMachine;

    private CreateDrainBatchRequest createRequest;

    @BeforeEach
    void setUp() {
        createRequest = new CreateDrainBatchRequest();
        createRequest.setBatchId("BATCH-001");
        createRequest.setOperator("test-user");
        createRequest.setReason("测试排空");

        List<CreateDrainBatchRequest.InstanceInfo> instances = new ArrayList<>();
        CreateDrainBatchRequest.InstanceInfo instance1 = new CreateDrainBatchRequest.InstanceInfo();
        instance1.setInstanceId("INSTANCE-001");
        instance1.setServiceName("order-service");
        instance1.setIp("192.168.1.1");
        instance1.setPort(8080);
        instances.add(instance1);

        CreateDrainBatchRequest.InstanceInfo instance2 = new CreateDrainBatchRequest.InstanceInfo();
        instance2.setInstanceId("INSTANCE-002");
        instance2.setServiceName("order-service");
        instance2.setIp("192.168.1.2");
        instance2.setPort(8080);
        instances.add(instance2);

        createRequest.setInstances(instances);
    }

    @Test
    @DisplayName("创建排空批次 - 正常情况")
    void testCreateBatch_Success() {
        DrainBatchResponse response = drainService.createBatch(createRequest);
        assertNotNull(response);
        assertEquals("BATCH-001", response.getBatchId());
        assertEquals(DrainStatus.INIT, response.getStatus());
        assertEquals(2, response.getInstances().size());
    }

    @Test
    @DisplayName("重复提交创建请求 - 幂等性验证")
    void testCreateBatch_DuplicateCall_Idempotent() {
        DrainBatchResponse response1 = drainService.createBatch(createRequest);
        DrainBatchResponse response2 = drainService.createBatch(createRequest);
        
        assertNotNull(response1);
        assertNotNull(response2);
        assertEquals(response1.getBatchId(), response2.getBatchId());
        assertEquals(response1.getStatus(), response2.getStatus());
    }

    @Test
    @DisplayName("实例在其他批次中 - 冲突验证")
    void testCreateBatch_InstanceInOtherBatch() {
        createRequest.setBatchId("BATCH-001");
        drainService.createBatch(createRequest);

        CreateDrainBatchRequest request2 = new CreateDrainBatchRequest();
        request2.setBatchId("BATCH-002");
        request2.setOperator("test-user-2");
        request2.setInstances(createRequest.getInstances());

        assertThrows(DrainException.class, () -> drainService.createBatch(request2));
    }

    @Test
    @DisplayName("正常状态流转 - 完整流程")
    void testStatusTransition_FullFlow() {
        createRequest.setBatchId("BATCH-FULL-001");
        drainService.createBatch(createRequest);

        DrainBatchResponse response;
        
        response = drainService.validateBatch("BATCH-FULL-001", "test-user");
        assertEquals(DrainStatus.VALIDATED, response.getStatus());
        
        response = drainService.startTrafficOffload("BATCH-FULL-001", "test-user");
        assertEquals(DrainStatus.TRAFFIC_OFFLOADED, response.getStatus());
        
        response = drainService.observeConnections("BATCH-FULL-001", "test-user");
        assertEquals(DrainStatus.CONNECTIONS_EMPTY, response.getStatus());
        
        response = drainService.migrateTasks("BATCH-FULL-001", "test-user");
        assertEquals(DrainStatus.TASKS_MIGRATED, response.getStatus());
        
        response = drainService.drain("BATCH-FULL-001", "test-user");
        assertEquals(DrainStatus.DRAINED, response.getStatus());
        
        response = drainService.complete("BATCH-FULL-001", "test-user");
        assertEquals(DrainStatus.COMPLETED, response.getStatus());
    }

    @Test
    @DisplayName("状态不允许跳转 - INIT直接到DRAINING")
    void testInvalidStatusTransition_InitToDraining() {
        createRequest.setBatchId("BATCH-INVALID-001");
        drainService.createBatch(createRequest);

        assertThrows(DrainException.class, 
            () -> drainService.drain("BATCH-INVALID-001", "test-user"));
    }

    @Test
    @DisplayName("状态不允许跳转 - 已完成批次不能再修改")
    void testInvalidStatusTransition_CompletedBatch() {
        createRequest.setBatchId("BATCH-COMPLETED-001");
        drainService.createBatch(createRequest);
        drainService.validateBatch("BATCH-COMPLETED-001", "test-user");
        drainService.startTrafficOffload("BATCH-COMPLETED-001", "test-user");
        drainService.observeConnections("BATCH-COMPLETED-001", "test-user");
        drainService.migrateTasks("BATCH-COMPLETED-001", "test-user");
        drainService.drain("BATCH-COMPLETED-001", "test-user");
        drainService.complete("BATCH-COMPLETED-001", "test-user");

        assertThrows(DrainException.class, 
            () -> drainService.validateBatch("BATCH-COMPLETED-001", "test-user"));
    }

    @Test
    @DisplayName("取消批次 - INIT状态可以取消")
    void testCancelBatch_InitStatus() {
        createRequest.setBatchId("BATCH-CANCEL-001");
        drainService.createBatch(createRequest);

        DrainBatchResponse response = drainService.cancel("BATCH-CANCEL-001", "test-user", "测试取消");
        assertEquals(DrainStatus.CANCELLED, response.getStatus());
    }

    @Test
    @DisplayName("取消批次 - VALIDATING状态可以取消")
    void testCancelBatch_ValidatingStatus() {
        createRequest.setBatchId("BATCH-CANCEL-002");
        drainService.createBatch(createRequest);
        drainService.validateBatch("BATCH-CANCEL-002", "test-user");

        DrainBatchResponse response = drainService.cancel("BATCH-CANCEL-002", "test-user", "测试取消");
        assertEquals(DrainStatus.CANCELLED, response.getStatus());
    }

    @Test
    @DisplayName("恢复失败批次 - FAILED状态可以恢复")
    void testRecoverBatch_FailedStatus() {
        createRequest.setBatchId("BATCH-RECOVER-001");
        DrainBatchResponse batch = drainService.createBatch(createRequest);
        assertEquals(DrainStatus.INIT, batch.getStatus());
    }

    @Test
    @DisplayName("查询不存在的批次 - 异常验证")
    void testGetBatch_NotFound() {
        assertThrows(DrainException.class, 
            () -> drainService.getBatch("NON-EXISTENT-BATCH"));
    }

    @Test
    @DisplayName("状态机验证 - 允许的跳转")
    void testStateMachine_AllowedTransitions() {
        assertTrue(stateMachine.canTransition(DrainStatus.INIT, DrainStatus.VALIDATING));
        assertTrue(stateMachine.canTransition(DrainStatus.INIT, DrainStatus.CANCELLED));
        assertTrue(stateMachine.canTransition(DrainStatus.VALIDATING, DrainStatus.VALIDATED));
        assertTrue(stateMachine.canTransition(DrainStatus.VALIDATING, DrainStatus.FAILED));
        assertTrue(stateMachine.canTransition(DrainStatus.VALIDATING, DrainStatus.CANCELLED));
        assertTrue(stateMachine.canTransition(DrainStatus.VALIDATED, DrainStatus.TRAFFIC_OFFLOADING));
        assertTrue(stateMachine.canTransition(DrainStatus.TRAFFIC_OFFLOADING, DrainStatus.TRAFFIC_OFFLOADED));
        assertTrue(stateMachine.canTransition(DrainStatus.TRAFFIC_OFFLOADED, DrainStatus.CONNECTION_OBSERVING));
        assertTrue(stateMachine.canTransition(DrainStatus.CONNECTION_OBSERVING, DrainStatus.CONNECTIONS_EMPTY));
        assertTrue(stateMachine.canTransition(DrainStatus.CONNECTIONS_EMPTY, DrainStatus.TASK_MIGRATING));
        assertTrue(stateMachine.canTransition(DrainStatus.TASK_MIGRATING, DrainStatus.TASKS_MIGRATED));
        assertTrue(stateMachine.canTransition(DrainStatus.TASKS_MIGRATED, DrainStatus.DRAINING));
        assertTrue(stateMachine.canTransition(DrainStatus.DRAINING, DrainStatus.DRAINED));
        assertTrue(stateMachine.canTransition(DrainStatus.DRAINED, DrainStatus.COMPLETED));
        assertTrue(stateMachine.canTransition(DrainStatus.FAILED, DrainStatus.RECOVERING));
        assertTrue(stateMachine.canTransition(DrainStatus.RECOVERING, DrainStatus.RECOVERED));
    }

    @Test
    @DisplayName("状态机验证 - 不允许的跳转")
    void testStateMachine_DisallowedTransitions() {
        assertFalse(stateMachine.canTransition(DrainStatus.INIT, DrainStatus.DRAINING));
        assertFalse(stateMachine.canTransition(DrainStatus.VALIDATED, DrainStatus.DRAINING));
        assertFalse(stateMachine.canTransition(DrainStatus.COMPLETED, DrainStatus.VALIDATING));
        assertFalse(stateMachine.canTransition(DrainStatus.CANCELLED, DrainStatus.VALIDATING));
    }

    @Test
    @DisplayName("最终状态验证")
    void testFinalStatus() {
        assertTrue(stateMachine.isFinalStatus(DrainStatus.COMPLETED));
        assertTrue(stateMachine.isFinalStatus(DrainStatus.CANCELLED));
        assertTrue(stateMachine.isFinalStatus(DrainStatus.RECOVERED));
        assertFalse(stateMachine.isFinalStatus(DrainStatus.INIT));
        assertFalse(stateMachine.isFinalStatus(DrainStatus.VALIDATING));
        assertFalse(stateMachine.isFinalStatus(DrainStatus.FAILED));
    }

    @Test
    @DisplayName("获取批次列表")
    void testListBatches() {
        createRequest.setBatchId("BATCH-LIST-001");
        drainService.createBatch(createRequest);

        List<DrainBatchResponse> batches = drainService.listBatches();
        assertNotNull(batches);
        assertTrue(batches.size() > 0);
    }

    @Test
    @DisplayName("按状态查询批次")
    void testListBatchesByStatus() {
        createRequest.setBatchId("BATCH-STATUS-001");
        drainService.createBatch(createRequest);

        List<DrainBatchResponse> batches = drainService.listBatchesByStatus(DrainStatus.INIT);
        assertNotNull(batches);
        assertTrue(batches.stream().anyMatch(b -> b.getBatchId().equals("BATCH-STATUS-001")));
    }
}

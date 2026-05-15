package com.virusscan;

import com.virusscan.dto.CreateScanTaskRequest;
import com.virusscan.dto.TaskStatusUpdateRequest;
import com.virusscan.entity.ScanTask;
import com.virusscan.enums.TaskStatus;
import com.virusscan.exception.BusinessException;
import com.virusscan.service.ScanTaskService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class ScanTaskServiceTest {

    @Autowired
    private ScanTaskService scanTaskService;

    private CreateScanTaskRequest createTestRequest(String fileId) {
        CreateScanTaskRequest request = new CreateScanTaskRequest();
        request.setFileId(fileId);
        request.setFileName("test-file.txt");
        request.setFileSize(1024L);
        request.setFileHash("abc123def456");
        request.setContentType("text/plain");
        request.setUploadedBy("test-user");
        request.setSourceSystem("test-system");
        request.setMaxRetry(3);
        return request;
    }

    @Test
    @DisplayName("测试创建扫描任务")
    void testCreateScanTask() {
        CreateScanTaskRequest request = createTestRequest("FILE-001");

        ScanTask task = scanTaskService.createScanTask(request);

        assertNotNull(task);
        assertNotNull(task.getTaskId());
        assertEquals("FILE-001", task.getFileId());
        assertEquals(TaskStatus.PENDING, task.getStatus());
        assertEquals(0, task.getRetryCount());
        assertEquals(3, task.getMaxRetry());
    }

    @Test
    @DisplayName("测试重复提交防脏数据 - 相同 requestId 返回已有任务")
    void testDuplicateRequestWithSameRequestId() {
        CreateScanTaskRequest request = createTestRequest("FILE-002");
        request.setRequestId("REQ-UNIQUE-001");

        ScanTask task1 = scanTaskService.createScanTask(request);
        ScanTask task2 = scanTaskService.createScanTask(request);

        assertNotNull(task1);
        assertNotNull(task2);
        assertEquals(task1.getTaskId(), task2.getTaskId());
    }

    @Test
    @DisplayName("测试重复提交防脏数据 - 同一文件不能有多个活跃任务")
    void testDuplicateActiveTaskForSameFile() {
        CreateScanTaskRequest request1 = createTestRequest("FILE-003");
        CreateScanTaskRequest request2 = createTestRequest("FILE-003");

        scanTaskService.createScanTask(request1);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> scanTaskService.createScanTask(request2));

        assertEquals(409, exception.getCode());
        assertTrue(exception.getMessage().contains("该文件已有正在处理的扫描任务"));
    }

    @Test
    @DisplayName("测试状态流转 - PENDING -> SCANNING -> CLEAN")
    void testStatusTransitionPendingToClean() {
        CreateScanTaskRequest request = createTestRequest("FILE-004");
        ScanTask task = scanTaskService.createScanTask(request);
        String taskId = task.getTaskId();

        TaskStatusUpdateRequest toScanning = new TaskStatusUpdateRequest();
        toScanning.setTargetStatus(TaskStatus.SCANNING);
        task = scanTaskService.updateTaskStatus(taskId, toScanning);
        assertEquals(TaskStatus.SCANNING, task.getStatus());
        assertNotNull(task.getStartTime());

        TaskStatusUpdateRequest toClean = new TaskStatusUpdateRequest();
        toClean.setTargetStatus(TaskStatus.CLEAN);
        toClean.setScanResult("No virus found");
        task = scanTaskService.updateTaskStatus(taskId, toClean);
        assertEquals(TaskStatus.CLEAN, task.getStatus());
        assertNotNull(task.getEndTime());
    }

    @Test
    @DisplayName("测试状态流转 - PENDING -> SCANNING -> INFECTED -> QUARANTINED")
    void testStatusTransitionPendingToQuarantined() {
        CreateScanTaskRequest request = createTestRequest("FILE-005");
        ScanTask task = scanTaskService.createScanTask(request);
        String taskId = task.getTaskId();

        TaskStatusUpdateRequest toScanning = new TaskStatusUpdateRequest();
        toScanning.setTargetStatus(TaskStatus.SCANNING);
        scanTaskService.updateTaskStatus(taskId, toScanning);

        TaskStatusUpdateRequest toInfected = new TaskStatusUpdateRequest();
        toInfected.setTargetStatus(TaskStatus.INFECTED);
        toInfected.setVirusDetails("EICAR test virus detected");
        task = scanTaskService.updateTaskStatus(taskId, toInfected);
        assertEquals(TaskStatus.INFECTED, task.getStatus());

        TaskStatusUpdateRequest toQuarantined = new TaskStatusUpdateRequest();
        toQuarantined.setTargetStatus(TaskStatus.QUARANTINED);
        toQuarantined.setOperator("admin");
        task = scanTaskService.updateTaskStatus(taskId, toQuarantined);
        assertEquals(TaskStatus.QUARANTINED, task.getStatus());
    }

    @Test
    @DisplayName("测试非法状态转换 - CLEAN 不能转回 SCANNING")
    void testInvalidStatusTransition() {
        CreateScanTaskRequest request = createTestRequest("FILE-006");
        ScanTask task = scanTaskService.createScanTask(request);
        String taskId = task.getTaskId();

        TaskStatusUpdateRequest toScanning = new TaskStatusUpdateRequest();
        toScanning.setTargetStatus(TaskStatus.SCANNING);
        scanTaskService.updateTaskStatus(taskId, toScanning);

        TaskStatusUpdateRequest toClean = new TaskStatusUpdateRequest();
        toClean.setTargetStatus(TaskStatus.CLEAN);
        scanTaskService.updateTaskStatus(taskId, toClean);

        TaskStatusUpdateRequest invalidRequest = new TaskStatusUpdateRequest();
        invalidRequest.setTargetStatus(TaskStatus.SCANNING);

        IllegalStateException exception = assertThrows(IllegalStateException.class,
                () -> scanTaskService.updateTaskStatus(taskId, invalidRequest));

        assertTrue(exception.getMessage().contains("不允许的状态转换"));
    }

    @Test
    @DisplayName("测试失败重试机制")
    void testFailureRetryMechanism() {
        CreateScanTaskRequest request = createTestRequest("FILE-007");
        request.setMaxRetry(2);
        ScanTask task = scanTaskService.createScanTask(request);
        String taskId = task.getTaskId();

        TaskStatusUpdateRequest toScanning = new TaskStatusUpdateRequest();
        toScanning.setTargetStatus(TaskStatus.SCANNING);
        scanTaskService.updateTaskStatus(taskId, toScanning);

        TaskStatusUpdateRequest toFailed = new TaskStatusUpdateRequest();
        toFailed.setTargetStatus(TaskStatus.FAILED);
        toFailed.setErrorCode("SCAN_TIMEOUT");
        toFailed.setErrorMessage("扫描超时");

        task = scanTaskService.updateTaskStatus(taskId, toFailed);
        assertEquals(TaskStatus.PENDING, task.getStatus());
        assertEquals(1, task.getRetryCount());

        task = scanTaskService.updateTaskStatus(taskId, toScanning);
        task = scanTaskService.updateTaskStatus(taskId, toFailed);
        assertEquals(TaskStatus.PENDING, task.getStatus());
        assertEquals(2, task.getRetryCount());

        task = scanTaskService.updateTaskStatus(taskId, toScanning);
        task = scanTaskService.updateTaskStatus(taskId, toFailed);
        assertEquals(TaskStatus.FAILED, task.getStatus());
        assertEquals(2, task.getRetryCount());
    }

    @Test
    @DisplayName("测试脏数据 - 查询不存在的任务")
    void testQueryNonExistentTask() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> scanTaskService.getTaskByTaskId("NON-EXISTENT-TASK"));

        assertEquals(404, exception.getCode());
        assertTrue(exception.getMessage().contains("任务不存在"));
    }

    @Test
    @DisplayName("测试统计查询")
    void testGetStatistics() {
        CreateScanTaskRequest request = createTestRequest("FILE-008");
        scanTaskService.createScanTask(request);

        var stats = scanTaskService.getTaskStatistics();

        assertNotNull(stats);
        assertTrue(stats.containsKey("statusDistribution"));
        assertTrue(stats.containsKey("totalTasks"));
        assertTrue((Long) stats.get("totalTasks") > 0);
    }
}
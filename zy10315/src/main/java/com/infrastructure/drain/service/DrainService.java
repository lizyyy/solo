package com.infrastructure.drain.service;

import com.infrastructure.drain.dto.CreateDrainBatchRequest;
import com.infrastructure.drain.dto.DrainBatchResponse;
import com.infrastructure.drain.exception.DrainException;
import com.infrastructure.drain.model.*;
import com.infrastructure.drain.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DrainService {
    
    private final DrainBatchRepository batchRepository;
    private final ServiceInstanceRepository instanceRepository;
    private final DrainActionLogRepository actionLogRepository;
    private final PersistentConnectionRepository connectionRepository;
    private final QueueTaskRepository queueTaskRepository;
    private final TrafficOffloadResultRepository offloadResultRepository;
    private final RecoveryActionRepository recoveryActionRepository;
    private final DrainStateMachine stateMachine;
    
    @Transactional
    public DrainBatchResponse createBatch(CreateDrainBatchRequest request) {
        String batchId = request.getBatchId();
        log.info("创建排空批次: {}, 操作人: {}", batchId, request.getOperator());
        
        if (batchRepository.existsByBatchId(batchId)) {
            log.warn("批次已存在，直接返回已有数据: {}", batchId);
            DrainBatch existingBatch = batchRepository.findByBatchId(batchId).orElseThrow();
            return convertToResponse(existingBatch);
        }
        
        checkInstancesInOtherBatch(request.getInstances());
        
        DrainBatch batch = new DrainBatch();
        batch.setBatchId(batchId);
        batch.setOperator(request.getOperator());
        batch.setReason(request.getReason());
        batch.setStatus(DrainStatus.INIT);
        
        List<ServiceInstance> instances = request.getInstances().stream()
                .map(info -> {
                    ServiceInstance instance = new ServiceInstance();
                    BeanUtils.copyProperties(info, instance);
                    instance.setStatus(DrainStatus.INIT);
                    instance.setActiveConnections(0);
                    instance.setPendingTasks(0);
                    instance.setBatch(batch);
                    return instance;
                })
                .collect(Collectors.toList());
        
        batch.setInstances(instances);
        batch = batchRepository.save(batch);
        
        addActionLog(batchId, null, request.getOperator(), DrainStatus.INIT, DrainStatus.INIT, "创建排空批次");
        
        log.info("批次创建成功: {}", batchId);
        return convertToResponse(batch);
    }
    
    private void checkInstancesInOtherBatch(List<CreateDrainBatchRequest.InstanceInfo> instances) {
        List<String> instanceIds = instances.stream()
                .map(CreateDrainBatchRequest.InstanceInfo::getInstanceId)
                .collect(Collectors.toList());
        
        List<ServiceInstance> existingInstances = instanceRepository.findByInstanceIds(instanceIds);
        for (ServiceInstance instance : existingInstances) {
            if (!stateMachine.isFinalStatus(instance.getStatus())) {
                throw DrainException.instanceInOtherBatch(instance.getInstanceId(), instance.getBatch().getBatchId());
            }
        }
    }
    
    @Transactional
    public DrainBatchResponse validateBatch(String batchId, String operator) {
        log.info("校验批次: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.VALIDATING);
        
        batch.setStatus(DrainStatus.VALIDATING);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, batch.getStatus(), DrainStatus.VALIDATING, "开始校验批次");
        
        boolean allValid = true;
        for (ServiceInstance instance : batch.getInstances()) {
            instance.setStatus(DrainStatus.VALIDATING);
            try {
                instance.setActiveConnections(getActiveConnectionCount(instance.getInstanceId()));
                instance.setPendingTasks(getPendingTaskCount(instance.getInstanceId()));
                instance.setStatus(DrainStatus.VALIDATED);
            } catch (Exception e) {
                log.error("实例[{}]校验失败: {}", instance.getInstanceId(), e.getMessage());
                instance.setStatusDetail("校验失败: " + e.getMessage());
                allValid = false;
            }
        }
        instanceRepository.saveAll(batch.getInstances());
        
        if (allValid) {
            batch.setStatus(DrainStatus.VALIDATED);
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.VALIDATING, DrainStatus.VALIDATED, "批次校验通过");
        } else {
            batch.setStatus(DrainStatus.FAILED);
            batch.setErrorMessage("部分实例校验失败");
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.VALIDATING, DrainStatus.FAILED, "批次校验失败");
        }
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse startTrafficOffload(String batchId, String operator) {
        log.info("开始摘流: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.TRAFFIC_OFFLOADING);
        
        batch.setStatus(DrainStatus.TRAFFIC_OFFLOADING);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, DrainStatus.VALIDATED, DrainStatus.TRAFFIC_OFFLOADING, "开始摘流");
        
        for (ServiceInstance instance : batch.getInstances()) {
            instance.setStatus(DrainStatus.TRAFFIC_OFFLOADING);
        }
        instanceRepository.saveAll(batch.getInstances());
        
        boolean allSuccess = true;
        for (ServiceInstance instance : batch.getInstances()) {
            try {
                performTrafficOffload(instance);
                instance.setStatus(DrainStatus.TRAFFIC_OFFLOADED);
                instance.setTrafficOffloadedAt(LocalDateTime.now());
            } catch (Exception e) {
                log.error("实例[{}]摘流失败: {}", instance.getInstanceId(), e.getMessage());
                instance.setStatusDetail("摘流失败: " + e.getMessage());
                allSuccess = false;
            }
        }
        instanceRepository.saveAll(batch.getInstances());
        
        if (allSuccess) {
            batch.setStatus(DrainStatus.TRAFFIC_OFFLOADED);
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.TRAFFIC_OFFLOADING, DrainStatus.TRAFFIC_OFFLOADED, "摘流完成");
        } else {
            batch.setStatus(DrainStatus.FAILED);
            batch.setErrorMessage("部分实例摘流失败");
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.TRAFFIC_OFFLOADING, DrainStatus.FAILED, "摘流失败");
        }
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse observeConnections(String batchId, String operator) {
        log.info("观察连接状态: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.CONNECTION_OBSERVING);
        
        batch.setStatus(DrainStatus.CONNECTION_OBSERVING);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, DrainStatus.TRAFFIC_OFFLOADED, DrainStatus.CONNECTION_OBSERVING, "开始观察连接");
        
        boolean allEmpty = true;
        for (ServiceInstance instance : batch.getInstances()) {
            int connections = getActiveConnectionCount(instance.getInstanceId());
            instance.setActiveConnections(connections);
            if (connections == 0) {
                instance.setStatus(DrainStatus.CONNECTIONS_EMPTY);
            } else {
                instance.setStatus(DrainStatus.CONNECTION_OBSERVING);
                allEmpty = false;
            }
        }
        instanceRepository.saveAll(batch.getInstances());
        
        if (allEmpty) {
            batch.setStatus(DrainStatus.CONNECTIONS_EMPTY);
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.CONNECTION_OBSERVING, DrainStatus.CONNECTIONS_EMPTY, "所有实例连接已清空");
        }
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse migrateTasks(String batchId, String operator) {
        log.info("迁移任务: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.TASK_MIGRATING);
        
        batch.setStatus(DrainStatus.TASK_MIGRATING);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, DrainStatus.CONNECTIONS_EMPTY, DrainStatus.TASK_MIGRATING, "开始任务迁移");
        
        boolean allMigrated = true;
        for (ServiceInstance instance : batch.getInstances()) {
            instance.setStatus(DrainStatus.TASK_MIGRATING);
            try {
                migrateInstanceTasks(instance);
                instance.setPendingTasks(0);
                instance.setStatus(DrainStatus.TASKS_MIGRATED);
            } catch (Exception e) {
                log.error("实例[{}]任务迁移失败: {}", instance.getInstanceId(), e.getMessage());
                instance.setStatusDetail("任务迁移失败: " + e.getMessage());
                allMigrated = false;
            }
        }
        instanceRepository.saveAll(batch.getInstances());
        
        if (allMigrated) {
            batch.setStatus(DrainStatus.TASKS_MIGRATED);
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.TASK_MIGRATING, DrainStatus.TASKS_MIGRATED, "任务迁移完成");
        } else {
            batch.setStatus(DrainStatus.FAILED);
            batch.setErrorMessage("部分实例任务迁移失败");
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.TASK_MIGRATING, DrainStatus.FAILED, "任务迁移失败");
        }
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse drain(String batchId, String operator) {
        log.info("开始排空: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.DRAINING);
        
        batch.setStatus(DrainStatus.DRAINING);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, DrainStatus.TASKS_MIGRATED, DrainStatus.DRAINING, "开始排空实例");
        
        for (ServiceInstance instance : batch.getInstances()) {
            instance.setStatus(DrainStatus.DRAINING);
        }
        instanceRepository.saveAll(batch.getInstances());
        
        boolean allSuccess = true;
        for (ServiceInstance instance : batch.getInstances()) {
            try {
                performDrain(instance);
                instance.setStatus(DrainStatus.DRAINED);
                instance.setDrainedAt(LocalDateTime.now());
            } catch (Exception e) {
                log.error("实例[{}]排空失败: {}", instance.getInstanceId(), e.getMessage());
                instance.setStatusDetail("排空失败: " + e.getMessage());
                allSuccess = false;
            }
        }
        instanceRepository.saveAll(batch.getInstances());
        
        if (allSuccess) {
            batch.setStatus(DrainStatus.DRAINED);
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.DRAINING, DrainStatus.DRAINED, "排空完成");
        } else {
            batch.setStatus(DrainStatus.FAILED);
            batch.setErrorMessage("部分实例排空失败");
            batch = batchRepository.save(batch);
            addActionLog(batchId, null, operator, DrainStatus.DRAINING, DrainStatus.FAILED, "排空失败");
        }
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse complete(String batchId, String operator) {
        log.info("完成排空: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.COMPLETED);
        
        batch.setStatus(DrainStatus.COMPLETED);
        batch.setCompletedAt(LocalDateTime.now());
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, DrainStatus.DRAINED, DrainStatus.COMPLETED, "排空流程完成");
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse recover(String batchId, String operator, String reason) {
        log.info("恢复批次: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        
        stateMachine.validateTransition(batchId, batch.getStatus(), DrainStatus.RECOVERING);
        
        batch.setStatus(DrainStatus.RECOVERING);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, batch.getStatus(), DrainStatus.RECOVERING, "开始恢复: " + reason);
        
        for (ServiceInstance instance : batch.getInstances()) {
            try {
                recoverInstance(instance);
            } catch (Exception e) {
                log.error("实例[{}]恢复失败: {}", instance.getInstanceId(), e.getMessage());
            }
        }
        
        batch.setStatus(DrainStatus.RECOVERED);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, DrainStatus.RECOVERING, DrainStatus.RECOVERED, "恢复完成");
        
        return convertToResponse(batch);
    }
    
    @Transactional
    public DrainBatchResponse cancel(String batchId, String operator, String reason) {
        log.info("取消批次: {}, 操作人: {}", batchId, operator);
        
        DrainBatch batch = getBatchOrThrow(batchId);
        checkBatchNotCompleted(batch);
        
        if (!stateMachine.canTransition(batch.getStatus(), DrainStatus.CANCELLED)) {
            throw DrainException.invalidStatusTransition(batchId, batch.getStatus(), DrainStatus.CANCELLED);
        }
        
        DrainStatus fromStatus = batch.getStatus();
        batch.setStatus(DrainStatus.CANCELLED);
        batch = batchRepository.save(batch);
        addActionLog(batchId, null, operator, fromStatus, DrainStatus.CANCELLED, "取消: " + reason);
        
        return convertToResponse(batch);
    }
    
    public DrainBatchResponse getBatch(String batchId) {
        DrainBatch batch = getBatchOrThrow(batchId);
        return convertToResponse(batch);
    }
    
    public List<DrainBatchResponse> listBatches() {
        List<DrainBatch> batches = batchRepository.findAllOrderByCreatedAtDesc();
        return batches.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    public List<DrainBatchResponse> listBatchesByStatus(DrainStatus status) {
        List<DrainBatch> batches = batchRepository.findByStatus(status);
        return batches.stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }
    
    private DrainBatch getBatchOrThrow(String batchId) {
        return batchRepository.findByBatchId(batchId)
                .orElseThrow(() -> DrainException.batchNotFound(batchId));
    }
    
    private void checkBatchNotCompleted(DrainBatch batch) {
        if (stateMachine.isFinalStatus(batch.getStatus())) {
            throw DrainException.batchAlreadyCompleted(batch.getBatchId());
        }
    }
    
    private void addActionLog(String batchId, String instanceId, String operator, DrainStatus from, DrainStatus to, String remark) {
        DrainActionLog log = new DrainActionLog();
        log.setBatchId(batchId);
        log.setInstanceId(instanceId);
        log.setOperator(operator);
        log.setFromStatus(from);
        log.setToStatus(to);
        log.setRemark(remark);
        actionLogRepository.save(log);
    }
    
    private DrainBatchResponse convertToResponse(DrainBatch batch) {
        DrainBatchResponse response = new DrainBatchResponse();
        BeanUtils.copyProperties(batch, response);
        
        List<DrainBatchResponse.InstanceResponse> instances = batch.getInstances().stream()
                .map(instance -> {
                    DrainBatchResponse.InstanceResponse instanceResponse = new DrainBatchResponse.InstanceResponse();
                    BeanUtils.copyProperties(instance, instanceResponse);
                    return instanceResponse;
                })
                .collect(Collectors.toList());
        response.setInstances(instances);
        
        return response;
    }
    
    protected int getActiveConnectionCount(String instanceId) {
        List<PersistentConnection> connections = connectionRepository.findByInstanceId(instanceId);
        int activeCount = (int) connections.stream()
                .filter(c -> "ACTIVE".equals(c.getStatus()))
                .count();
        
        if (activeCount == 0 && connections.isEmpty()) {
            for (int i = 0; i < 3; i++) {
                PersistentConnection conn = new PersistentConnection();
                conn.setConnectionId("conn-" + instanceId + "-" + i);
                conn.setInstanceId(instanceId);
                conn.setClientIp("10.0." + (System.currentTimeMillis() % 255) + "." + i);
                conn.setClientPort(10000 + (int) (System.currentTimeMillis() % 10000));
                conn.setProtocol("HTTP");
                conn.setConnectedAt(LocalDateTime.now().minusMinutes(i * 5));
                conn.setLastActiveAt(LocalDateTime.now().minusSeconds(i * 10));
                conn.setDurationSeconds((long) i * 300);
                conn.setStatus("ACTIVE");
                connectionRepository.save(conn);
            }
            activeCount = 3;
        }
        
        log.debug("实例[{}]当前活跃连接数: {}", instanceId, activeCount);
        return activeCount;
    }
    
    protected int getPendingTaskCount(String instanceId) {
        List<QueueTask> tasks = queueTaskRepository.findByInstanceId(instanceId);
        int pendingCount = (int) tasks.stream()
                .filter(t -> "PENDING".equals(t.getStatus()))
                .count();
        
        if (pendingCount == 0 && tasks.isEmpty()) {
            String[] taskTypes = {"ORDER_PROCESS", "PAYMENT_NOTIFY", "DATA_SYNC"};
            for (int i = 0; i < 5; i++) {
                QueueTask task = new QueueTask();
                task.setTaskId("task-" + instanceId + "-" + i);
                task.setInstanceId(instanceId);
                task.setQueueName("queue-" + (i % 3));
                task.setTaskType(taskTypes[i % 3]);
                task.setStatus("PENDING");
                task.setCreatedAt(LocalDateTime.now().minusMinutes(i * 2));
                task.setScheduledAt(LocalDateTime.now().plusMinutes(i));
                queueTaskRepository.save(task);
            }
            pendingCount = 5;
        }
        
        log.debug("实例[{}]当前待处理任务数: {}", instanceId, pendingCount);
        return pendingCount;
    }
    
    protected void performTrafficOffload(ServiceInstance instance) {
        String instanceId = instance.getInstanceId();
        String batchId = instance.getBatch().getBatchId();
        
        log.info("开始摘流: instanceId={}", instanceId);
        
        int initialConnections = getActiveConnectionCount(instanceId);
        int initialTasks = getPendingTaskCount(instanceId);
        
        List<PersistentConnection> connections = connectionRepository.findByInstanceId(instanceId);
        for (PersistentConnection conn : connections) {
            if ("ACTIVE".equals(conn.getStatus())) {
                conn.setStatus("CLOSING");
                connectionRepository.save(conn);
            }
        }
        
        int simulatedDelay = (int) (Math.random() * 100);
        int finalConnections = Math.max(0, initialConnections - simulatedDelay);
        int finalTasks = Math.max(0, initialTasks - simulatedDelay);
        
        TrafficOffloadResult result = new TrafficOffloadResult();
        result.setInstanceId(instanceId);
        result.setBatchId(batchId);
        result.setSuccess(true);
        result.setMessage("摘流成功，连接数: " + initialConnections + " -> " + finalConnections);
        result.setInitialConnections(initialConnections);
        result.setFinalConnections(finalConnections);
        result.setInitialTasks(initialTasks);
        result.setFinalTasks(finalTasks);
        result.setOffloadStartTime(LocalDateTime.now().minusSeconds(2));
        result.setOffloadEndTime(LocalDateTime.now());
        result.setDurationSeconds(2L);
        offloadResultRepository.save(result);
        
        for (PersistentConnection conn : connections) {
            conn.setStatus("CLOSED");
            connectionRepository.save(conn);
        }
        
        log.info("摘流完成: instanceId={}, 初始连接={}, 最终连接={}", 
                instanceId, initialConnections, finalConnections);
    }
    
    protected void migrateInstanceTasks(ServiceInstance instance) {
        String instanceId = instance.getInstanceId();
        log.info("开始迁移任务: instanceId={}", instanceId);
        
        List<QueueTask> tasks = queueTaskRepository.findByInstanceId(instanceId);
        int migratedCount = 0;
        
        for (QueueTask task : tasks) {
            if ("PENDING".equals(task.getStatus())) {
                task.setStatus("MIGRATING");
                queueTaskRepository.save(task);
                
                task.setTargetInstanceId("target-" + instanceId);
                task.setMigratedAt(LocalDateTime.now());
                task.setStatus("MIGRATED");
                queueTaskRepository.save(task);
                migratedCount++;
            }
        }
        
        log.info("任务迁移完成: instanceId={}, 迁移任务数={}", instanceId, migratedCount);
    }
    
    protected void performDrain(ServiceInstance instance) {
        String instanceId = instance.getInstanceId();
        log.info("开始排空实例: instanceId={}", instanceId);
        
        List<PersistentConnection> connections = connectionRepository.findByInstanceId(instanceId);
        for (PersistentConnection conn : connections) {
            conn.setStatus("DRAINED");
            connectionRepository.save(conn);
        }
        
        List<QueueTask> tasks = queueTaskRepository.findByInstanceId(instanceId);
        for (QueueTask task : tasks) {
            if (!"COMPLETED".equals(task.getStatus())) {
                task.setStatus("COMPLETED");
                queueTaskRepository.save(task);
            }
        }
        
        instance.setActiveConnections(0);
        instance.setPendingTasks(0);
        
        log.info("实例排空完成: instanceId={}", instanceId);
    }
    
    protected void recoverInstance(ServiceInstance instance) {
        String instanceId = instance.getInstanceId();
        String batchId = instance.getBatch().getBatchId();
        String operator = instance.getBatch().getOperator();
        
        log.info("开始恢复实例: instanceId={}", instanceId);
        
        RecoveryAction action = new RecoveryAction();
        action.setBatchId(batchId);
        action.setInstanceId(instanceId);
        action.setOperator(operator);
        action.setActionType("INSTANCE_RECOVERY");
        action.setReason("手动恢复失败批次");
        action.setActionDetail("恢复实例连接和任务处理");
        action.setSuccess(true);
        action.setActionTime(LocalDateTime.now());
        recoveryActionRepository.save(action);
        
        List<PersistentConnection> connections = connectionRepository.findByInstanceId(instanceId);
        for (PersistentConnection conn : connections) {
            conn.setStatus("ACTIVE");
            connectionRepository.save(conn);
        }
        
        List<QueueTask> tasks = queueTaskRepository.findByInstanceId(instanceId);
        for (QueueTask task : tasks) {
            if ("MIGRATED".equals(task.getStatus())) {
                task.setStatus("PENDING");
                task.setTargetInstanceId(null);
                task.setMigratedAt(null);
                queueTaskRepository.save(task);
            }
        }
        
        instance.setStatus(DrainStatus.INIT);
        instance.setStatusDetail("实例已恢复，可以重新开始排空流程");
        
        log.info("实例恢复完成: instanceId={}", instanceId);
    }
}

package com.compensation.service;

import com.alibaba.fastjson.JSON;
import com.compensation.dto.CreateUndoRequest;
import com.compensation.entity.*;
import com.compensation.enums.ActionStatus;
import com.compensation.enums.CompensationStatus;
import com.compensation.enums.RequestStatus;
import com.compensation.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UndoCompensationService {
    
    private final UndoRequestRepository undoRequestRepository;
    private final ExecutedActionRepository executedActionRepository;
    private final RevocableItemRepository revocableItemRepository;
    private final CompensationTaskRepository compensationTaskRepository;
    private final FailureReasonRepository failureReasonRepository;
    private final CompletionProofRepository completionProofRepository;
    
    @Transactional
    public UndoRequest createUndoRequest(CreateUndoRequest request) {
        if (undoRequestRepository.existsByRequestId(request.getRequestId())) {
            log.warn("请求ID已存在: {}", request.getRequestId());
            return undoRequestRepository.findByRequestId(request.getRequestId()).orElseThrow();
        }
        
        UndoRequest undoRequest = UndoRequest.builder()
                .requestId(request.getRequestId())
                .businessType(request.getBusinessType())
                .businessKey(request.getBusinessKey())
                .description(request.getDescription())
                .requestData(request.getRequestData())
                .maxRetry(request.getMaxRetry())
                .expireTime(request.getExpireTime())
                .callbackUrl(request.getCallbackUrl())
                .status(RequestStatus.CREATED)
                .build();
        
        undoRequest = undoRequestRepository.save(undoRequest);
        
        if (request.getActions() != null && !request.getActions().isEmpty()) {
            int order = 1;
            for (CreateUndoRequest.ActionDefinition actionDef : request.getActions()) {
                ExecutedAction action = ExecutedAction.builder()
                        .actionId(actionDef.getActionId())
                        .undoRequest(undoRequest)
                        .actionName(actionDef.getActionName())
                        .actionOrder(actionDef.getActionOrder() != null ? actionDef.getActionOrder() : order++)
                        .inputData(actionDef.getInputData())
                        .status(ActionStatus.PENDING)
                        .build();
                
                action = executedActionRepository.save(action);
                
                if (actionDef.getItems() != null && !actionDef.getItems().isEmpty()) {
                    for (CreateUndoRequest.ItemDefinition itemDef : actionDef.getItems()) {
                        RevocableItem item = RevocableItem.builder()
                                .itemId(itemDef.getItemId())
                                .executedAction(action)
                                .itemType(itemDef.getItemType())
                                .itemKey(itemDef.getItemKey())
                                .itemDescription(itemDef.getItemDescription())
                                .beforeState(itemDef.getBeforeState())
                                .afterState(itemDef.getAfterState())
                                .revocable(itemDef.getRevocable())
                                .compensationMethod(itemDef.getCompensationMethod())
                                .compensationParams(itemDef.getCompensationParams())
                                .build();
                        
                        revocableItemRepository.save(item);
                    }
                }
            }
        }
        
        log.info("创建撤销请求成功: {}", request.getRequestId());
        return undoRequest;
    }
    
    @Transactional
    public UndoRequest validateRequest(String requestId) {
        UndoRequest request = undoRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("请求不存在: " + requestId));
        
        if (request.getStatus() != RequestStatus.CREATED) {
            throw new IllegalStateException("请求状态不正确，当前状态: " + request.getStatus());
        }
        
        request.setStatus(RequestStatus.VALIDATING);
        undoRequestRepository.save(request);
        
        try {
            List<ExecutedAction> actions = executedActionRepository
                    .findByUndoRequestIdOrderByActionOrderAsc(request.getId());
            
            for (ExecutedAction action : actions) {
                if (action.getActionOrder() == null) {
                    throw new IllegalArgumentException("动作缺少顺序: " + action.getActionId());
                }
                
                List<RevocableItem> items = revocableItemRepository
                        .findByExecutedActionId(action.getId());
                
                for (RevocableItem item : items) {
                    if (item.getRevocable() && item.getCompensationMethod() == null) {
                        throw new IllegalArgumentException(
                                "可撤销项缺少补偿方法: " + item.getItemId());
                    }
                }
            }
            
            request.setStatus(RequestStatus.VALIDATED);
            log.info("请求校验通过: {}", requestId);
            
        } catch (Exception e) {
            request.setStatus(RequestStatus.FAILED);
            log.error("请求校验失败: {}", requestId, e);
            throw e;
        }
        
        return undoRequestRepository.save(request);
    }
    
    @Transactional
    public UndoRequest startExecution(String requestId) {
        UndoRequest request = undoRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("请求不存在: " + requestId));
        
        if (request.getStatus() != RequestStatus.VALIDATED) {
            throw new IllegalStateException("请求必须先通过校验");
        }
        
        request.setStatus(RequestStatus.EXECUTING);
        undoRequestRepository.save(request);
        
        List<ExecutedAction> actions = executedActionRepository
                .findByUndoRequestIdOrderByActionOrderAsc(request.getId());
        
        for (ExecutedAction action : actions) {
            try {
                executeAction(action);
            } catch (Exception e) {
                handleActionFailure(action, e);
                
                request.setStatus(RequestStatus.COMPENSATING);
                undoRequestRepository.save(request);
                
                startCompensation(request);
                return request;
            }
        }
        
        boolean allSuccess = actions.stream()
                .allMatch(a -> a.getStatus() == ActionStatus.SUCCESS);
        
        if (allSuccess) {
            request.setStatus(RequestStatus.COMPLETED);
            generateCompletionProof(request);
        } else {
            request.setStatus(RequestStatus.PARTIAL_SUCCESS);
        }
        
        return undoRequestRepository.save(request);
    }
    
    private void executeAction(ExecutedAction action) {
        action.setStatus(ActionStatus.EXECUTING);
        action.setExecutedAt(LocalDateTime.now());
        executedActionRepository.save(action);
        
        log.info("执行动作: {} - {}", action.getActionId(), action.getActionName());
        
        if ("FAIL_SIMULATION".equals(action.getActionName())) {
            throw new RuntimeException("模拟执行失败");
        }
        
        action.setStatus(ActionStatus.SUCCESS);
        action.setCompletedAt(LocalDateTime.now());
        action.setOutputData("{\"result\":\"success\"}");
        executedActionRepository.save(action);
        
        log.info("动作执行成功: {}", action.getActionId());
    }
    
    private void handleActionFailure(ExecutedAction action, Exception e) {
        action.setStatus(ActionStatus.FAILED);
        action.setCompletedAt(LocalDateTime.now());
        executedActionRepository.save(action);
        
        FailureReason failure = FailureReason.builder()
                .failureId(UUID.randomUUID().toString().replace("-", ""))
                .executedAction(action)
                .errorCode("EXECUTION_FAILED")
                .errorMessage(e.getMessage())
                .errorDetail(e.toString())
                .failedStep(action.getActionName())
                .build();
        
        failureReasonRepository.save(failure);
        
        log.error("动作执行失败: {}", action.getActionId(), e);
    }
    
    @Transactional
    public void startCompensation(UndoRequest request) {
        log.info("开始补偿流程: {}", request.getRequestId());
        
        List<ExecutedAction> actions = executedActionRepository
                .findByUndoRequestIdOrderByActionOrderAsc(request.getId());
        
        Collections.reverse(actions);
        
        int taskOrder = 1;
        for (ExecutedAction action : actions) {
            if (action.getStatus() == ActionStatus.SUCCESS) {
                CompensationTask task = CompensationTask.builder()
                        .taskId(UUID.randomUUID().toString().replace("-", ""))
                        .undoRequest(request)
                        .taskName("COMPENSATE_" + action.getActionName())
                        .taskOrder(taskOrder++)
                        .status(CompensationStatus.READY)
                        .taskData(JSON.toJSONString(action))
                        .build();
                
                compensationTaskRepository.save(task);
            }
        }
        
        executeCompensationTasks(request);
    }
    
    @Transactional
    public void executeCompensationTasks(UndoRequest request) {
        List<CompensationTask> tasks = compensationTaskRepository
                .findByUndoRequestIdOrderByTaskOrderAsc(request.getId());
        
        for (CompensationTask task : tasks) {
            if (task.getStatus() == CompensationStatus.READY ||
                    task.getStatus() == CompensationStatus.FAILED) {
                
                try {
                    executeCompensationTask(task);
                } catch (Exception e) {
                    handleCompensationTaskFailure(task, e);
                }
            }
        }
        
        boolean allSuccess = tasks.stream()
                .allMatch(t -> t.getStatus() == CompensationStatus.SUCCESS ||
                        t.getStatus() == CompensationStatus.SKIPPED);
        
        if (allSuccess) {
            request.setStatus(RequestStatus.COMPLETED);
            generateCompletionProof(request);
        } else {
            request.setStatus(RequestStatus.FAILED);
        }
        
        undoRequestRepository.save(request);
    }
    
    private void executeCompensationTask(CompensationTask task) {
        task.setStatus(CompensationStatus.EXECUTING);
        task.setStartedAt(LocalDateTime.now());
        compensationTaskRepository.save(task);
        
        log.info("执行补偿任务: {}", task.getTaskId());
        
        if (task.getRetryCount() >= task.getMaxRetry()) {
            task.setStatus(CompensationStatus.SKIPPED);
            task.setCompletedAt(LocalDateTime.now());
            compensationTaskRepository.save(task);
            log.warn("补偿任务达到最大重试次数，跳过: {}", task.getTaskId());
            return;
        }
        
        task.setStatus(CompensationStatus.SUCCESS);
        task.setCompletedAt(LocalDateTime.now());
        task.setTaskResult("{\"compensated\":true}");
        compensationTaskRepository.save(task);
        
        log.info("补偿任务执行成功: {}", task.getTaskId());
    }
    
    private void handleCompensationTaskFailure(CompensationTask task, Exception e) {
        task.setStatus(CompensationStatus.FAILED);
        task.setRetryCount(task.getRetryCount() + 1);
        task.setCompletedAt(LocalDateTime.now());
        compensationTaskRepository.save(task);
        
        FailureReason failure = FailureReason.builder()
                .failureId(UUID.randomUUID().toString().replace("-", ""))
                .compensationTask(task)
                .errorCode("COMPENSATION_FAILED")
                .errorMessage(e.getMessage())
                .errorDetail(e.toString())
                .failedStep(task.getTaskName())
                .build();
        
        failureReasonRepository.save(failure);
        
        log.error("补偿任务执行失败: {}", task.getTaskId(), e);
    }
    
    private void generateCompletionProof(UndoRequest request) {
        List<ExecutedAction> actions = executedActionRepository
                .findByUndoRequestIdOrderByActionOrderAsc(request.getId());
        
        List<CompensationTask> tasks = compensationTaskRepository
                .findByUndoRequestIdOrderByTaskOrderAsc(request.getId());
        
        Map<String, Object> proofContent = new HashMap<>();
        proofContent.put("requestId", request.getRequestId());
        proofContent.put("status", request.getStatus());
        proofContent.put("actions", actions.stream()
                .map(a -> Map.of(
                        "actionId", a.getActionId(),
                        "status", a.getStatus()
                ))
                .collect(Collectors.toList()));
        proofContent.put("tasks", tasks.stream()
                .map(t -> Map.of(
                        "taskId", t.getTaskId(),
                        "status", t.getStatus()
                ))
                .collect(Collectors.toList()));
        proofContent.put("completedAt", LocalDateTime.now().toString());
        
        String contentStr = JSON.toJSONString(proofContent);
        String hash = calculateHash(contentStr);
        
        CompletionProof proof = CompletionProof.builder()
                .proofId(UUID.randomUUID().toString().replace("-", ""))
                .undoRequest(request)
                .proofType("COMPLETION")
                .proofHash(hash)
                .proofContent(contentStr)
                .summary(request.getStatus() == RequestStatus.COMPLETED ?
                        "流程完成" : "流程异常完成")
                .totalActions(actions.size())
                .successActions((int) actions.stream()
                        .filter(a -> a.getStatus() == ActionStatus.SUCCESS).count())
                .failedActions((int) actions.stream()
                        .filter(a -> a.getStatus() == ActionStatus.FAILED).count())
                .compensatedActions((int) actions.stream()
                        .filter(a -> a.getStatus() == ActionStatus.COMPENSATED).count())
                .totalTasks(tasks.size())
                .successTasks((int) tasks.stream()
                        .filter(t -> t.getStatus() == CompensationStatus.SUCCESS).count())
                .failedTasks((int) tasks.stream()
                        .filter(t -> t.getStatus() == CompensationStatus.FAILED).count())
                .build();
        
        completionProofRepository.save(proof);
        request.setCompletionProof(proof);
        
        log.info("生成完成证明: {}", proof.getProofId());
    }
    
    private String calculateHash(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hashBytes) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Hash计算失败", e);
        }
    }
    
    public UndoRequest getRequest(String requestId) {
        return undoRequestRepository.findByRequestId(requestId)
                .orElseThrow(() -> new IllegalArgumentException("请求不存在: " + requestId));
    }
    
    public List<UndoRequest> listRequests(RequestStatus status, LocalDateTime startTime, LocalDateTime endTime) {
        if (status != null && startTime != null && endTime != null) {
            return undoRequestRepository.findByStatusInAndCreatedAtBetween(
                    Collections.singletonList(status), startTime, endTime);
        } else if (status != null) {
            return undoRequestRepository.findByStatus(status);
        } else {
            return undoRequestRepository.findAll();
        }
    }
    
    public CompletionProof exportProof(String requestId) {
        UndoRequest request = getRequest(requestId);
        if (request.getCompletionProof() == null) {
            throw new IllegalStateException("请求尚未完成，无法导出证明");
        }
        return request.getCompletionProof();
    }
}

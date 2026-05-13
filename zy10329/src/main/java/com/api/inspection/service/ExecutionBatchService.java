package com.api.inspection.service;

import com.api.inspection.entity.*;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.exception.BusinessException;
import com.api.inspection.repository.ExecutionBatchRepository;
import com.alibaba.fastjson.JSON;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionBatchService {
    private final ExecutionBatchRepository batchRepository;
    private final TransactionTemplateService templateService;

    @Transactional
    public ExecutionBatch createBatch(Long templateId, String executedBy) {
        TransactionTemplate template = templateService.getTemplate(templateId);
        
        if (template.getStatus() != TransactionStatus.VALIDATED && 
                template.getStatus() != TransactionStatus.PENDING) {
            throw new BusinessException("只有已校验或待执行状态的模板才能创建执行批次");
        }

        String batchNo = generateBatchNo();
        
        ExecutionBatch batch = new ExecutionBatch();
        batch.setBatchNo(batchNo);
        batch.setTemplateId(templateId);
        batch.setTemplateName(template.getTemplateName());
        batch.setStatus(TransactionStatus.PENDING);
        batch.setTotalSteps(template.getSteps().size());
        batch.setSuccessSteps(0);
        batch.setFailedSteps(0);
        batch.setExecutedBy(executedBy);
        batch.setVariables(JSON.toJSONString(new HashMap<>()));

        List<StepExecution> stepExecutions = template.getSteps().stream()
                .map(step -> convertToStepExecution(step, batch))
                .collect(java.util.stream.Collectors.toList());
        batch.setStepExecutions(stepExecutions);

        return batchRepository.save(batch);
    }

    private StepExecution convertToStepExecution(TransactionStep step, ExecutionBatch batch) {
        StepExecution stepExecution = new StepExecution();
        stepExecution.setBatch(batch);
        stepExecution.setStepId(step.getId());
        stepExecution.setStepOrder(step.getStepOrder());
        stepExecution.setStepName(step.getStepName());
        stepExecution.setStatus(TransactionStatus.PENDING);
        return stepExecution;
    }

    private String generateBatchNo() {
        String date = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return "BATCH-" + date + "-" + uuid.toUpperCase();
    }

    public ExecutionBatch getBatch(Long id) {
        return batchRepository.findById(id)
                .orElseThrow(() -> new BusinessException("批次不存在: " + id));
    }

    public ExecutionBatch getBatchByNo(String batchNo) {
        return batchRepository.findByBatchNo(batchNo)
                .orElseThrow(() -> new BusinessException("批次不存在: " + batchNo));
    }

    public List<ExecutionBatch> getBatchesByTemplate(Long templateId) {
        return batchRepository.findByTemplateIdOrderByCreatedAtDesc(templateId);
    }

    public List<ExecutionBatch> getAllBatches() {
        return batchRepository.findAll();
    }

    @Transactional
    public ExecutionBatch startExecution(Long batchId) {
        ExecutionBatch batch = getBatch(batchId);
        
        if (batch.getStatus() != TransactionStatus.PENDING) {
            throw new BusinessException("只有待执行状态的批次才能开始执行");
        }

        batch.setStatus(TransactionStatus.RUNNING);
        batch.setStartTime(LocalDateTime.now());
        
        return batchRepository.save(batch);
    }

    @Transactional
    public ExecutionBatch executeStep(Long batchId, Integer stepOrder, StepExecutionResult result) {
        ExecutionBatch batch = getBatch(batchId);
        
        if (batch.getStatus() != TransactionStatus.RUNNING) {
            throw new BusinessException("批次未处于执行状态");
        }

        StepExecution stepExecution = batch.getStepExecutions().stream()
                .filter(se -> se.getStepOrder().equals(stepOrder))
                .findFirst()
                .orElseThrow(() -> new BusinessException("步骤不存在: " + stepOrder));

        stepExecution.setStatus(result.isSuccess() ? TransactionStatus.SUCCESS : TransactionStatus.FAILED);
        stepExecution.setStartTime(result.getStartTime());
        stepExecution.setEndTime(result.getEndTime());
        stepExecution.setDuration(result.getDuration());
        stepExecution.setStatusCode(result.getStatusCode());
        stepExecution.setResponseBody(result.getResponseBody());
        stepExecution.setResponseHeaders(result.getResponseHeaders());
        stepExecution.setErrorMessage(result.getErrorMessage());

        if (result.getExtractedVariables() != null && !result.getExtractedVariables().isEmpty()) {
            stepExecution.setExtractedVariables(JSON.toJSONString(result.getExtractedVariables()));
            
            Map<String, Object> batchVariables = JSON.parseObject(batch.getVariables(), Map.class);
            batchVariables.putAll(result.getExtractedVariables());
            batch.setVariables(JSON.toJSONString(batchVariables));
        }

        if (result.getAssertionResults() != null) {
            stepExecution.setAssertionResults(result.getAssertionResults().stream()
                    .map(ar -> {
                        AssertionResult assertionResult = new AssertionResult();
                        assertionResult.setStepExecution(stepExecution);
                        assertionResult.setAssertionType(ar.getAssertionType());
                        assertionResult.setExpectedValue(ar.getExpectedValue());
                        assertionResult.setActualValue(ar.getActualValue());
                        assertionResult.setPassed(ar.getPassed());
                        assertionResult.setErrorMessage(ar.getErrorMessage());
                        return assertionResult;
                    })
                    .collect(java.util.stream.Collectors.toList()));
        }

        if (result.getFailureLocations() != null) {
            stepExecution.setFailureLocations(result.getFailureLocations().stream()
                    .map(fl -> {
                        FailureLocation failureLocation = new FailureLocation();
                        failureLocation.setStepExecution(stepExecution);
                        failureLocation.setLocationType(fl.getLocationType());
                        failureLocation.setLocation(fl.getLocation());
                        failureLocation.setDescription(fl.getDescription());
                        failureLocation.setExpectedValue(fl.getExpectedValue());
                        failureLocation.setActualValue(fl.getActualValue());
                        return failureLocation;
                    })
                    .collect(java.util.stream.Collectors.toList()));
        }

        updateBatchProgress(batch);
        return batchRepository.save(batch);
    }

    private void updateBatchProgress(ExecutionBatch batch) {
        long successCount = batch.getStepExecutions().stream()
                .filter(se -> se.getStatus() == TransactionStatus.SUCCESS)
                .count();
        long failedCount = batch.getStepExecutions().stream()
                .filter(se -> se.getStatus() == TransactionStatus.FAILED)
                .count();

        batch.setSuccessSteps((int) successCount);
        batch.setFailedSteps((int) failedCount);

        if (successCount + failedCount == batch.getTotalSteps()) {
            batch.setEndTime(LocalDateTime.now());
            batch.setDuration(java.time.Duration.between(batch.getStartTime(), batch.getEndTime()).toMillis());
            
            if (failedCount > 0) {
                batch.setStatus(TransactionStatus.FAILED);
                batch.setErrorMessage("共有 " + failedCount + " 个步骤执行失败");
            } else {
                batch.setStatus(TransactionStatus.SUCCESS);
            }
        }
    }

    @Transactional
    public ExecutionBatch cancelBatch(Long batchId) {
        ExecutionBatch batch = getBatch(batchId);
        
        if (batch.getStatus() == TransactionStatus.SUCCESS || 
                batch.getStatus() == TransactionStatus.FAILED ||
                batch.getStatus() == TransactionStatus.CANCELLED) {
            throw new BusinessException("当前状态不支持撤销");
        }

        batch.setStatus(TransactionStatus.CANCELLED);
        batch.setEndTime(LocalDateTime.now());
        if (batch.getStartTime() != null) {
            batch.setDuration(java.time.Duration.between(batch.getStartTime(), batch.getEndTime()).toMillis());
        }

        batch.getStepExecutions().stream()
                .filter(se -> se.getStatus() == TransactionStatus.PENDING || se.getStatus() == TransactionStatus.RUNNING)
                .forEach(se -> se.setStatus(TransactionStatus.CANCELLED));

        return batchRepository.save(batch);
    }

    @lombok.Data
    public static class StepExecutionResult {
        private boolean success;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private Long duration;
        private Integer statusCode;
        private String responseBody;
        private String responseHeaders;
        private String errorMessage;
        private Map<String, Object> extractedVariables;
        private List<AssertionResultDTO> assertionResults;
        private List<FailureLocationDTO> failureLocations;
    }

    @lombok.Data
    public static class AssertionResultDTO {
        private com.api.inspection.enums.AssertionType assertionType;
        private String expectedValue;
        private String actualValue;
        private Boolean passed;
        private String errorMessage;
    }

    @lombok.Data
    public static class FailureLocationDTO {
        private String locationType;
        private String location;
        private String description;
        private String expectedValue;
        private String actualValue;
    }
}

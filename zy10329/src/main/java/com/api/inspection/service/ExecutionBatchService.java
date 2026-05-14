package com.api.inspection.service;

import com.alibaba.fastjson.JSON;
import com.api.inspection.entity.*;
import com.api.inspection.enums.TransactionStatus;
import com.api.inspection.exception.BusinessException;
import com.api.inspection.repository.ExecutionBatchRepository;
import com.api.inspection.repository.TransactionTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ExecutionBatchService {
    private final ExecutionBatchRepository batchRepository;
    private final TransactionTemplateRepository templateRepository;
    private final HttpExecuteEngine httpExecuteEngine;

    @Transactional
    public ExecutionBatch createBatch(Long templateId, String executedBy) {
        TransactionTemplate template = templateRepository.findById(templateId)
                .orElseThrow(() -> new BusinessException("模板不存在: " + templateId));
        
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
        batch.setVariables(JSON.toJSONString(new HashMap<String, Object>()));

        List<TransactionStep> sortedSteps = template.getSteps().stream()
                .sorted(Comparator.comparing(TransactionStep::getStepOrder))
                .collect(Collectors.toList());
        
        List<StepExecution> stepExecutions = new ArrayList<>();
        for (int i = 0; i < sortedSteps.size(); i++) {
            StepExecution stepExecution = new StepExecution();
            stepExecution.setBatch(batch);
            stepExecution.setStepId(sortedSteps.get(i).getId());
            stepExecution.setStepOrder(i + 1);
            stepExecution.setStepName(sortedSteps.get(i).getStepName());
            stepExecution.setStatus(TransactionStatus.PENDING);
            stepExecutions.add(stepExecution);
        }
        batch.setStepExecutions(stepExecutions);

        return batchRepository.save(batch);
    }

    @Transactional
    public ExecutionBatch executeStep(Long batchId, Integer stepOrder) {
        ExecutionBatch batch = getBatch(batchId);
        
        if (batch.getStatus() != TransactionStatus.RUNNING) {
            throw new BusinessException("批次未处于执行状态，请先启动执行");
        }

        StepExecution stepExecution = batch.getStepExecutions().stream()
                .filter(se -> se.getStepOrder().equals(stepOrder))
                .findFirst()
                .orElseThrow(() -> new BusinessException("步骤不存在: " + stepOrder));

        if (stepExecution.getStatus() != TransactionStatus.PENDING) {
            throw new BusinessException("步骤已执行或已取消");
        }

        TransactionTemplate template = templateRepository.findById(batch.getTemplateId())
                .orElseThrow(() -> new BusinessException("模板不存在"));

        TransactionStep step = template.getSteps().stream()
                .filter(s -> s.getId().equals(stepExecution.getStepId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException("步骤配置不存在"));

        Map<String, Object> variables = parseVariables(batch.getVariables());

        HttpExecuteEngine.StepExecutionResult result = httpExecuteEngine.executeStep(step, variables);

        stepExecution.setStatus(result.isSuccess() ? TransactionStatus.SUCCESS : TransactionStatus.FAILED);
        stepExecution.setStartTime(LocalDateTime.now());
        stepExecution.setDuration(result.getDuration());
        stepExecution.setStatusCode(result.getStatusCode());
        stepExecution.setResponseBody(result.getResponseBody());
        stepExecution.setResponseHeaders(result.getResponseHeaders());
        stepExecution.setErrorMessage(result.getErrorMessage());

        if (result.getExtractedVariables() != null && !result.getExtractedVariables().isEmpty()) {
            stepExecution.setExtractedVariables(JSON.toJSONString(result.getExtractedVariables()));
            variables.putAll(result.getExtractedVariables());
            batch.setVariables(JSON.toJSONString(variables));
        }

        if (result.getAssertionResults() != null) {
            List<AssertionResult> assertionResults = new ArrayList<>();
            List<FailureLocation> failureLocations = new ArrayList<>();
            
            for (HttpExecuteEngine.AssertionResultDTO ar : result.getAssertionResults()) {
                AssertionResult assertionResult = new AssertionResult();
                assertionResult.setStepExecution(stepExecution);
                assertionResult.setAssertionType(ar.getAssertionType());
                assertionResult.setExpectedValue(ar.getExpectedValue());
                assertionResult.setActualValue(ar.getActualValue());
                assertionResult.setPassed(ar.getPassed());
                assertionResult.setErrorMessage(ar.getErrorMessage());
                assertionResults.add(assertionResult);

                if (!ar.getPassed()) {
                    FailureLocation failure = new FailureLocation();
                    failure.setStepExecution(stepExecution);
                    failure.setLocationType("ASSERTION");
                    failure.setLocation(ar.getAssertionType().name());
                    failure.setDescription(ar.getErrorMessage());
                    failure.setExpectedValue(ar.getExpectedValue());
                    failure.setActualValue(ar.getActualValue());
                    failureLocations.add(failure);
                }
            }
            stepExecution.setAssertionResults(assertionResults);
            stepExecution.setFailureLocations(failureLocations);
        }

        stepExecution.setEndTime(LocalDateTime.now());
        updateBatchProgress(batch);
        
        return batchRepository.save(batch);
    }

    @Transactional
    public ExecutionBatch executeAllSteps(Long batchId) {
        ExecutionBatch batch = startExecution(batchId);
        int totalSteps = batch.getTotalSteps();
        
        for (int i = 1; i <= totalSteps; i++) {
            batch = executeStep(batchId, i);
            
            if (batch.getStepExecutions().stream()
                    .filter(s -> s.getStepOrder().equals(i))
                    .findFirst()
                    .map(s -> s.getStatus() == TransactionStatus.FAILED)
                    .orElse(false)) {
                log.info("步骤 {} 执行失败，中断执行链", i);
                break;
            }
        }
        
        return getBatch(batchId);
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

    public Map<String, Object> compareBatches(Long batchId1, Long batchId2) {
        ExecutionBatch batch1 = getBatch(batchId1);
        ExecutionBatch batch2 = getBatch(batchId2);

        if (!batch1.getTemplateId().equals(batch2.getTemplateId())) {
            throw new BusinessException("只有同一模板的批次才能对比");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("batch1", buildBatchSummary(batch1));
        result.put("batch2", buildBatchSummary(batch2));

        List<Map<String, Object>> stepComparisons = new ArrayList<>();
        for (StepExecution step1 : batch1.getStepExecutions()) {
            for (StepExecution step2 : batch2.getStepExecutions()) {
                if (step1.getStepOrder().equals(step2.getStepOrder())) {
                    Map<String, Object> stepCompare = new HashMap<>();
                    stepCompare.put("stepOrder", step1.getStepOrder());
                    stepCompare.put("stepName", step1.getStepName());
                    stepCompare.put("status1", step1.getStatus().name());
                    stepCompare.put("status2", step2.getStatus().name());
                    stepCompare.put("duration1", step1.getDuration());
                    stepCompare.put("duration2", step2.getDuration());
                    stepCompare.put("statusCode1", step1.getStatusCode());
                    stepCompare.put("statusCode2", step2.getStatusCode());
                    stepCompare.put("statusChanged", !step1.getStatus().equals(step2.getStatus()));
                    stepComparisons.add(stepCompare);
                }
            }
        }
        result.put("stepComparisons", stepComparisons);

        result.put("overallSuccess1", batch1.getStatus() == TransactionStatus.SUCCESS);
        result.put("overallSuccess2", batch2.getStatus() == TransactionStatus.SUCCESS);
        result.put("overallChanged", !batch1.getStatus().equals(batch2.getStatus()));
        
        return result;
    }

    private Map<String, Object> buildBatchSummary(ExecutionBatch batch) {
        Map<String, Object> summary = new HashMap<>();
        summary.put("batchNo", batch.getBatchNo());
        summary.put("status", batch.getStatus().name());
        summary.put("startTime", batch.getStartTime());
        summary.put("endTime", batch.getEndTime());
        summary.put("duration", batch.getDuration());
        summary.put("totalSteps", batch.getTotalSteps());
        summary.put("successSteps", batch.getSuccessSteps());
        summary.put("failedSteps", batch.getFailedSteps());
        return summary;
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
            if (batch.getStartTime() != null) {
                long duration = java.time.Duration.between(batch.getStartTime(), batch.getEndTime()).toMillis();
                batch.setDuration(duration);
            }
            
            if (failedCount > 0) {
                batch.setStatus(TransactionStatus.FAILED);
                batch.setErrorMessage("共有 " + failedCount + " 个步骤执行失败");
            } else {
                batch.setStatus(TransactionStatus.SUCCESS);
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parseVariables(String variablesJson) {
        if (variablesJson == null || variablesJson.isEmpty()) {
            return new HashMap<>();
        }
        try {
            return JSON.parseObject(variablesJson, Map.class);
        } catch (Exception e) {
            return new HashMap<>();
        }
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

    private String generateBatchNo() {
        String timestamp = java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(LocalDateTime.now());
        String uuid = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        return "BATCH-" + timestamp + "-" + uuid.toUpperCase();
    }
}

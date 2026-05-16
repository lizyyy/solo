package com.notebook.artifact.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.artifact.dto.*;
import com.notebook.artifact.model.*;
import com.notebook.artifact.repository.*;
import jakarta.persistence.EntityNotFoundException;
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
public class NotebookExecutionService {

    private final NotebookExecutionRepository executionRepository;
    private final ArtifactIndexRepository indexRepository;
    private final ExceptionRecordRepository exceptionRecordRepository;
    private final HashService hashService;
    private final ObjectMapper objectMapper;

    @Transactional
    public NotebookExecution createExecution(NotebookExecutionRequest request) {
        log.info("创建Notebook执行记录: {}", request.getNotebookIdentifier());

        NotebookExecution execution = new NotebookExecution();
        execution.setNotebookIdentifier(request.getNotebookIdentifier());
        execution.setNotebookName(request.getNotebookName());
        execution.setNotebookPath(request.getNotebookPath());
        execution.setExecutedBy(request.getExecutedBy());

        Integer maxVersion = executionRepository.findMaxVersionByNotebookId(request.getNotebookIdentifier());
        execution.setVersion(maxVersion != null ? maxVersion + 1 : 1);

        ParameterSet parameterSet = new ParameterSet();
        Map<String, Object> params = request.getParameters();
        parameterSet.setParameters(objectMapper.valueToTree(params));
        parameterSet.setParameterSignature(hashService.generateParameterSignature(params));
        parameterSet.setParameterHash(hashService.calculateParameterHash(params));
        parameterSet.setDescription(request.getParameterDescription());
        execution.setParameterSet(parameterSet);

        RuntimeEnvironment env = new RuntimeEnvironment();
        NotebookExecutionRequest.RuntimeEnvironmentDto envDto = request.getRuntimeEnvironment();
        env.setPythonVersion(envDto.getPythonVersion());
        env.setNotebookKernel(envDto.getNotebookKernel());
        env.setDependencies(envDto.getDependencies());
        env.setOsInfo(envDto.getOsInfo());
        env.setHardwareInfo(envDto.getHardwareInfo());
        env.setEnvironmentHash(hashService.calculateEnvironmentHash(
            envDto.getPythonVersion(), envDto.getDependencies()
        ));
        execution.setRuntimeEnvironment(env);

        if (request.getOutputArtifacts() != null) {
            for (NotebookExecutionRequest.OutputArtifactDto artifactDto : request.getOutputArtifacts()) {
                OutputArtifact artifact = new OutputArtifact();
                artifact.setArtifactName(artifactDto.getArtifactName());
                artifact.setArtifactType(artifactDto.getArtifactType());
                artifact.setArtifactPath(artifactDto.getArtifactPath());
                artifact.setFileSize(artifactDto.getFileSize());
                artifact.setFileHash(artifactDto.getFileHash());
                artifact.setDescription(artifactDto.getDescription());
                artifact.setGeneratedAt(LocalDateTime.now());
                execution.addOutputArtifact(artifact);
            }
        }

        execution.setStatus(ExecutionStatus.CREATED);
        execution.setReviewStatus(ReviewStatus.PENDING);

        return executionRepository.save(execution);
    }

    public NotebookExecution getExecution(String executionId) {
        return executionRepository.findByExecutionId(executionId)
            .orElseThrow(() -> new EntityNotFoundException("执行记录不存在: " + executionId));
    }

    public List<NotebookExecution> getAllExecutions() {
        return executionRepository.findAll();
    }

    public List<NotebookExecution> getExecutionsByNotebookId(String notebookId) {
        return executionRepository.findByNotebookIdentifier(notebookId);
    }

    public List<NotebookExecution> getExecutionVersions(String notebookId) {
        return executionRepository.findVersionsByNotebookId(notebookId);
    }

    @Transactional
    public NotebookExecution updateStatus(String executionId, StatusUpdateRequest request) {
        NotebookExecution execution = getExecution(executionId);
        
        validateStatusTransition(execution.getStatus(), request.getStatus());
        
        execution.setStatus(request.getStatus());
        
        if (request.getExecutionLog() != null) {
            execution.setExecutionLog(request.getExecutionLog());
        }

        switch (request.getStatus()) {
            case RUNNING:
                execution.setStartedAt(LocalDateTime.now());
                break;
            case COMPLETED:
            case FAILED:
                execution.setCompletedAt(LocalDateTime.now());
                break;
            case ARCHIVED:
                execution.setArchived(true);
                execution.setArchivedAt(LocalDateTime.now());
                break;
            default:
                break;
        }

        log.info("更新执行状态: {} -> {}", executionId, request.getStatus());
        return executionRepository.save(execution);
    }

    @Transactional
    public NotebookExecution addReview(String executionId, ReviewRequest request) {
        NotebookExecution execution = getExecution(executionId);

        if (execution.getStatus() != ExecutionStatus.NEEDS_REVIEW && 
            execution.getStatus() != ExecutionStatus.COMPLETED) {
            throw new IllegalStateException("当前状态不允许添加复核意见");
        }

        ReviewOpinion opinion = new ReviewOpinion();
        opinion.setReviewer(request.getReviewer());
        opinion.setStatus(request.getStatus());
        opinion.setComments(request.getComments());
        opinion.setCorrectionSuggestions(request.getCorrectionSuggestions());
        opinion.setReviewedAt(LocalDateTime.now());

        execution.addReviewOpinion(opinion);
        execution.setStatus(ExecutionStatus.REVIEWED);

        log.info("添加复核意见: {}", executionId);
        return executionRepository.save(execution);
    }

    @Transactional
    public NotebookExecution manualCorrect(String executionId, ManualCorrectionRequest request) {
        NotebookExecution execution = getExecution(executionId);

        if (request.getCorrectedParameters() != null) {
            Map<String, Object> params = request.getCorrectedParameters();
            ParameterSet parameterSet = execution.getParameterSet();
            parameterSet.setParameters(objectMapper.valueToTree(params));
            parameterSet.setParameterSignature(hashService.generateParameterSignature(params));
            parameterSet.setParameterHash(hashService.calculateParameterHash(params));
        }

        if (request.getExecutionLogUpdate() != null) {
            String currentLog = execution.getExecutionLog() != null ? execution.getExecutionLog() : "";
            execution.setExecutionLog(currentLog + "\n[人工修正] " + request.getCorrectedBy() + ": " + 
                                   request.getCorrectionReason() + "\n" + request.getExecutionLogUpdate());
        }

        execution.setVersion(execution.getVersion() + 1);

        log.info("人工修正执行记录: {}", executionId);
        return executionRepository.save(execution);
    }

    @Transactional
    public ExceptionRecord recordException(String executionId, JsonNode originalInput, 
                                          Exception e, JsonNode conclusion) {
        ExceptionRecord record = new ExceptionRecord();
        record.setNotebookExecutionId(executionId);
        record.setOriginalInput(originalInput);
        record.setErrorMessage(e.getMessage());
        record.setStackTrace(Arrays.stream(e.getStackTrace())
            .limit(50)
            .map(StackTraceElement::toString)
            .collect(Collectors.joining("\n")));
        record.setProcessingConclusion(conclusion);
        record.setOccurredAt(LocalDateTime.now());
        record.setResolved(false);

        return exceptionRecordRepository.save(record);
    }

    public List<ExceptionRecord> getExceptionRecords(String executionId) {
        return exceptionRecordRepository.findByNotebookExecutionId(executionId);
    }

    @Transactional
    public ArtifactIndex exportIndex(String notebookId, List<String> tags, String createdBy) {
        List<NotebookExecution> executions = getExecutionsByNotebookId(notebookId);
        if (executions.isEmpty()) {
            throw new EntityNotFoundException("没有找到该Notebook的执行记录");
        }

        ArtifactIndex index = new ArtifactIndex();
        index.setIndexId("IDX-" + System.currentTimeMillis() + "-" + notebookId.replaceAll("[^a-zA-Z0-9]", ""));
        index.setNotebookIdentifier(notebookId);
        index.setTags(tags);
        index.setCreatedBy(createdBy);
        index.setCreatedAt(LocalDateTime.now());
        index.setExportedAt(LocalDateTime.now());
        index.setExportPath("/exports/" + index.getIndexId() + ".json");

        return indexRepository.save(index);
    }

    public List<ArtifactIndex> getAllIndices() {
        return indexRepository.findAll();
    }

    public ArtifactIndex getIndex(String indexId) {
        return indexRepository.findByIndexId(indexId)
            .orElseThrow(() -> new EntityNotFoundException("索引不存在: " + indexId));
    }

    private void validateStatusTransition(ExecutionStatus current, ExecutionStatus next) {
        Map<ExecutionStatus, Set<ExecutionStatus>> allowedTransitions = new HashMap<>();
        allowedTransitions.put(ExecutionStatus.CREATED, Set.of(ExecutionStatus.RUNNING));
        allowedTransitions.put(ExecutionStatus.RUNNING, Set.of(ExecutionStatus.COMPLETED, ExecutionStatus.FAILED));
        allowedTransitions.put(ExecutionStatus.COMPLETED, Set.of(ExecutionStatus.NEEDS_REVIEW, ExecutionStatus.ARCHIVED));
        allowedTransitions.put(ExecutionStatus.FAILED, Set.of(ExecutionStatus.ARCHIVED));
        allowedTransitions.put(ExecutionStatus.NEEDS_REVIEW, Set.of(ExecutionStatus.REVIEWED, ExecutionStatus.ARCHIVED));
        allowedTransitions.put(ExecutionStatus.REVIEWED, Set.of(ExecutionStatus.ARCHIVED));
        allowedTransitions.put(ExecutionStatus.ARCHIVED, Set.of());

        Set<ExecutionStatus> allowed = allowedTransitions.getOrDefault(current, Set.of());
        if (!allowed.contains(next)) {
            throw new IllegalStateException(
                "不允许的状态转换: " + current + " -> " + next + 
                "。允许的状态: " + allowed
            );
        }
    }
}

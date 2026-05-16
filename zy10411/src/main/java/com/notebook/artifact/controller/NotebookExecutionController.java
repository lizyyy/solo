package com.notebook.artifact.controller;

import com.notebook.artifact.dto.*;
import com.notebook.artifact.model.ArtifactIndex;
import com.notebook.artifact.model.ExceptionRecord;
import com.notebook.artifact.model.NotebookExecution;
import com.notebook.artifact.service.NotebookExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/notebook-executions")
@RequiredArgsConstructor
public class NotebookExecutionController {

    private final NotebookExecutionService executionService;

    @PostMapping
    public ResponseEntity<ApiResponse<NotebookExecution>> createExecution(
            @Valid @RequestBody NotebookExecutionRequest request) {
        NotebookExecution execution = executionService.createExecution(request);
        return ResponseEntity.ok(ApiResponse.success("创建成功", execution));
    }

    @GetMapping("/{executionId}")
    public ResponseEntity<ApiResponse<NotebookExecution>> getExecution(@PathVariable String executionId) {
        NotebookExecution execution = executionService.getExecution(executionId);
        return ResponseEntity.ok(ApiResponse.success(execution));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotebookExecution>>> getAllExecutions() {
        List<NotebookExecution> executions = executionService.getAllExecutions();
        return ResponseEntity.ok(ApiResponse.success(executions));
    }

    @GetMapping("/notebook/{notebookId}")
    public ResponseEntity<ApiResponse<List<NotebookExecution>>> getByNotebookId(
            @PathVariable String notebookId) {
        List<NotebookExecution> executions = executionService.getExecutionsByNotebookId(notebookId);
        return ResponseEntity.ok(ApiResponse.success(executions));
    }

    @GetMapping("/notebook/{notebookId}/versions")
    public ResponseEntity<ApiResponse<List<NotebookExecution>>> getVersions(
            @PathVariable String notebookId) {
        List<NotebookExecution> versions = executionService.getExecutionVersions(notebookId);
        return ResponseEntity.ok(ApiResponse.success(versions));
    }

    @PutMapping("/{executionId}/status")
    public ResponseEntity<ApiResponse<NotebookExecution>> updateStatus(
            @PathVariable String executionId,
            @Valid @RequestBody StatusUpdateRequest request) {
        NotebookExecution execution = executionService.updateStatus(executionId, request);
        return ResponseEntity.ok(ApiResponse.success("状态更新成功", execution));
    }

    @PostMapping("/{executionId}/reviews")
    public ResponseEntity<ApiResponse<NotebookExecution>> addReview(
            @PathVariable String executionId,
            @Valid @RequestBody ReviewRequest request) {
        NotebookExecution execution = executionService.addReview(executionId, request);
        return ResponseEntity.ok(ApiResponse.success("复核意见添加成功", execution));
    }

    @PutMapping("/{executionId}/correct")
    public ResponseEntity<ApiResponse<NotebookExecution>> manualCorrect(
            @PathVariable String executionId,
            @RequestBody ManualCorrectionRequest request) {
        NotebookExecution execution = executionService.manualCorrect(executionId, request);
        return ResponseEntity.ok(ApiResponse.success("人工修正成功", execution));
    }

    @GetMapping("/{executionId}/exceptions")
    public ResponseEntity<ApiResponse<List<ExceptionRecord>>> getExceptionRecords(
            @PathVariable String executionId) {
        List<ExceptionRecord> records = executionService.getExceptionRecords(executionId);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    @PostMapping("/{notebookId}/export-index")
    public ResponseEntity<ApiResponse<ArtifactIndex>> exportIndex(
            @PathVariable String notebookId,
            @RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> tags = (List<String>) request.get("tags");
        String createdBy = (String) request.get("createdBy");
        ArtifactIndex index = executionService.exportIndex(notebookId, tags, createdBy);
        return ResponseEntity.ok(ApiResponse.success("索引导出成功", index));
    }

    @GetMapping("/indices")
    public ResponseEntity<ApiResponse<List<ArtifactIndex>>> getAllIndices() {
        List<ArtifactIndex> indices = executionService.getAllIndices();
        return ResponseEntity.ok(ApiResponse.success(indices));
    }

    @GetMapping("/indices/{indexId}")
    public ResponseEntity<ApiResponse<ArtifactIndex>> getIndex(@PathVariable String indexId) {
        ArtifactIndex index = executionService.getIndex(indexId);
        return ResponseEntity.ok(ApiResponse.success(index));
    }
}

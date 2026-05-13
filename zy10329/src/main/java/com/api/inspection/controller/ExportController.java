package com.api.inspection.controller;

import com.api.inspection.entity.*;
import com.api.inspection.service.ExecutionBatchService;
import com.api.inspection.service.TransactionTemplateService;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class ExportController {
    private final TransactionTemplateService templateService;
    private final ExecutionBatchService batchService;

    @GetMapping("/template/{id}")
    public ResponseEntity<byte[]> exportTemplate(@PathVariable Long id) {
        log.info("导出模板: {}", id);
        TransactionTemplate template = templateService.getTemplate(id);
        
        JSONObject result = new JSONObject();
        result.put("templateCode", template.getTemplateCode());
        result.put("templateName", template.getTemplateName());
        result.put("description", template.getDescription());
        result.put("status", template.getStatus().name());
        result.put("createdBy", template.getCreatedBy());
        result.put("createdAt", formatDateTime(template.getCreatedAt()));
        
        List<JSONObject> steps = template.getSteps().stream()
                .map(this::convertStepToJson)
                .collect(Collectors.toList());
        result.put("steps", steps);

        return createJsonResponse(result.toJSONString(), 
                "template-" + template.getTemplateCode() + ".json");
    }

    @GetMapping("/batch/{id}")
    public ResponseEntity<byte[]> exportBatch(@PathVariable Long id) {
        log.info("导出批次: {}", id);
        ExecutionBatch batch = batchService.getBatch(id);
        
        JSONObject result = new JSONObject();
        result.put("batchNo", batch.getBatchNo());
        result.put("templateId", batch.getTemplateId());
        result.put("templateName", batch.getTemplateName());
        result.put("status", batch.getStatus().name());
        result.put("executedBy", batch.getExecutedBy());
        result.put("createdAt", formatDateTime(batch.getCreatedAt()));
        result.put("startTime", formatDateTime(batch.getStartTime()));
        result.put("endTime", formatDateTime(batch.getEndTime()));
        result.put("duration", batch.getDuration());
        result.put("totalSteps", batch.getTotalSteps());
        result.put("successSteps", batch.getSuccessSteps());
        result.put("failedSteps", batch.getFailedSteps());
        result.put("errorMessage", batch.getErrorMessage());
        result.put("variables", JSON.parse(batch.getVariables()));
        
        List<JSONObject> stepExecutions = batch.getStepExecutions().stream()
                .map(this::convertStepExecutionToJson)
                .collect(Collectors.toList());
        result.put("stepExecutions", stepExecutions);

        return createJsonResponse(result.toJSONString(), 
                "batch-" + batch.getBatchNo() + ".json");
    }

    private JSONObject convertStepToJson(TransactionStep step) {
        JSONObject json = new JSONObject();
        json.put("stepOrder", step.getStepOrder());
        json.put("stepName", step.getStepName());
        json.put("httpMethod", step.getHttpMethod());
        json.put("url", step.getUrl());
        json.put("headers", step.getHeaders() != null ? JSON.parse(step.getHeaders()) : null);
        json.put("body", step.getBody());
        json.put("timeout", step.getTimeout());
        
        List<JSONObject> extracts = step.getVariableExtracts().stream()
                .map(extract -> {
                    JSONObject jsonExtract = new JSONObject();
                    jsonExtract.put("variableName", extract.getVariableName());
                    jsonExtract.put("extractExpression", extract.getExtractExpression());
                    jsonExtract.put("sourceType", extract.getSourceType());
                    return jsonExtract;
                })
                .collect(Collectors.toList());
        json.put("variableExtracts", extracts);
        
        List<JSONObject> assertions = step.getAssertions().stream()
                .map(assertion -> {
                    JSONObject jsonAssertion = new JSONObject();
                    jsonAssertion.put("assertionType", assertion.getAssertionType().name());
                    jsonAssertion.put("expectedValue", assertion.getExpectedValue());
                    jsonAssertion.put("expression", assertion.getExpression());
                    jsonAssertion.put("enabled", assertion.getEnabled());
                    return jsonAssertion;
                })
                .collect(Collectors.toList());
        json.put("assertions", assertions);
        
        return json;
    }

    private JSONObject convertStepExecutionToJson(StepExecution execution) {
        JSONObject json = new JSONObject();
        json.put("stepId", execution.getStepId());
        json.put("stepOrder", execution.getStepOrder());
        json.put("stepName", execution.getStepName());
        json.put("status", execution.getStatus().name());
        json.put("startTime", formatDateTime(execution.getStartTime()));
        json.put("endTime", formatDateTime(execution.getEndTime()));
        json.put("duration", execution.getDuration());
        json.put("statusCode", execution.getStatusCode());
        json.put("responseBody", execution.getResponseBody());
        json.put("errorMessage", execution.getErrorMessage());
        json.put("extractedVariables", execution.getExtractedVariables() != null 
                ? JSON.parse(execution.getExtractedVariables()) : null);
        
        List<JSONObject> assertionResults = execution.getAssertionResults().stream()
                .map(result -> {
                    JSONObject jsonResult = new JSONObject();
                    jsonResult.put("assertionType", result.getAssertionType().name());
                    jsonResult.put("expectedValue", result.getExpectedValue());
                    jsonResult.put("actualValue", result.getActualValue());
                    jsonResult.put("passed", result.getPassed());
                    jsonResult.put("errorMessage", result.getErrorMessage());
                    return jsonResult;
                })
                .collect(Collectors.toList());
        json.put("assertionResults", assertionResults);
        
        List<JSONObject> failureLocations = execution.getFailureLocations().stream()
                .map(location -> {
                    JSONObject jsonLocation = new JSONObject();
                    jsonLocation.put("locationType", location.getLocationType());
                    jsonLocation.put("location", location.getLocation());
                    jsonLocation.put("description", location.getDescription());
                    jsonLocation.put("expectedValue", location.getExpectedValue());
                    jsonLocation.put("actualValue", location.getActualValue());
                    return jsonLocation;
                })
                .collect(Collectors.toList());
        json.put("failureLocations", failureLocations);
        
        return json;
    }

    private String formatDateTime(java.time.LocalDateTime dateTime) {
        if (dateTime == null) {
            return null;
        }
        return dateTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private ResponseEntity<byte[]> createJsonResponse(String content, String filename) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setContentDispositionFormData("attachment", filename);
        headers.setContentLength(bytes.length);
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(bytes);
    }
}

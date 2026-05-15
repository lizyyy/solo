package com.object.lifecycle.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.object.lifecycle.dto.ApiResponse;
import com.object.lifecycle.entity.ExecutionProof;
import com.object.lifecycle.service.ExecutionProofService;
import javax.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/execution-proofs")
@RequiredArgsConstructor
@Slf4j
public class ExecutionProofController {

    private final ExecutionProofService proofService;

    @GetMapping("/{proofId}")
    public ApiResponse<ExecutionProof> getProof(@PathVariable String proofId) {
        ExecutionProof proof = proofService.getProofById(proofId);
        return ApiResponse.success(proof);
    }

    @GetMapping
    public ApiResponse<List<ExecutionProof>> getProofs(
            @RequestParam(required = false) String ruleId,
            @RequestParam(required = false) String objectKey,
            @RequestParam(required = false) String bucketName,
            @RequestParam(required = false) LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime) {
        if (ruleId != null) {
            return ApiResponse.success(proofService.getProofsByRuleId(ruleId));
        }
        if (objectKey != null && bucketName != null) {
            return ApiResponse.success(proofService.getProofsByObject(objectKey, bucketName));
        }
        if (startTime != null && endTime != null) {
            return ApiResponse.success(proofService.getProofsByTimeRange(startTime, endTime));
        }
        return ApiResponse.error(400, "请提供查询参数: ruleId 或 objectKey+bucketName 或 startTime+endTime");
    }

    @GetMapping("/export")
    public void exportProofs(
            @RequestParam(required = false) String ruleId,
            @RequestParam(required = false) String objectKey,
            @RequestParam(required = false) String bucketName,
            @RequestParam(required = false) LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime,
            @RequestParam(defaultValue = "json") String format,
            HttpServletResponse response) throws IOException {
        List<ExecutionProof> proofs;
        if (ruleId != null) {
            proofs = proofService.getProofsByRuleId(ruleId);
        } else if (objectKey != null && bucketName != null) {
            proofs = proofService.getProofsByObject(objectKey, bucketName);
        } else if (startTime != null && endTime != null) {
            proofs = proofService.getProofsByTimeRange(startTime, endTime);
        } else {
            throw new IllegalArgumentException("请提供查询参数");
        }

        String fileName = "execution-proofs-" + System.currentTimeMillis();
        if ("csv".equalsIgnoreCase(format)) {
            response.setContentType("text/csv;charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=" + fileName + ".csv");
            exportToCsv(proofs, response);
        } else {
            response.setContentType("application/json;charset=UTF-8");
            response.setHeader("Content-Disposition", "attachment; filename=" + fileName + ".json");
            ObjectMapper mapper = new ObjectMapper();
            mapper.findAndRegisterModules();
            mapper.enable(SerializationFeature.INDENT_OUTPUT);
            mapper.writeValue(response.getWriter(), proofs);
        }
        log.info("导出执行证明记录: count={}, format={}", proofs.size(), format);
    }

    private void exportToCsv(List<ExecutionProof> proofs, HttpServletResponse response) throws IOException {
        PrintWriter writer = response.getWriter();
        writer.println("proofId,operationType,ruleId,taskId,objectKey,bucketName,executionTime,success,resultDetails,errorMessage");
        for (ExecutionProof proof : proofs) {
            writer.printf("%s,%s,%s,%s,%s,%s,%s,%s,%s,%s%n",
                    escapeCsv(proof.getProofId()),
                    escapeCsv(proof.getOperationType()),
                    escapeCsv(proof.getRuleId()),
                    escapeCsv(proof.getTaskId()),
                    escapeCsv(proof.getObjectKey()),
                    escapeCsv(proof.getBucketName()),
                    escapeCsv(proof.getExecutionTime() != null ? proof.getExecutionTime().toString() : ""),
                    proof.getSuccess(),
                    escapeCsv(proof.getResultDetails()),
                    escapeCsv(proof.getErrorMessage()));
        }
        writer.flush();
    }

    private String escapeCsv(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}

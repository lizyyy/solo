package com.object.lifecycle.service;

import com.object.lifecycle.entity.ExecutionProof;
import com.object.lifecycle.repository.ExecutionProofRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExecutionProofService {

    private final ExecutionProofRepository proofRepository;
    private final ObjectMapper objectMapper;

    public ExecutionProof createProof(String operationType, String ruleId, String taskId,
                                      String objectKey, String bucketName, boolean success,
                                      String resultDetails, String errorMessage) {
        ExecutionProof proof = new ExecutionProof();
        proof.setProofId(UUID.randomUUID().toString());
        proof.setOperationType(operationType);
        proof.setRuleId(ruleId);
        proof.setTaskId(taskId);
        proof.setObjectKey(objectKey);
        proof.setBucketName(bucketName);
        proof.setExecutionTime(LocalDateTime.now());
        proof.setSuccess(success);
        proof.setResultDetails(resultDetails);
        proof.setErrorMessage(errorMessage);
        proof.setOperator("system");
        return proofRepository.save(proof);
    }

    public void recordRequestResponse(String proofId, Object request, Object response) {
        proofRepository.findByProofId(proofId).ifPresent(proof -> {
            try {
                if (request != null) {
                    proof.setRequestPayload(objectMapper.writeValueAsString(request));
                }
                if (response != null) {
                    proof.setResponsePayload(objectMapper.writeValueAsString(response));
                }
                proofRepository.save(proof);
            } catch (JsonProcessingException e) {
                log.warn("序列化请求/响应失败", e);
            }
        });
    }

    public List<ExecutionProof> getProofsByRuleId(String ruleId) {
        return proofRepository.findByRuleIdOrderByExecutionTimeDesc(ruleId);
    }

    public List<ExecutionProof> getProofsByObject(String objectKey, String bucketName) {
        return proofRepository.findByObjectKeyAndBucketNameOrderByExecutionTimeDesc(objectKey, bucketName);
    }

    public List<ExecutionProof> getProofsByTimeRange(LocalDateTime start, LocalDateTime end) {
        return proofRepository.findByExecutionTimeBetweenOrderByExecutionTimeDesc(start, end);
    }

    public ExecutionProof getProofById(String proofId) {
        return proofRepository.findByProofId(proofId)
                .orElseThrow(() -> new IllegalArgumentException("执行证明不存在: " + proofId));
    }
}

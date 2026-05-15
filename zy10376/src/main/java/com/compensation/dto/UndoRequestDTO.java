package com.compensation.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UndoRequestDTO {

    private Long id;
    private String requestId;
    private String businessType;
    private String businessKey;
    private String description;
    private String status;
    private String requestData;
    private Integer retryCount;
    private Integer maxRetry;
    private LocalDateTime expireTime;
    private String callbackUrl;
    private List<ExecutedActionDTO> executedActions;
    private List<CompensationTaskDTO> compensationTasks;
    private CompletionProofDTO completionProof;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

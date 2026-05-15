package com.compensation.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompletionProofDTO {

    private Long id;
    private String proofId;
    private String proofType;
    private String proofHash;
    private String proofContent;
    private String summary;
    private Integer totalActions;
    private Integer successActions;
    private Integer failedActions;
    private Integer compensatedActions;
    private Integer totalTasks;
    private Integer successTasks;
    private Integer failedTasks;
    private String generatedBy;
    private LocalDateTime generatedAt;
    private LocalDateTime createdAt;
}

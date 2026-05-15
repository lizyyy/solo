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
public class ExecutedActionDTO {

    private Long id;
    private String actionId;
    private String actionName;
    private Integer actionOrder;
    private String status;
    private String inputData;
    private String outputData;
    private String compensationContext;
    private String executedBy;
    private LocalDateTime executedAt;
    private LocalDateTime completedAt;
    private List<RevocableItemDTO> revocableItems;
    private FailureReasonDTO failureReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

package com.compensation.dto;

import com.compensation.entity.*;
import com.compensation.enums.ActionStatus;
import com.compensation.enums.CompensationStatus;
import com.compensation.enums.RequestStatus;
import org.springframework.util.CollectionUtils;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

public class DTOConverter {

    private DTOConverter() {
    }

    public static UndoRequestDTO toDTO(UndoRequest entity) {
        if (entity == null) {
            return null;
        }
        return UndoRequestDTO.builder()
                .id(entity.getId())
                .requestId(entity.getRequestId())
                .businessType(entity.getBusinessType())
                .businessKey(entity.getBusinessKey())
                .description(entity.getDescription())
                .status(Optional.ofNullable(entity.getStatus()).map(RequestStatus::name).orElse(null))
                .requestData(entity.getRequestData())
                .retryCount(entity.getRetryCount())
                .maxRetry(entity.getMaxRetry())
                .expireTime(entity.getExpireTime())
                .callbackUrl(entity.getCallbackUrl())
                .executedActions(toActionDTOList(entity.getExecutedActions()))
                .compensationTasks(toTaskDTOList(entity.getCompensationTasks()))
                .completionProof(toDTO(entity.getCompletionProof()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public static List<UndoRequestDTO> toRequestDTOList(List<UndoRequest> entities) {
        if (CollectionUtils.isEmpty(entities)) {
            return Collections.emptyList();
        }
        return entities.stream()
                .map(DTOConverter::toDTO)
                .collect(Collectors.toList());
    }

    public static ExecutedActionDTO toDTO(ExecutedAction entity) {
        if (entity == null) {
            return null;
        }
        return ExecutedActionDTO.builder()
                .id(entity.getId())
                .actionId(entity.getActionId())
                .actionName(entity.getActionName())
                .actionOrder(entity.getActionOrder())
                .status(Optional.ofNullable(entity.getStatus()).map(ActionStatus::name).orElse(null))
                .inputData(entity.getInputData())
                .outputData(entity.getOutputData())
                .compensationContext(entity.getCompensationContext())
                .executedBy(entity.getExecutedBy())
                .executedAt(entity.getExecutedAt())
                .completedAt(entity.getCompletedAt())
                .revocableItems(toItemDTOList(entity.getRevocableItems()))
                .failureReason(toDTO(entity.getFailureReason()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public static List<ExecutedActionDTO> toActionDTOList(List<ExecutedAction> entities) {
        if (CollectionUtils.isEmpty(entities)) {
            return Collections.emptyList();
        }
        return entities.stream()
                .map(DTOConverter::toDTO)
                .collect(Collectors.toList());
    }

    public static RevocableItemDTO toDTO(RevocableItem entity) {
        if (entity == null) {
            return null;
        }
        return RevocableItemDTO.builder()
                .id(entity.getId())
                .itemId(entity.getItemId())
                .itemType(entity.getItemType())
                .itemKey(entity.getItemKey())
                .itemDescription(entity.getItemDescription())
                .beforeState(entity.getBeforeState())
                .afterState(entity.getAfterState())
                .revocable(entity.getRevocable())
                .compensationMethod(entity.getCompensationMethod())
                .compensationParams(entity.getCompensationParams())
                .compensated(entity.getCompensated())
                .compensatedAt(entity.getCompensatedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public static List<RevocableItemDTO> toItemDTOList(List<RevocableItem> entities) {
        if (CollectionUtils.isEmpty(entities)) {
            return Collections.emptyList();
        }
        return entities.stream()
                .map(DTOConverter::toDTO)
                .collect(Collectors.toList());
    }

    public static CompensationTaskDTO toDTO(CompensationTask entity) {
        if (entity == null) {
            return null;
        }
        return CompensationTaskDTO.builder()
                .id(entity.getId())
                .taskId(entity.getTaskId())
                .taskName(entity.getTaskName())
                .taskOrder(entity.getTaskOrder())
                .status(Optional.ofNullable(entity.getStatus()).map(CompensationStatus::name).orElse(null))
                .taskData(entity.getTaskData())
                .taskResult(entity.getTaskResult())
                .retryCount(entity.getRetryCount())
                .maxRetry(entity.getMaxRetry())
                .nextRetryTime(entity.getNextRetryTime())
                .dependOnTaskIds(entity.getDependOnTaskIds())
                .executedBy(entity.getExecutedBy())
                .startedAt(entity.getStartedAt())
                .completedAt(entity.getCompletedAt())
                .failureReason(toDTO(entity.getFailureReason()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public static List<CompensationTaskDTO> toTaskDTOList(List<CompensationTask> entities) {
        if (CollectionUtils.isEmpty(entities)) {
            return Collections.emptyList();
        }
        return entities.stream()
                .map(DTOConverter::toDTO)
                .collect(Collectors.toList());
    }

    public static FailureReasonDTO toDTO(FailureReason entity) {
        if (entity == null) {
            return null;
        }
        return FailureReasonDTO.builder()
                .id(entity.getId())
                .failureId(entity.getFailureId())
                .errorCode(entity.getErrorCode())
                .errorMessage(entity.getErrorMessage())
                .errorDetail(entity.getErrorDetail())
                .stackTrace(entity.getStackTrace())
                .failedStep(entity.getFailedStep())
                .recoverySuggestion(entity.getRecoverySuggestion())
                .recoverable(entity.getRecoverable())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    public static CompletionProofDTO toDTO(CompletionProof entity) {
        if (entity == null) {
            return null;
        }
        return CompletionProofDTO.builder()
                .id(entity.getId())
                .proofId(entity.getProofId())
                .proofType(entity.getProofType())
                .proofHash(entity.getProofHash())
                .proofContent(entity.getProofContent())
                .summary(entity.getSummary())
                .totalActions(entity.getTotalActions())
                .successActions(entity.getSuccessActions())
                .failedActions(entity.getFailedActions())
                .compensatedActions(entity.getCompensatedActions())
                .totalTasks(entity.getTotalTasks())
                .successTasks(entity.getSuccessTasks())
                .failedTasks(entity.getFailedTasks())
                .generatedBy(entity.getGeneratedBy())
                .generatedAt(entity.getGeneratedAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}

package com.identity.verification.service;

import com.identity.verification.dto.ApiResponse;
import com.identity.verification.dto.CreateVerificationRequest;
import com.identity.verification.dto.AdvanceRequest;
import com.identity.verification.dto.VerificationResult;
import com.identity.verification.model.VerificationTask;
import com.identity.verification.model.VerificationHistory;
import com.identity.verification.model.PersonIdentifier;
import com.identity.verification.model.ConflictField;
import com.identity.verification.model.MergeSuggestion;
import com.identity.verification.model.ConfirmationRecord;
import com.identity.verification.model.IdentitySource;
import com.identity.verification.model.enums.TrustLevel;
import com.identity.verification.model.enums.VerificationStatus;
import com.identity.verification.repository.VerificationTaskRepository;
import com.identity.verification.repository.IdentitySourceRepository;
import com.identity.verification.repository.PersonIdentifierRepository;
import com.identity.verification.repository.ConflictFieldRepository;
import com.identity.verification.repository.MergeSuggestionRepository;
import com.identity.verification.repository.ConfirmationRecordRepository;
import com.identity.verification.repository.VerificationHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class VerificationService {

    private final VerificationTaskRepository taskRepository;
    private final IdentitySourceRepository sourceRepository;
    private final PersonIdentifierRepository identifierRepository;
    private final ConflictFieldRepository conflictRepository;
    private final MergeSuggestionRepository suggestionRepository;
    private final ConfirmationRecordRepository confirmationRepository;
    private final VerificationHistoryRepository historyRepository;

    private void recordHistory(Long taskId, VerificationStatus previousStatus, VerificationStatus newStatus,
                               String actionType, String operatorId, String operatorName, String description,
                               String fieldName, String finalValue, Integer conflictCount, Integer trustScore) {
        VerificationHistory history = new VerificationHistory();
        history.setTaskId(taskId);
        history.setPreviousStatus(previousStatus);
        history.setNewStatus(newStatus);
        history.setActionType(actionType);
        history.setOperatorId(operatorId);
        history.setOperatorName(operatorName);
        history.setDescription(description);
        history.setFieldName(fieldName);
        history.setFinalValue(finalValue);
        history.setConflictCount(conflictCount);
        history.setTrustScore(trustScore);
        historyRepository.save(history);
    }

    @Transactional
    public ResponseEntity<ApiResponse<VerificationResult>> createVerification(CreateVerificationRequest request) {
        if (taskRepository.existsByRequestId(request.getRequestId())) {
            VerificationTask existingTask = taskRepository.findByRequestId(request.getRequestId())
                    .orElseThrow(() -> new RuntimeException("校验任务不存在"));
            return ApiResponse.duplicateRequestEntity(buildResult(existingTask));
        }

        VerificationTask task = new VerificationTask();
        task.setRequestId(request.getRequestId());
        task.setBusinessType(request.getBusinessType());
        task.setDescription(request.getDescription());
        task.setCreatedBy(request.getCreatedBy());
        task.setStatus(VerificationStatus.CREATED);
        task = taskRepository.save(task);

        recordHistory(task.getId(), null, VerificationStatus.CREATED,
                "创建任务", request.getCreatedBy(), null,
                "创建校验任务，请求ID: " + request.getRequestId(),
                null, null, null, null);

        List<PersonIdentifier> identifiers = new ArrayList<>();
        for (CreateVerificationRequest.IdentityData identityData : request.getIdentityDataList()) {
            PersonIdentifier identifier = new PersonIdentifier();
            identifier.setTaskId(task.getId());
            identifier.setSourceCode(identityData.getSourceCode());
            identifier.setIdType(identityData.getIdType());
            identifier.setIdValue(identityData.getIdValue());
            identifier.setName(identityData.getName());
            identifier.setGender(identityData.getGender());
            identifier.setBirthDate(identityData.getBirthDate());
            identifier.setAddress(identityData.getAddress());
            identifier.setPhoneNumber(identityData.getPhoneNumber());
            identifier.setEmail(identityData.getEmail());
            identifiers.add(identifierRepository.save(identifier));
        }

        performMultiSourceVerification(task, identifiers);

        return ApiResponse.successEntity("校验任务创建成功", buildResult(task));
    }

    private void performMultiSourceVerification(VerificationTask task, List<PersonIdentifier> identifiers) {
        List<ConflictField> conflicts = new ArrayList<>();
        List<MergeSuggestion> suggestions = new ArrayList<>();

        String[] fieldsToCheck = {"name", "gender", "birthDate", "address", "phoneNumber", "email"};
        Map<String, Map<String, List<PersonIdentifier>>> fieldValuesMap = new HashMap<>();

        for (String field : fieldsToCheck) {
            fieldValuesMap.put(field, groupByFieldValue(identifiers, field));
        }

        int totalWeight = 0;
        int matchedWeight = 0;

        for (PersonIdentifier identifier : identifiers) {
            IdentitySource source = sourceRepository.findBySourceCode(identifier.getSourceCode())
                    .orElseGet(this::createDefaultSource);
            totalWeight += source.getTrustWeight();
        }

        for (String field : fieldsToCheck) {
            Map<String, List<PersonIdentifier>> valueGroups = fieldValuesMap.get(field);
            if (valueGroups.size() > 1) {
                ConflictField conflict = createConflict(task.getId(), field, valueGroups);
                conflicts.add(conflict);
            } else {
                matchedWeight += totalWeight;
            }

            MergeSuggestion suggestion = createMergeSuggestion(task.getId(), field, valueGroups);
            suggestions.add(suggestion);
        }

        conflictRepository.saveAll(conflicts);
        suggestionRepository.saveAll(suggestions);

        int trustScore = totalWeight > 0 ? (matchedWeight * 100) / (totalWeight * fieldsToCheck.length) : 0;
        task.setTrustScore(trustScore);
        task.setTrustLevel(TrustLevel.fromScore(trustScore));
        task.setConflictCount(conflicts.size());

        VerificationStatus previousStatus = task.getStatus();
        recordHistory(task.getId(), previousStatus, VerificationStatus.VERIFYING,
                "开始校验", task.getCreatedBy(), null,
                "多源校验开始，数据源数量: " + identifiers.size(),
                null, null, conflicts.size(), trustScore);

        if (conflicts.isEmpty()) {
            task.setStatus(VerificationStatus.CONFIRMED);
            task.setCompletedAt(LocalDateTime.now());
            recordHistory(task.getId(), VerificationStatus.VERIFYING, VerificationStatus.CONFIRMED,
                    "校验完成", task.getCreatedBy(), null,
                    "校验完成，无冲突，信任评分: " + trustScore,
                    null, null, 0, trustScore);
        } else {
            task.setStatus(VerificationStatus.PENDING_CONFIRM);
            recordHistory(task.getId(), VerificationStatus.VERIFYING, VerificationStatus.PENDING_CONFIRM,
                    "发现冲突", task.getCreatedBy(), null,
                    "校验完成，发现 " + conflicts.size() + " 个字段冲突，待人工确认，信任评分: " + trustScore,
                    null, null, conflicts.size(), trustScore);
        }

        taskRepository.save(task);
    }

    private Map<String, List<PersonIdentifier>> groupByFieldValue(List<PersonIdentifier> identifiers, String field) {
        return identifiers.stream()
                .collect(Collectors.groupingBy(id -> getFieldValue(id, field)));
    }

    private String getFieldValue(PersonIdentifier identifier, String field) {
        String value;
        switch (field) {
            case "name":
                value = identifier.getName();
                break;
            case "gender":
                value = identifier.getGender();
                break;
            case "birthDate":
                value = identifier.getBirthDate();
                break;
            case "address":
                value = identifier.getAddress();
                break;
            case "phoneNumber":
                value = identifier.getPhoneNumber();
                break;
            case "email":
                value = identifier.getEmail();
                break;
            default:
                value = "";
        }
        return value != null ? value : "";
    }

    private ConflictField createConflict(Long taskId, String fieldName, Map<String, List<PersonIdentifier>> valueGroups) {
        ConflictField conflict = new ConflictField();
        conflict.setTaskId(taskId);
        conflict.setFieldName(fieldName);

        Iterator<Map.Entry<String, List<PersonIdentifier>>> iterator = valueGroups.entrySet().iterator();
        if (iterator.hasNext()) {
            Map.Entry<String, List<PersonIdentifier>> entry1 = iterator.next();
            conflict.setSourceACode(entry1.getValue().get(0).getSourceCode());
            conflict.setSourceAValue(entry1.getKey());
        }
        if (iterator.hasNext()) {
            Map.Entry<String, List<PersonIdentifier>> entry2 = iterator.next();
            conflict.setSourceBCode(entry2.getValue().get(0).getSourceCode());
            conflict.setSourceBValue(entry2.getKey());
        }
        conflict.setDescription("字段 [" + fieldName + "] 在多个数据源中存在差异");
        return conflict;
    }

    private MergeSuggestion createMergeSuggestion(Long taskId, String fieldName, Map<String, List<PersonIdentifier>> valueGroups) {
        MergeSuggestion suggestion = new MergeSuggestion();
        suggestion.setTaskId(taskId);
        suggestion.setFieldName(fieldName);

        String bestValue = "";
        int bestWeight = 0;
        String bestSource = "";

        for (Map.Entry<String, List<PersonIdentifier>> entry : valueGroups.entrySet()) {
            int totalWeight = 0;
            for (PersonIdentifier id : entry.getValue()) {
                IdentitySource source = sourceRepository.findBySourceCode(id.getSourceCode())
                        .orElseGet(this::createDefaultSource);
                totalWeight += source.getTrustWeight();
            }
            if (totalWeight > bestWeight) {
                bestWeight = totalWeight;
                bestValue = entry.getKey();
                bestSource = entry.getValue().get(0).getSourceCode();
            }
        }

        suggestion.setSuggestedValue(bestValue);
        suggestion.setSuggestedSource(bestSource);
        suggestion.setConfidenceScore(bestWeight);
        suggestion.setTrustLevel(TrustLevel.fromScore(bestWeight));
        suggestion.setReasoning("基于数据源信任权重计算，建议采用 [" + bestSource + "] 的值");

        return suggestion;
    }

    private IdentitySource createDefaultSource() {
        IdentitySource source = new IdentitySource();
        source.setSourceCode("DEFAULT");
        source.setSourceName("默认数据源");
        source.setTrustWeight(50);
        source.setEnabled(true);
        return source;
    }

    public ResponseEntity<ApiResponse<VerificationResult>> getVerification(Long taskId) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));
        return ApiResponse.successEntity(buildResult(task));
    }

    public ResponseEntity<ApiResponse<VerificationResult>> getVerificationByRequestId(String requestId) {
        VerificationTask task = taskRepository.findByRequestId(requestId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));
        return ApiResponse.successEntity(buildResult(task));
    }

    @Transactional
    public ResponseEntity<ApiResponse<VerificationResult>> advanceVerification(Long taskId, AdvanceRequest request) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));

        if (task.getStatus() != VerificationStatus.PENDING_CONFIRM) {
            return ApiResponse.errorEntity(400, "当前状态不允许推进操作");
        }

        List<ConflictField> unresolvedConflicts = conflictRepository.findByTaskIdAndResolved(taskId, false);

        for (AdvanceRequest.ConflictResolution resolution : request.getResolutions()) {
            ConflictField conflict = unresolvedConflicts.stream()
                    .filter(c -> c.getId().equals(resolution.getConflictFieldId()))
                    .findFirst()
                    .orElse(null);

            if (conflict != null) {
                conflict.setResolved(true);
                conflict.setResolvedValue(resolution.getFinalValue());
                conflict.setResolvedAt(LocalDateTime.now());
                conflictRepository.save(conflict);

                ConfirmationRecord record = new ConfirmationRecord();
                record.setTaskId(taskId);
                record.setOperatorId(request.getOperatorId());
                record.setOperatorName(request.getOperatorName());
                record.setComments(request.getComments());
                record.setConflictFieldId(conflict.getId());
                record.setFieldName(conflict.getFieldName());
                record.setFinalValue(resolution.getFinalValue());
                confirmationRepository.save(record);

                recordHistory(taskId, task.getStatus(), task.getStatus(),
                        "解决冲突", request.getOperatorId(), request.getOperatorName(),
                        "解决字段冲突: " + conflict.getFieldName(),
                        conflict.getFieldName(), resolution.getFinalValue(), null, null);
            }
        }

        List<ConflictField> remainingConflicts = conflictRepository.findByTaskIdAndResolved(taskId, false);
        if (remainingConflicts.isEmpty()) {
            VerificationStatus previousStatus = task.getStatus();
            task.setStatus(VerificationStatus.MERGED);
            task.setCompletedAt(LocalDateTime.now());
            task.setFinalIdentity("已完成人工确认的最终身份数据");

            recordHistory(taskId, previousStatus, VerificationStatus.MERGED,
                    "完成合并", request.getOperatorId(), request.getOperatorName(),
                    "所有冲突已解决，校验完成合并",
                    null, null, 0, task.getTrustScore());
        }

        taskRepository.save(task);
        return ApiResponse.successEntity("校验任务已推进", buildResult(task));
    }

    @Transactional
    public ResponseEntity<ApiResponse<VerificationResult>> revokeVerification(Long taskId, String reason) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));

        VerificationStatus previousStatus = task.getStatus();
        task.setStatus(VerificationStatus.REVOKED);
        task.setDescription(task.getDescription() + " [撤销原因: " + reason + "]");

        recordHistory(taskId, previousStatus, VerificationStatus.REVOKED,
                "撤销任务", task.getCreatedBy(), null,
                "任务被撤销，原因: " + reason,
                null, null, task.getConflictCount(), task.getTrustScore());

        taskRepository.save(task);

        return ApiResponse.successEntity("校验任务已撤销", buildResult(task));
    }

    public ResponseEntity<ApiResponse<List<VerificationTask>>> listTasks(String status) {
        List<VerificationTask> tasks;
        if (status != null && !status.isEmpty()) {
            tasks = taskRepository.findByStatus(VerificationStatus.valueOf(status));
        } else {
            tasks = taskRepository.findAll();
        }
        return ApiResponse.successEntity(tasks);
    }

    public ResponseEntity<ApiResponse<List<VerificationHistory>>> getHistory(Long taskId) {
        if (!taskRepository.existsById(taskId)) {
            throw new RuntimeException("校验任务不存在");
        }
        List<VerificationHistory> history = historyRepository.findByTaskIdOrderByCreatedAtAsc(taskId);
        return ApiResponse.successEntity(history);
    }

    private VerificationResult buildResult(VerificationTask task) {
        VerificationResult result = new VerificationResult();
        result.setTaskId(task.getId());
        result.setRequestId(task.getRequestId());
        result.setStatus(task.getStatus());
        result.setStatusDescription(task.getStatus().getDescription());
        result.setTrustScore(task.getTrustScore());
        result.setTrustLevel(task.getTrustLevel());
        result.setConflictCount(task.getConflictCount());
        result.setCreatedAt(task.getCreatedAt());
        result.setCompletedAt(task.getCompletedAt());

        result.setIdentifiers(identifierRepository.findByTaskId(task.getId()));
        result.setConflicts(conflictRepository.findByTaskId(task.getId()));
        result.setSuggestions(suggestionRepository.findByTaskId(task.getId()));
        result.setConfirmations(confirmationRepository.findByTaskId(task.getId()));

        return result;
    }
}

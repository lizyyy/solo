package com.identity.verification.service;

import com.identity.verification.dto.*;
import com.identity.verification.model.*;
import com.identity.verification.model.enums.TrustLevel;
import com.identity.verification.model.enums.VerificationStatus;
import com.identity.verification.repository.*;
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
public class VerificationService {

    private final VerificationTaskRepository taskRepository;
    private final IdentitySourceRepository sourceRepository;
    private final PersonIdentifierRepository identifierRepository;
    private final ConflictFieldRepository conflictRepository;
    private final MergeSuggestionRepository suggestionRepository;
    private final ConfirmationRecordRepository confirmationRepository;

    @Transactional
    public ApiResponse<VerificationResult> createVerification(CreateVerificationRequest request) {
        if (taskRepository.existsByRequestId(request.getRequestId())) {
            VerificationTask existingTask = taskRepository.findByRequestId(request.getRequestId()).orElseThrow();
            return ApiResponse.duplicateRequest(buildResult(existingTask));
        }

        VerificationTask task = new VerificationTask();
        task.setRequestId(request.getRequestId());
        task.setBusinessType(request.getBusinessType());
        task.setDescription(request.getDescription());
        task.setCreatedBy(request.getCreatedBy());
        task.setStatus(VerificationStatus.VERIFYING);
        task = taskRepository.save(task);

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

        return ApiResponse.success("校验任务创建成功", buildResult(task));
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

        if (conflicts.isEmpty()) {
            task.setStatus(VerificationStatus.CONFIRMED);
            task.setCompletedAt(LocalDateTime.now());
        } else {
            task.setStatus(VerificationStatus.PENDING_CONFIRM);
        }

        taskRepository.save(task);
    }

    private Map<String, List<PersonIdentifier>> groupByFieldValue(List<PersonIdentifier> identifiers, String field) {
        return identifiers.stream()
                .collect(Collectors.groupingBy(id -> getFieldValue(id, field)));
    }

    private String getFieldValue(PersonIdentifier identifier, String field) {
        return switch (field) {
            case "name" -> identifier.getName();
            case "gender" -> identifier.getGender();
            case "birthDate" -> identifier.getBirthDate();
            case "address" -> identifier.getAddress();
            case "phoneNumber" -> identifier.getPhoneNumber();
            case "email" -> identifier.getEmail();
            default -> "";
        };
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

    public ApiResponse<VerificationResult> getVerification(Long taskId) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));
        return ApiResponse.success(buildResult(task));
    }

    public ApiResponse<VerificationResult> getVerificationByRequestId(String requestId) {
        VerificationTask task = taskRepository.findByRequestId(requestId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));
        return ApiResponse.success(buildResult(task));
    }

    @Transactional
    public ApiResponse<VerificationResult> advanceVerification(Long taskId, AdvanceRequest request) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));

        if (task.getStatus() != VerificationStatus.PENDING_CONFIRM) {
            return ApiResponse.error(400, "当前状态不允许推进操作");
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
            }
        }

        List<ConflictField> remainingConflicts = conflictRepository.findByTaskIdAndResolved(taskId, false);
        if (remainingConflicts.isEmpty()) {
            task.setStatus(VerificationStatus.MERGED);
            task.setCompletedAt(LocalDateTime.now());
            task.setFinalIdentity("已完成人工确认的最终身份数据");
        }

        taskRepository.save(task);
        return ApiResponse.success("校验任务已推进", buildResult(task));
    }

    @Transactional
    public ApiResponse<VerificationResult> revokeVerification(Long taskId, String reason) {
        VerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("校验任务不存在"));

        task.setStatus(VerificationStatus.REVOKED);
        task.setDescription(task.getDescription() + " [撤销原因: " + reason + "]");
        taskRepository.save(task);

        return ApiResponse.success("校验任务已撤销", buildResult(task));
    }

    public ApiResponse<List<VerificationTask>> listTasks(String status) {
        List<VerificationTask> tasks;
        if (status != null && !status.isEmpty()) {
            tasks = taskRepository.findByStatus(VerificationStatus.valueOf(status));
        } else {
            tasks = taskRepository.findAll();
        }
        return ApiResponse.success(tasks);
    }

    public ApiResponse<List<VerificationHistory>> getHistory(Long taskId) {
        List<ConfirmationRecord> records = confirmationRepository.findByTaskId(taskId);
        List<VerificationHistory> history = records.stream()
                .map(r -> {
                    VerificationHistory h = new VerificationHistory();
                    h.setTimestamp(r.getCreatedAt());
                    h.setOperator(r.getOperatorName());
                    h.setAction("人工确认");
                    h.setFieldName(r.getFieldName());
                    h.setFinalValue(r.getFinalValue());
                    h.setComments(r.getComments());
                    return h;
                })
                .collect(Collectors.toList());
        return ApiResponse.success(history);
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

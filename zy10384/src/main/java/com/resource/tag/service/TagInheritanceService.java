package com.resource.tag.service;

import com.resource.tag.dto.*;
import com.resource.tag.model.*;
import com.resource.tag.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TagInheritanceService {

    private final InheritanceTaskRepository taskRepository;
    private final ResourceNodeRepository nodeRepository;
    private final OverrideRuleRepository ruleRepository;
    private final ConflictItemRepository conflictRepository;
    private final CalculationResultRepository resultRepository;
    private final ChangeHistoryRepository historyRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ApiResponse<TaskStatusResponse> createTask(CreateTaskRequest request) {
        log.info("Creating inheritance task for requestId: {}", request.getRequestId());

        if (taskRepository.existsByRequestId(request.getRequestId())) {
            InheritanceTask existingTask = taskRepository.findByRequestId(request.getRequestId())
                    .orElseThrow();
            log.warn("Duplicate request detected: {}", request.getRequestId());
            return ApiResponse.duplicate("Duplicate request - task already exists", 
                toTaskStatusResponse(existingTask));
        }

        if (!nodeRepository.existsByNodeId(request.getTargetNodeId())) {
            return ApiResponse.error(404, "Target node not found: " + request.getTargetNodeId());
        }

        InheritanceTask task = new InheritanceTask();
        task.setTaskId(UUID.randomUUID().toString());
        task.setRequestId(request.getRequestId());
        task.setTargetNodeId(request.getTargetNodeId());
        task.setStatus(TaskStatus.PENDING);
        task.setCreatedBy(request.getCreatedBy());
        taskRepository.save(task);

        log.info("Task created: {}", task.getTaskId());
        return ApiResponse.success(toTaskStatusResponse(task));
    }

    @Transactional
    public ApiResponse<TaskStatusResponse> validateTask(String taskId) {
        log.info("Validating task: {}", taskId);

        InheritanceTask task = taskRepository.findByTaskId(taskId)
                .orElse(null);

        if (task == null) {
            return ApiResponse.error(404, "Task not found");
        }

        if (task.getStatus() != TaskStatus.PENDING) {
            return ApiResponse.error(400, "Task status is not PENDING, current status: " + task.getStatus());
        }

        task.setStatus(TaskStatus.VALIDATING);
        task.setStartedAt(LocalDateTime.now());
        taskRepository.save(task);

        try {
            ResourceNode node = nodeRepository.findByNodeId(task.getTargetNodeId())
                    .orElseThrow(() -> new RuntimeException("Node not found"));
            
            validateAncestry(node);
            
            task.setStatus(TaskStatus.INHERITING);
            taskRepository.save(task);
            
            return ApiResponse.success(toTaskStatusResponse(task));
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setErrorMessage(e.getMessage());
            taskRepository.save(task);
            return ApiResponse.error(500, "Validation failed: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<TaskStatusResponse> calculateInheritance(String taskId) {
        log.info("Calculating inheritance for task: {}", taskId);

        InheritanceTask task = taskRepository.findByTaskId(taskId)
                .orElse(null);

        if (task == null) {
            return ApiResponse.error(404, "Task not found");
        }

        if (task.getStatus() != TaskStatus.INHERITING) {
            return ApiResponse.error(400, "Task not ready for inheritance calculation");
        }

        try {
            Map<String, List<String>> conflicts = new HashMap<>();
            List<CalculationResult> results = new ArrayList<>();

            ResourceNode targetNode = nodeRepository.findByNodeId(task.getTargetNodeId())
                    .orElseThrow();

            Map<String, TagValue> inheritedTags = collectInheritedTags(targetNode);

            List<OverrideRule> rules = ruleRepository.findByTargetNodeIdAndEnabledTrue(task.getTargetNodeId());
            applyOverrideRules(inheritedTags, rules);

            for (Map.Entry<String, TagValue> entry : inheritedTags.entrySet()) {
                if (entry.getValue().hasConflict()) {
                    conflicts.put(entry.getKey(), entry.getValue().getConflictingValues());
                    createConflictItem(taskId, targetNode.getNodeId(), entry.getKey(), entry.getValue());
                }

                CalculationResult result = new CalculationResult();
                result.setTaskId(taskId);
                result.setNodeId(targetNode.getNodeId());
                result.setTagKey(entry.getKey());
                result.setTagValue(entry.getValue().getFinalValue());
                result.setSourceNodeId(entry.getValue().getSourceNodeId());
                result.setIsInherited(entry.getValue().isInherited());
                result.setPriority(entry.getValue().getPriority());
                results.add(result);
            }

            resultRepository.saveAll(results);

            if (!conflicts.isEmpty()) {
                task.setStatus(TaskStatus.CONFLICT);
                task.setConflictCount(conflicts.size());
            } else {
                task.setStatus(TaskStatus.COMPLETED);
                task.setCompletedAt(LocalDateTime.now());
            }
            task.setCalculatedTags(results.size());
            taskRepository.save(task);

            recordHistory(taskId, targetNode.getNodeId(), "INHERITANCE_CALCULATED", 
                "system", null, objectMapper.writeValueAsString(results));

            return ApiResponse.success(toTaskStatusResponse(task));
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setErrorMessage(e.getMessage());
            taskRepository.save(task);
            return ApiResponse.error(500, "Calculation failed: " + e.getMessage());
        }
    }

    @Transactional
    public ApiResponse<TaskStatusResponse> resolveConflict(String taskId, Long conflictId, 
                                                           ConflictResolutionRequest request) {
        log.info("Resolving conflict {} for task: {}", conflictId, taskId);

        InheritanceTask task = taskRepository.findByTaskId(taskId)
                .orElse(null);

        if (task == null) {
            return ApiResponse.error(404, "Task not found");
        }

        if (task.getStatus() != TaskStatus.CONFLICT) {
            return ApiResponse.error(400, "Task not in CONFLICT state");
        }

        ConflictItem conflict = conflictRepository.findById(conflictId)
                .orElse(null);

        if (conflict == null) {
            return ApiResponse.error(404, "Conflict not found");
        }

        conflict.setResolution(request.getResolution());
        conflict.setResolvedBy(request.getResolvedBy());
        conflict.setResolvedAt(LocalDateTime.now());

        String resolvedValue = determineResolvedValue(conflict, request);
        conflict.setResolvedValue(resolvedValue);
        conflictRepository.save(conflict);

        updateCalculationResult(taskId, conflict, resolvedValue);

        long pendingConflicts = conflictRepository.findByTaskIdAndResolution(
                taskId, ConflictItem.ConflictResolution.PENDING).size();

        if (pendingConflicts == 0) {
            task.setStatus(TaskStatus.COMPLETED);
            task.setCompletedAt(LocalDateTime.now());
            taskRepository.save(task);
        }

        recordHistory(taskId, conflict.getNodeId(), "CONFLICT_RESOLVED", 
            request.getResolvedBy(), null, "Resolved " + conflict.getTagKey() + " with " + request.getResolution());

        return ApiResponse.success(toTaskStatusResponse(task));
    }

    @Cacheable(value = "taskStatus", key = "#taskId")
    public ApiResponse<TaskStatusResponse> getTaskStatus(String taskId) {
        InheritanceTask task = taskRepository.findByTaskId(taskId)
                .orElse(null);

        if (task == null) {
            return ApiResponse.error(404, "Task not found");
        }

        return ApiResponse.success(toTaskStatusResponse(task));
    }

    public ApiResponse<List<ConflictItem>> getTaskConflicts(String taskId) {
        List<ConflictItem> conflicts = conflictRepository.findByTaskId(taskId);
        return ApiResponse.success(conflicts);
    }

    public ApiResponse<List<CalculationResult>> getTaskResults(String taskId) {
        List<CalculationResult> results = resultRepository.findByTaskId(taskId);
        return ApiResponse.success(results);
    }

    public ApiResponse<List<ChangeHistory>> getTaskHistory(String taskId) {
        List<ChangeHistory> history = historyRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
        return ApiResponse.success(history);
    }

    public ApiResponse<List<ChangeHistory>> exportHistory(String taskId) {
        return getTaskHistory(taskId);
    }

    @CacheEvict(value = "taskStatus", key = "#taskId")
    public void clearTaskCache(String taskId) {
        log.info("Cache cleared for task: {}", taskId);
    }

    private void validateAncestry(ResourceNode node) {
        Set<String> visited = new HashSet<>();
        String current = node.getNodeId();

        while (current != null) {
            if (visited.contains(current)) {
                throw new RuntimeException("Circular reference detected in ancestry chain");
            }
            visited.add(current);

            ResourceNode currentNode = nodeRepository.findByNodeId(current).orElse(null);
            if (currentNode == null) break;
            current = currentNode.getParentNodeId();
        }
    }

    private Map<String, TagValue> collectInheritedTags(ResourceNode node) {
        Map<String, TagValue> tags = new HashMap<>();
        List<String> ancestry = getAncestry(node);
        Collections.reverse(ancestry);

        for (String ancestorId : ancestry) {
            ResourceNode ancestor = nodeRepository.findByNodeId(ancestorId).orElse(null);
            if (ancestor == null) continue;

            for (Tag tag : ancestor.getTags()) {
                TagValue existing = tags.get(tag.getKey());
                if (existing == null) {
                    existing = new TagValue();
                    tags.put(tag.getKey(), existing);
                }
                existing.addValue(tag.getValue(), tag.getPriority(), ancestorId, true);
            }
        }

        for (Tag tag : node.getTags()) {
            TagValue existing = tags.get(tag.getKey());
            if (existing == null) {
                existing = new TagValue();
                tags.put(tag.getKey(), existing);
            }
            existing.addValue(tag.getValue(), tag.getPriority(), node.getNodeId(), false);
        }

        return tags;
    }

    private List<String> getAncestry(ResourceNode node) {
        List<String> ancestry = new ArrayList<>();
        String current = node.getParentNodeId();

        while (current != null) {
            ancestry.add(current);
            ResourceNode parent = nodeRepository.findByNodeId(current).orElse(null);
            if (parent == null) break;
            current = parent.getParentNodeId();
        }

        return ancestry;
    }

    private void applyOverrideRules(Map<String, TagValue> tags, List<OverrideRule> rules) {
        for (OverrideRule rule : rules) {
            TagValue tagValue = tags.get(rule.getTagKey());
            if (tagValue == null) {
                tagValue = new TagValue();
                tags.put(rule.getTagKey(), tagValue);
            }
            tagValue.addOverride(rule.getOverrideValue(), rule.getPriority());
        }
    }

    private void createConflictItem(String taskId, String nodeId, String tagKey, TagValue tagValue) {
        ConflictItem conflict = new ConflictItem();
        conflict.setTaskId(taskId);
        conflict.setNodeId(nodeId);
        conflict.setTagKey(tagKey);
        conflict.setConflictingValues(String.join("|", tagValue.getConflictingValues()));
        conflict.setResolution(ConflictItem.ConflictResolution.PENDING);
        conflictRepository.save(conflict);
    }

    private String determineResolvedValue(ConflictItem conflict, ConflictResolutionRequest request) {
        return switch (request.getResolution()) {
            case PARENT_WINS -> conflict.getConflictingValues().split("\\|")[0];
            case CHILD_WINS -> conflict.getConflictingValues().split("\\|")[1];
            case MANUAL_OVERRIDE -> request.getResolvedValue();
            case SKIP -> null;
            default -> null;
        };
    }

    private void updateCalculationResult(String taskId, ConflictItem conflict, String resolvedValue) {
        List<CalculationResult> results = resultRepository.findByTaskId(taskId);
        for (CalculationResult result : results) {
            if (result.getTagKey().equals(conflict.getTagKey())) {
                result.setTagValue(resolvedValue);
                resultRepository.save(result);
                break;
            }
        }
    }

    private void recordHistory(String taskId, String nodeId, String operation, 
                               String operator, String oldValue, String details) {
        ChangeHistory history = new ChangeHistory();
        history.setTaskId(taskId);
        history.setNodeId(nodeId);
        history.setTagKey("*");
        history.setOperationType(operation);
        history.setOperator(operator);
        history.setOldValue(oldValue);
        history.setChangeDetails(details);
        historyRepository.save(history);
    }

    private TaskStatusResponse toTaskStatusResponse(InheritanceTask task) {
        return TaskStatusResponse.builder()
                .taskId(task.getTaskId())
                .requestId(task.getRequestId())
                .targetNodeId(task.getTargetNodeId())
                .status(task.getStatus())
                .errorMessage(task.getErrorMessage())
                .conflictCount(task.getConflictCount())
                .calculatedTags(task.getCalculatedTags())
                .createdBy(task.getCreatedBy())
                .createdAt(task.getCreatedAt())
                .completedAt(task.getCompletedAt())
                .build();
    }

    private static class TagValue {
        private String finalValue;
        private String sourceNodeId;
        private int priority = -1;
        private boolean inherited;
        private final List<String> values = new ArrayList<>();

        void addValue(String value, int priority, String sourceNodeId, boolean inherited) {
            values.add(value);
            if (priority > this.priority) {
                this.finalValue = value;
                this.sourceNodeId = sourceNodeId;
                this.priority = priority;
                this.inherited = inherited;
            } else if (priority == this.priority && !Objects.equals(this.finalValue, value)) {
                this.values.add(value);
            }
        }

        void addOverride(String value, int priority) {
            this.finalValue = value;
            this.priority = priority;
            this.sourceNodeId = "OVERRIDE_RULE";
            this.inherited = false;
        }

        boolean hasConflict() {
            return values.size() > 1;
        }

        List<String> getConflictingValues() {
            return values;
        }

        String getFinalValue() { return finalValue; }
        String getSourceNodeId() { return sourceNodeId; }
        int getPriority() { return priority; }
        boolean isInherited() { return inherited; }
    }
}

package com.pottery.kilnqueue.service;

import com.pottery.kilnqueue.entity.Glaze;
import com.pottery.kilnqueue.entity.KilnBatch;
import com.pottery.kilnqueue.entity.QueueRecord;
import com.pottery.kilnqueue.entity.Work;
import com.pottery.kilnqueue.repository.GlazeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ValidationService {

    private static final Logger log = LoggerFactory.getLogger(ValidationService.class);
    private final GlazeRepository glazeRepository;

    public ValidationService(GlazeRepository glazeRepository) {
        this.glazeRepository = glazeRepository;
    }

    public static class ValidationResult {
        private final boolean valid;
        private final String conflictType;
        private final String message;
        private final Object details;

        private ValidationResult(boolean valid, String conflictType, String message, Object details) {
            this.valid = valid;
            this.conflictType = conflictType;
            this.message = message;
            this.details = details;
        }

        public static ValidationResult success() {
            return new ValidationResult(true, null, null, null);
        }

        public static ValidationResult failure(String conflictType, String message, Object details) {
            return new ValidationResult(false, conflictType, message, details);
        }

        public boolean isValid() { return valid; }
        public String getConflictType() { return conflictType; }
        public String getMessage() { return message; }
        public Object getDetails() { return details; }
    }

    public ValidationResult validateGlazeCompatibility(Work work) {
        List<String> glazeCodes = work.getGlazeCodeList();
        if (glazeCodes.isEmpty()) {
            return ValidationResult.success();
        }

        List<Glaze> glazes = glazeRepository.findByCodeIn(new HashSet<>(glazeCodes));
        Map<String, Glaze> glazeMap = new HashMap<>();
        for (Glaze g : glazes) {
            glazeMap.put(g.getCode(), g);
        }

        List<Map<String, String>> conflicts = new ArrayList<>();

        for (int i = 0; i < glazeCodes.size(); i++) {
            for (int j = i + 1; j < glazeCodes.size(); j++) {
                String code1 = glazeCodes.get(i);
                String code2 = glazeCodes.get(j);

                Glaze g1 = glazeMap.get(code1);
                Glaze g2 = glazeMap.get(code2);

                if (g1 != null && g1.getConflictGlazeSet().contains(code2)) {
                    Map<String, String> conflict = new HashMap<>();
                    conflict.put("glaze1", code1);
                    conflict.put("glaze2", code2);
                    conflict.put("reason", g1.getName() + " 与 " + (g2 != null ? g2.getName() : code2) + " 冲突");
                    conflicts.add(conflict);
                }

                if (g2 != null && g2.getConflictGlazeSet().contains(code1)) {
                    Map<String, String> conflict = new HashMap<>();
                    conflict.put("glaze1", code2);
                    conflict.put("glaze2", code1);
                    conflict.put("reason", g2.getName() + " 与 " + (g1 != null ? g1.getName() : code1) + " 冲突");
                    conflicts.add(conflict);
                }
            }
        }

        if (!conflicts.isEmpty()) {
            return ValidationResult.failure("GLAZE_CONFLICT", "检测到釉料冲突", conflicts);
        }

        return ValidationResult.success();
    }

    public ValidationResult validateSize(Work work, KilnBatch batch) {
        if (batch.getMaxWidth() == null && batch.getMaxHeight() == null && batch.getMaxDepth() == null) {
            return ValidationResult.success();
        }

        Map<String, Object> sizeInfo = new HashMap<>();
        sizeInfo.put("workWidth", work.getWidth());
        sizeInfo.put("workHeight", work.getHeight());
        sizeInfo.put("workDepth", work.getDepth());
        sizeInfo.put("batchMaxWidth", batch.getMaxWidth());
        sizeInfo.put("batchMaxHeight", batch.getMaxHeight());
        sizeInfo.put("batchMaxDepth", batch.getMaxDepth());

        List<String> issues = new ArrayList<>();

        if (work.getWidth() != null && batch.getMaxWidth() != null
                && work.getWidth().compareTo(batch.getMaxWidth()) > 0) {
            issues.add("宽度超出: 作品" + work.getWidth() + "cm > 窑炉" + batch.getMaxWidth() + "cm");
        }

        if (work.getHeight() != null && batch.getMaxHeight() != null
                && work.getHeight().compareTo(batch.getMaxHeight()) > 0) {
            issues.add("高度超出: 作品" + work.getHeight() + "cm > 窑炉" + batch.getMaxHeight() + "cm");
        }

        if (work.getDepth() != null && batch.getMaxDepth() != null
                && work.getDepth().compareTo(batch.getMaxDepth()) > 0) {
            issues.add("深度超出: 作品" + work.getDepth() + "cm > 窑炉" + batch.getMaxDepth() + "cm");
        }

        if (!issues.isEmpty()) {
            sizeInfo.put("issues", issues);
            return ValidationResult.failure("SIZE_EXCEEDED", "作品尺寸超出窑炉限制", sizeInfo);
        }

        return ValidationResult.success();
    }

    public ValidationResult validateBatchGlazeCompatibility(Work newWork, List<QueueRecord> existingRecords) {
        List<String> newGlazeCodes = newWork.getGlazeCodeList();
        if (newGlazeCodes.isEmpty()) {
            return ValidationResult.success();
        }

        Set<String> allExistingGlazes = new HashSet<>();
        for (QueueRecord record : existingRecords) {
            allExistingGlazes.addAll(record.getWork().getGlazeCodeList());
        }

        if (allExistingGlazes.isEmpty()) {
            return ValidationResult.success();
        }

        List<Glaze> newGlazes = glazeRepository.findByCodeIn(new HashSet<>(newGlazeCodes));
        List<Map<String, String>> conflicts = new ArrayList<>();

        for (Glaze newGlaze : newGlazes) {
            Set<String> conflictSet = newGlaze.getConflictGlazeSet();
            for (String existingGlaze : allExistingGlazes) {
                if (conflictSet.contains(existingGlaze)) {
                    Map<String, String> conflict = new HashMap<>();
                    conflict.put("newGlaze", newGlaze.getCode());
                    conflict.put("existingGlaze", existingGlaze);
                    conflict.put("reason", newGlaze.getName() + " 与批次内现有釉料 " + existingGlaze + " 冲突");
                    conflicts.add(conflict);
                }
            }
        }

        if (!conflicts.isEmpty()) {
            return ValidationResult.failure("BATCH_GLAZE_CONFLICT", "与批次内现有作品釉料冲突", conflicts);
        }

        return ValidationResult.success();
    }
}

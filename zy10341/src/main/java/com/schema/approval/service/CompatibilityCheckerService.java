package com.schema.approval.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.schema.approval.entity.EventTopic;
import com.schema.approval.entity.SchemaVersion;
import com.schema.approval.enums.CompatibilityLevel;
import com.schema.approval.exception.BusinessException;
import com.schema.approval.exception.ErrorCode;
import com.schema.approval.repository.SchemaVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompatibilityCheckerService {
    private final SchemaVersionRepository schemaVersionRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CompatibilityCheckResult checkCompatibility(SchemaVersion newSchema) {
        EventTopic topic = newSchema.getTopic();
        CompatibilityLevel level = topic.getCompatibilityLevel();

        if (level == CompatibilityLevel.NONE) {
            return new CompatibilityCheckResult(true, "No compatibility check required");
        }

        Optional<SchemaVersion> latestVersion = schemaVersionRepository.findByTopicAndIsLatestTrue(topic);
        if (!latestVersion.isPresent()) {
            return new CompatibilityCheckResult(true, "First version, no compatibility check needed");
        }

        SchemaVersion oldSchema = latestVersion.get();
        return checkSchemaCompatibility(oldSchema, newSchema, level);
    }

    private CompatibilityCheckResult checkSchemaCompatibility(
            SchemaVersion oldSchema, SchemaVersion newSchema, CompatibilityLevel level) {

        try {
            JsonNode oldSchemaNode = objectMapper.readTree(oldSchema.getSchemaContent());
            JsonNode newSchemaNode = objectMapper.readTree(newSchema.getSchemaContent());

            switch (level) {
                case BACKWARD:
                    return checkBackwardCompatibility(oldSchemaNode, newSchemaNode);
                case FORWARD:
                    return checkForwardCompatibility(oldSchemaNode, newSchemaNode);
                case FULL:
                    CompatibilityCheckResult backward = checkBackwardCompatibility(oldSchemaNode, newSchemaNode);
                    CompatibilityCheckResult forward = checkForwardCompatibility(oldSchemaNode, newSchemaNode);
                    if (backward.isCompatible() && forward.isCompatible()) {
                        return new CompatibilityCheckResult(true, "Full compatibility check passed");
                    } else {
                        return new CompatibilityCheckResult(false,
                                backward.getDetails() + "; " + forward.getDetails());
                    }
                default:
                    return new CompatibilityCheckResult(true, "Default compatibility check passed");
            }
        } catch (Exception e) {
            log.error("Failed to parse schema content", e);
            return new CompatibilityCheckResult(false, "Schema parse error: " + e.getMessage());
        }
    }

    private CompatibilityCheckResult checkBackwardCompatibility(JsonNode oldSchema, JsonNode newSchema) {
        List<String> issues = new ArrayList<>();

        JsonNode oldFields = oldSchema.has("fields") ? oldSchema.get("fields") : null;
        JsonNode newFields = newSchema.has("fields") ? newSchema.get("fields") : null;

        if (oldFields == null || !oldFields.isArray() || newFields == null || !newFields.isArray()) {
            return new CompatibilityCheckResult(true, "Simple schema format, backward compatible");
        }

        Set<String> newFieldNames = new HashSet<>();
        Iterator<JsonNode> newIter = newFields.elements();
        while (newIter.hasNext()) {
            JsonNode field = newIter.next();
            if (field.has("name")) {
                newFieldNames.add(field.get("name").asText());
            }
        }

        Iterator<JsonNode> oldIter = oldFields.elements();
        while (oldIter.hasNext()) {
            JsonNode oldField = oldIter.next();
            if (oldField.has("name")) {
                String fieldName = oldField.get("name").asText();
                if (!newFieldNames.contains(fieldName)) {
                    issues.add("Removed field in new schema: " + fieldName);
                }
            }
        }

        if (issues.isEmpty()) {
            return new CompatibilityCheckResult(true, "Backward compatibility check passed");
        } else {
            return new CompatibilityCheckResult(false, "Backward compatibility failed: " + String.join(", ", issues));
        }
    }

    private CompatibilityCheckResult checkForwardCompatibility(JsonNode oldSchema, JsonNode newSchema) {
        List<String> issues = new ArrayList<>();

        JsonNode oldFields = oldSchema.has("fields") ? oldSchema.get("fields") : null;
        JsonNode newFields = newSchema.has("fields") ? newSchema.get("fields") : null;

        if (oldFields == null || !oldFields.isArray() || newFields == null || !newFields.isArray()) {
            return new CompatibilityCheckResult(true, "Simple schema format, forward compatible");
        }

        Set<String> oldFieldNames = new HashSet<>();
        Iterator<JsonNode> oldIter = oldFields.elements();
        while (oldIter.hasNext()) {
            JsonNode field = oldIter.next();
            if (field.has("name")) {
                oldFieldNames.add(field.get("name").asText());
            }
        }

        Iterator<JsonNode> newIter = newFields.elements();
        while (newIter.hasNext()) {
            JsonNode newField = newIter.next();
            if (newField.has("name")) {
                String fieldName = newField.get("name").asText();
                if (!oldFieldNames.contains(fieldName)) {
                    if (!newField.has("default")) {
                        issues.add("New field without default value: " + fieldName);
                    }
                }
            }
        }

        if (issues.isEmpty()) {
            return new CompatibilityCheckResult(true, "Forward compatibility check passed");
        } else {
            return new CompatibilityCheckResult(false, "Forward compatibility failed: " + String.join(", ", issues));
        }
    }

    public static class CompatibilityCheckResult {
        private final boolean compatible;
        private final String details;

        public CompatibilityCheckResult(boolean compatible, String details) {
            this.compatible = compatible;
            this.details = details;
        }

        public boolean isCompatible() {
            return compatible;
        }

        public String getDetails() {
            return details;
        }
    }
}

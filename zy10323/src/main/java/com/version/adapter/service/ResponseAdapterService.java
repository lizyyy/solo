package com.version.adapter.service;

import com.version.adapter.dto.AdaptRequest;
import com.version.adapter.dto.AdaptResponse;
import com.version.adapter.entity.*;
import com.version.adapter.entity.enums.WarningLevel;
import com.version.adapter.exception.VersionAdapterException;
import com.version.adapter.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class ResponseAdapterService {

    private final ClientVersionRepository clientVersionRepository;
    private final ResponseTemplateRepository responseTemplateRepository;
    private final VersionTemplateMappingRepository versionTemplateMappingRepository;
    private final FieldMappingRepository fieldMappingRepository;
    private final DefaultValueRepository defaultValueRepository;
    private final CompatibilityWarningRepository compatibilityWarningRepository;
    private final InvocationSampleRepository invocationSampleRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public AdaptResponse adaptResponse(AdaptRequest request) {
        long startTime = System.currentTimeMillis();
        String requestId = request.getRequestId() != null ? request.getRequestId() : UUID.randomUUID().toString();

        List<Map<String, Object>> warnings = new ArrayList<>();

        try {
            ClientVersion clientVersion = identifyVersion(request.getClientVersion());

            if (clientVersion.getIsDeprecated()) {
                warnings.add(createWarningMap("DEPRECATED_VERSION", WarningLevel.WARNING,
                        "客户端版本已弃用", "version", "建议升级到最新版本"));
            }

            ResponseTemplate template = findTemplate(clientVersion.getId(), request.getApiEndpoint(), request.getHttpMethod());

            List<FieldMapping> fieldMappings = fieldMappingRepository.findByTemplateIdAndIsActiveTrueOrderBySortOrder(template.getId());

            Object adaptedResponse = performAdaptation(request.getOriginalResponse(), fieldMappings, warnings);

            checkCompatibilityWarnings(clientVersion, template, warnings);

            long adaptationTimeMs = System.currentTimeMillis() - startTime;

            saveInvocationSample(requestId, clientVersion.getId(), template.getId(),
                    request.getOriginalResponse(), adaptedResponse,
                    adaptationTimeMs, !warnings.isEmpty(), false, null,
                    request.getInvokedBy());

            saveWarnings(clientVersion.getId(), template.getId(), warnings, request.getInvokedBy());

            return AdaptResponse.builder()
                    .requestId(requestId)
                    .clientVersion(clientVersion.getVersionNumber())
                    .adaptedResponse(adaptedResponse)
                    .warnings(warnings)
                    .hasWarnings(!warnings.isEmpty())
                    .hasErrors(false)
                    .adaptationTimeMs(adaptationTimeMs)
                    .build();

        } catch (Exception e) {
            log.error("响应适配失败", e);
            long adaptationTimeMs = System.currentTimeMillis() - startTime;

            return AdaptResponse.builder()
                    .requestId(requestId)
                    .clientVersion(request.getClientVersion())
                    .adaptedResponse(null)
                    .warnings(warnings)
                    .hasWarnings(!warnings.isEmpty())
                    .hasErrors(true)
                    .errorMessage(e.getMessage())
                    .adaptationTimeMs(adaptationTimeMs)
                    .build();
        }
    }

    private ClientVersion identifyVersion(String versionNumber) {
        return clientVersionRepository.findByVersionNumber(versionNumber)
                .orElseThrow(() -> new VersionAdapterException("VERSION_NOT_FOUND",
                        "未找到匹配的客户端版本: " + versionNumber));
    }

    private ResponseTemplate findTemplate(Long clientVersionId, String apiEndpoint, String httpMethod) {
        List<VersionTemplateMapping> mappings = versionTemplateMappingRepository
                .findByClientVersionIdAndIsActiveTrue(clientVersionId);

        if (mappings.isEmpty()) {
            throw new VersionAdapterException("NO_TEMPLATE_MAPPING",
                    "该客户端版本没有配置任何响应模板");
        }

        for (VersionTemplateMapping mapping : mappings) {
            ResponseTemplate template = responseTemplateRepository.findById(mapping.getTemplateId())
                    .orElse(null);
            if (template != null && template.getIsActive() &&
                    template.getApiEndpoint().equals(apiEndpoint) &&
                    template.getHttpMethod().equalsIgnoreCase(httpMethod)) {
                return template;
            }
        }

        throw new VersionAdapterException("TEMPLATE_NOT_FOUND",
                String.format("未找到匹配的响应模板: %s %s", httpMethod, apiEndpoint));
    }

    @SuppressWarnings("unchecked")
    private Object performAdaptation(Object originalResponse, List<FieldMapping> fieldMappings,
                                     List<Map<String, Object>> warnings) {
        Map<String, Object> originalMap;
        if (originalResponse instanceof Map) {
            originalMap = (Map<String, Object>) originalResponse;
        } else {
            originalMap = objectMapper.convertValue(originalResponse, new TypeReference<Map<String, Object>>() {});
        }

        Map<String, Object> adaptedMap = new LinkedHashMap<>();

        for (FieldMapping fieldMapping : fieldMappings) {
            String sourceField = fieldMapping.getSourceField();
            String targetField = fieldMapping.getTargetField();

            Object value = getNestedValue(originalMap, sourceField);

            if (value == null) {
                Optional<DefaultValue> defaultValue = defaultValueRepository
                        .findByFieldMappingIdAndIsActiveTrue(fieldMapping.getId());
                if (defaultValue.isPresent()) {
                    value = convertValue(defaultValue.get().getDefaultValue(), defaultValue.get().getValueType());
                    warnings.add(createWarningMap("DEFAULT_VALUE_USED", WarningLevel.INFO,
                            String.format("字段 %s 使用默认值", sourceField), sourceField, null));
                } else if (Boolean.TRUE.equals(fieldMapping.getIsRequired())) {
                    warnings.add(createWarningMap("MISSING_REQUIRED_FIELD", WarningLevel.ERROR,
                            String.format("缺少必填字段: %s", sourceField), sourceField, null));
                }
            }

            if (fieldMapping.getTransformationRule() != null && !fieldMapping.getTransformationRule().isEmpty()) {
                value = applyTransformation(value, fieldMapping.getTransformationRule());
            }

            setNestedValue(adaptedMap, targetField, value);
        }

        return adaptedMap;
    }

    private Object getNestedValue(Map<String, Object> map, String path) {
        String[] parts = path.split("\\.");
        Object current = map;

        for (String part : parts) {
            if (current instanceof Map) {
                current = ((Map<?, ?>) current).get(part);
            } else {
                return null;
            }
        }

        return current;
    }

    @SuppressWarnings("unchecked")
    private void setNestedValue(Map<String, Object> map, String path, Object value) {
        String[] parts = path.split("\\.");
        Map<String, Object> current = map;

        for (int i = 0; i < parts.length - 1; i++) {
            String part = parts[i];
            if (!current.containsKey(part) || !(current.get(part) instanceof Map)) {
                current.put(part, new LinkedHashMap<String, Object>());
            }
            current = (Map<String, Object>) current.get(part);
        }

        current.put(parts[parts.length - 1], value);
    }

    private Object convertValue(String value, String valueType) {
        try {
            switch (valueType.toLowerCase()) {
                case "string":
                    return value;
                case "number":
                case "integer":
                    return Long.parseLong(value);
                case "float":
                case "double":
                    return Double.parseDouble(value);
                case "boolean":
                    return Boolean.parseBoolean(value);
                default:
                    return value;
            }
        } catch (Exception e) {
            log.warn("值类型转换失败: {} -> {}", value, valueType);
            return value;
        }
    }

    private Object applyTransformation(Object value, String transformationRule) {
        log.debug("应用转换规则: {} -> {}", value, transformationRule);
        return value;
    }

    private void checkCompatibilityWarnings(ClientVersion clientVersion, ResponseTemplate template,
                                            List<Map<String, Object>> warnings) {
        List<CompatibilityWarning> existingWarnings = compatibilityWarningRepository
                .findByClientVersionIdAndTemplateId(clientVersion.getId(), template.getId());

        for (CompatibilityWarning warning : existingWarnings) {
            if (!warning.getIsResolved()) {
                warnings.add(createWarningMap(
                        warning.getWarningCode(),
                        warning.getLevel(),
                        warning.getMessage(),
                        warning.getAffectedField(),
                        warning.getSuggestion()
                ));
            }
        }
    }

    private Map<String, Object> createWarningMap(String code, WarningLevel level, String message,
                                                 String affectedField, String suggestion) {
        Map<String, Object> warning = new LinkedHashMap<>();
        warning.put("code", code);
        warning.put("level", level.name());
        warning.put("message", message);
        if (affectedField != null) {
            warning.put("affectedField", affectedField);
        }
        if (suggestion != null) {
            warning.put("suggestion", suggestion);
        }
        return warning;
    }

    private void saveInvocationSample(String requestId, Long clientVersionId, Long templateId,
                                      Object originalResponse, Object adaptedResponse,
                                      Long adaptationTimeMs, boolean hasWarnings, boolean hasErrors,
                                      String errorMessage, String invokedBy) {
        if (invocationSampleRepository.existsByRequestId(requestId)) {
            log.warn("调用样本已存在，跳过保存: {}", requestId);
            return;
        }

        try {
            InvocationSample sample = InvocationSample.builder()
                    .requestId(requestId)
                    .clientVersionId(clientVersionId)
                    .templateId(templateId)
                    .originalResponse(objectMapper.writeValueAsString(originalResponse))
                    .adaptedResponse(objectMapper.writeValueAsString(adaptedResponse))
                    .adaptationTimeMs(adaptationTimeMs)
                    .hasWarnings(hasWarnings)
                    .hasErrors(hasErrors)
                    .errorMessage(errorMessage)
                    .invokedBy(invokedBy != null ? invokedBy : "system")
                    .invokedAt(LocalDateTime.now())
                    .build();

            invocationSampleRepository.save(sample);
        } catch (Exception e) {
            log.error("保存调用样本失败", e);
        }
    }

    private void saveWarnings(Long clientVersionId, Long templateId, List<Map<String, Object>> warnings, String operator) {
        for (Map<String, Object> warning : warnings) {
            String levelStr = (String) warning.get("level");
            WarningLevel level = WarningLevel.valueOf(levelStr);

            if (level == WarningLevel.WARNING || level == WarningLevel.ERROR || level == WarningLevel.CRITICAL) {
                CompatibilityWarning compatibilityWarning = CompatibilityWarning.builder()
                        .clientVersionId(clientVersionId)
                        .templateId(templateId)
                        .level(level)
                        .warningCode((String) warning.get("code"))
                        .message((String) warning.get("message"))
                        .affectedField((String) warning.get("affectedField"))
                        .suggestion((String) warning.get("suggestion"))
                        .isResolved(false)
                        .createdBy(operator != null ? operator : "system")
                        .createdAt(LocalDateTime.now())
                        .build();

                compatibilityWarningRepository.save(compatibilityWarning);
            }
        }
    }

    public List<InvocationSample> getInvocationHistory(LocalDateTime startTime, LocalDateTime endTime) {
        if (startTime != null && endTime != null) {
            return invocationSampleRepository.findByInvokedAtBetween(startTime, endTime);
        }
        return invocationSampleRepository.findAll();
    }

    public List<InvocationSample> getInvocationByVersion(Long clientVersionId) {
        return invocationSampleRepository.findByClientVersionId(clientVersionId);
    }

    public List<InvocationSample> getErrorInvocations() {
        return invocationSampleRepository.findByHasErrorsTrue();
    }

    public List<InvocationSample> getWarningInvocations() {
        return invocationSampleRepository.findByHasWarningsTrue();
    }

    public InvocationSample getInvocationByRequestId(String requestId) {
        return invocationSampleRepository.findByRequestId(requestId).orElse(null);
    }

    public Map<String, Object> exportTroubleshootingSummary(LocalDateTime startTime, LocalDateTime endTime) {
        List<InvocationSample> samples = getInvocationHistory(startTime, endTime);
        List<InvocationSample> errorSamples = getErrorInvocations();
        List<InvocationSample> warningSamples = getWarningInvocations();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalInvocations", samples.size());
        summary.put("errorCount", errorSamples.size());
        summary.put("warningCount", warningSamples.size());
        summary.put("successRate", samples.isEmpty() ? 100.0 :
                (double) (samples.size() - errorSamples.size()) / samples.size() * 100);

        List<Map<String, Object>> errorDetails = new ArrayList<>();
        for (InvocationSample sample : errorSamples) {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("requestId", sample.getRequestId());
            detail.put("clientVersionId", sample.getClientVersionId());
            detail.put("templateId", sample.getTemplateId());
            detail.put("errorMessage", sample.getErrorMessage());
            detail.put("invokedAt", sample.getInvokedAt());
            detail.put("invokedBy", sample.getInvokedBy());
            errorDetails.add(detail);
        }
        summary.put("errorDetails", errorDetails);

        Map<String, Integer> versionStats = new HashMap<>();
        for (InvocationSample sample : samples) {
            String key = "version_" + sample.getClientVersionId();
            versionStats.put(key, versionStats.getOrDefault(key, 0) + 1);
        }
        summary.put("versionStatistics", versionStats);

        summary.put("timeRangeStart", startTime);
        summary.put("timeRangeEnd", endTime);
        summary.put("generatedAt", LocalDateTime.now());

        return summary;
    }
}

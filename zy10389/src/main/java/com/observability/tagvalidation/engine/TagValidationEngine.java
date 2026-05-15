package com.observability.tagvalidation.engine;

import com.observability.tagvalidation.entity.AllowedValue;
import com.observability.tagvalidation.entity.ApiInfo;
import com.observability.tagvalidation.entity.TagKey;
import com.observability.tagvalidation.enums.ViolationType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Component
public class TagValidationEngine {

    public ValidationResult validate(ApiInfo apiInfo, Map<String, String> tags) {
        ValidationResult result = new ValidationResult();

        Map<String, TagKey> tagKeyMap = apiInfo.getTagKeys().stream()
                .collect(Collectors.toMap(TagKey::getKeyName, tk -> tk, (a, b) -> a));

        checkRequiredTags(tagKeyMap, tags, result);
        checkUnknownTags(tagKeyMap, tags, result);
        checkTagValues(tagKeyMap, tags, result);

        return result;
    }

    private void checkRequiredTags(Map<String, TagKey> tagKeyMap, Map<String, String> tags, ValidationResult result) {
        tagKeyMap.entrySet().stream()
                .filter(e -> Boolean.TRUE.equals(e.getValue().getRequired()))
                .forEach(e -> {
                    String key = e.getKey();
                    if (!tags.containsKey(key) || tags.get(key) == null || tags.get(key).trim().isEmpty()) {
                        result.addViolation(ValidationResult.ViolationDetail.of(
                                ViolationType.MISSING_REQUIRED_TAG,
                                key,
                                null,
                                "缺少必填标签: " + key
                        ).withSuggestion(
                                "请添加标签 " + key + " 并提供有效值",
                                "需要提供该标签的值",
                                "ADD_TAG"
                        ));
                    }
                });
    }

    private void checkUnknownTags(Map<String, TagKey> tagKeyMap, Map<String, String> tags, ValidationResult result) {
        tags.keySet().forEach(key -> {
            if (!tagKeyMap.containsKey(key)) {
                result.addViolation(ValidationResult.ViolationDetail.of(
                        ViolationType.UNKNOWN_TAG_KEY,
                        key,
                        tags.get(key),
                        "未知标签键: " + key
                ).withSuggestion(
                        "请移除标签 " + key + " 或在标签白名单中添加该标签",
                        null,
                        "REMOVE_TAG"
                ));
            }
        });
    }

    private void checkTagValues(Map<String, TagKey> tagKeyMap, Map<String, String> tags, ValidationResult result) {
        tags.forEach((key, value) -> {
            TagKey tagKey = tagKeyMap.get(key);
            if (tagKey == null || value == null || value.trim().isEmpty()) {
                return;
            }

            List<String> allowedValues = tagKey.getAllowedValues().stream()
                    .map(AllowedValue::getValue)
                    .toList();

            if (!allowedValues.isEmpty()) {
                if (!allowedValues.contains(value)) {
                    result.addViolation(ValidationResult.ViolationDetail.of(
                            ViolationType.INVALID_TAG_VALUE,
                            key,
                            value,
                            "标签值不在允许范围内: " + key + " = " + value + ", 允许值: " + allowedValues
                    ).withSuggestion(
                            "请将标签 " + key + " 的值修改为允许范围内的值",
                            String.join(", ", allowedValues),
                            "UPDATE_VALUE"
                    ));
                }
            }

            if (tagKey.getValuePattern() != null && !tagKey.getValuePattern().isEmpty()) {
                try {
                    Pattern pattern = Pattern.compile(tagKey.getValuePattern());
                    if (!pattern.matcher(value).matches()) {
                        result.addViolation(ValidationResult.ViolationDetail.of(
                                ViolationType.FORMAT_MISMATCH,
                                key,
                                value,
                                "标签值格式不匹配: " + key + " = " + value + ", 期望格式: " + tagKey.getValuePattern()
                        ).withSuggestion(
                                "请按照格式 " + tagKey.getValuePattern() + " 修改标签 " + key + " 的值",
                                tagKey.getValuePattern(),
                                "UPDATE_VALUE"
                        ));
                    }
                } catch (Exception e) {
                    log.warn("正则表达式匹配失败: pattern={}, value={}", tagKey.getValuePattern(), value, e);
                }
            }
        });
    }

    public Map<String, List<ValidationResult.ViolationDetail>> aggregateViolations(
            List<ValidationResult.ViolationDetail> violations) {
        return violations.stream()
                .collect(Collectors.groupingBy(v ->
                        v.getType() + "|" + v.getTagKey() + "|" + v.getTagValue()
                ));
    }
}

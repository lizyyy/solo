package com.api.slimming.engine;

import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.api.slimming.dto.ValidationResult;
import com.api.slimming.entity.SlimmingRule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
public class FieldSlimmingEngine {

    public String slimResponse(String originalResponse, SlimmingRule rule) {
        if (StrUtil.isBlank(originalResponse)) {
            return originalResponse;
        }

        try {
            JSONObject jsonObject = JSON.parseObject(originalResponse);

            if (jsonObject == null) {
                return originalResponse;
            }

            List<String> excludeFields = parseFieldList(rule.getExcludeFields());
            List<String> includeFields = parseFieldList(rule.getIncludeFields());

            if (!excludeFields.isEmpty()) {
                for (String field : excludeFields) {
                    removeNestedField(jsonObject, field);
                }
            }

            if (!includeFields.isEmpty()) {
                JSONObject result = new JSONObject();
                for (String field : includeFields) {
                    copyNestedField(jsonObject, result, field);
                }
                jsonObject = result;
            }

            applyNestedRules(jsonObject, rule.getNestedRules());

            return jsonObject.toJSONString();
        } catch (Exception e) {
            log.error("字段裁剪失败，返回原始响应", e);
            return originalResponse;
        }
    }

    public ValidationResult validateRule(String originalResponse, SlimmingRule rule) {
        ValidationResult result = new ValidationResult();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        result.setOriginalResponse(originalResponse);

        try {
            JSONObject originalJson = JSON.parseObject(originalResponse);
            if (originalJson == null) {
                errors.add("原始响应不是有效的JSON格式");
                result.setValid(false);
                result.setErrors(errors);
                result.setWarnings(warnings);
                return result;
            }

            String slimmedResponse = slimResponse(originalResponse, rule);
            JSONObject slimmedJson = JSON.parseObject(slimmedResponse);

            result.setSlimmedResponse(slimmedResponse);

            List<String> excludeFields = parseFieldList(rule.getExcludeFields());
            for (String field : excludeFields) {
                if (fieldExists(originalJson, field)) {
                    if (fieldExists(slimmedJson, field)) {
                        errors.add("字段 " + field + " 未被正确移除");
                    }
                } else {
                    warnings.add("字段 " + field + " 在原始响应中不存在");
                }
            }

            List<String> includeFields = parseFieldList(rule.getIncludeFields());
            for (String field : includeFields) {
                if (!fieldExists(slimmedJson, field)) {
                    if (fieldExists(originalJson, field)) {
                        errors.add("字段 " + field + " 未被正确保留");
                    } else {
                        warnings.add("包含字段 " + field + " 在原始响应中不存在");
                    }
                }
            }

            int originalSize = originalResponse.getBytes(StandardCharsets.UTF_8).length;
            int slimmedSize = slimmedResponse.getBytes(StandardCharsets.UTF_8).length;
            int savedSize = originalSize - slimmedSize;
            double savedRatio = originalSize > 0 ? (savedSize * 100.0 / originalSize) : 0;

            result.setOriginalSize(originalSize);
            result.setSlimmedSize(slimmedSize);
            result.setSavedSize(savedSize);
            result.setSavedRatio(Math.round(savedRatio * 100.0) / 100.0);

            if (slimmedSize > originalSize) {
                errors.add("裁剪后的响应体积大于原始响应");
            }

            result.setValid(errors.isEmpty());
            result.setErrors(errors);
            result.setWarnings(warnings);

        } catch (Exception e) {
            errors.add("校验异常: " + e.getMessage());
            result.setValid(false);
            result.setErrors(errors);
        }

        return result;
    }

    public int calculateSize(String response) {
        if (StrUtil.isBlank(response)) {
            return 0;
        }
        return response.getBytes(StandardCharsets.UTF_8).length;
    }

    public double calculateSavedRatio(int originalSize, int slimmedSize) {
        if (originalSize <= 0) {
            return 0;
        }
        int savedSize = originalSize - slimmedSize;
        return Math.round((savedSize * 100.0 / originalSize) * 100.0) / 100.0;
    }

    private List<String> parseFieldList(String fieldsStr) {
        if (StrUtil.isBlank(fieldsStr)) {
            return new ArrayList<>();
        }
        return Arrays.asList(fieldsStr.split(","));
    }

    private void removeNestedField(JSONObject jsonObject, String fieldPath) {
        if (!fieldPath.contains(".")) {
            jsonObject.remove(fieldPath);
            return;
        }

        String[] parts = fieldPath.split("\\.", 2);
        String parentField = parts[0];
        String childPath = parts[1];

        Object parentObj = jsonObject.get(parentField);
        if (parentObj instanceof JSONObject) {
            removeNestedField((JSONObject) parentObj, childPath);
        }
    }

    private void copyNestedField(JSONObject source, JSONObject target, String fieldPath) {
        if (!fieldPath.contains(".")) {
            if (source.containsKey(fieldPath)) {
                target.put(fieldPath, source.get(fieldPath));
            }
            return;
        }

        String[] parts = fieldPath.split("\\.", 2);
        String parentField = parts[0];
        String childPath = parts[1];

        Object sourceParentObj = source.get(parentField);
        if (sourceParentObj instanceof JSONObject) {
            JSONObject targetParentObj = target.getJSONObject(parentField);
            if (targetParentObj == null) {
                targetParentObj = new JSONObject();
                target.put(parentField, targetParentObj);
            }
            copyNestedField((JSONObject) sourceParentObj, targetParentObj, childPath);
        }
    }

    private boolean fieldExists(JSONObject jsonObject, String fieldPath) {
        if (!fieldPath.contains(".")) {
            return jsonObject.containsKey(fieldPath);
        }

        String[] parts = fieldPath.split("\\.", 2);
        String parentField = parts[0];
        String childPath = parts[1];

        Object parentObj = jsonObject.get(parentField);
        if (parentObj instanceof JSONObject) {
            return fieldExists((JSONObject) parentObj, childPath);
        }

        return false;
    }

    private void applyNestedRules(JSONObject jsonObject, String nestedRules) {
        if (StrUtil.isBlank(nestedRules)) {
            return;
        }

        try {
            JSONObject rulesJson = JSON.parseObject(nestedRules);
            for (String path : rulesJson.keySet()) {
                Object nestedObj = getNestedObject(jsonObject, path);
                if (nestedObj instanceof JSONObject) {
                    JSONObject fieldRules = rulesJson.getJSONObject(path);
                    if (fieldRules.containsKey("exclude")) {
                        List<String> excludes = Arrays.asList(fieldRules.getString("exclude").split(","));
                        for (String excludeField : excludes) {
                            ((JSONObject) nestedObj).remove(excludeField);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("应用嵌套规则失败", e);
        }
    }

    private Object getNestedObject(JSONObject jsonObject, String fieldPath) {
        if (!fieldPath.contains(".")) {
            return jsonObject.get(fieldPath);
        }

        String[] parts = fieldPath.split("\\.", 2);
        String parentField = parts[0];
        String childPath = parts[1];

        Object parentObj = jsonObject.get(parentField);
        if (parentObj instanceof JSONObject) {
            return getNestedObject((JSONObject) parentObj, childPath);
        }

        return null;
    }
}

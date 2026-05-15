package com.apidiff.service;

import com.apidiff.entity.DiffField;
import com.apidiff.entity.enums.DiffType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class JsonDiffService {

    private final ObjectMapper objectMapper;

    public List<DiffField> compareJson(Object objA, Object objB) {
        List<DiffField> diffFields = new ArrayList<>();

        if (objA == null && objB == null) {
            return diffFields;
        }

        compareValue("", objA, objB, diffFields);

        return diffFields;
    }

    private void compareValue(String path, Object objA, Object objB, List<DiffField> diffFields) {
        String currentPath = path.isEmpty() ? "" : path;

        if (objA == null && objB == null) {
            return;
        }

        if (objA == null) {
            DiffField diff = DiffField.builder()
                    .fieldPath(currentPath)
                    .diffType(DiffType.FIELD_ADDED)
                    .expectedValue(null)
                    .actualValue(stringify(objB))
                    .expectedType(null)
                    .actualType(objB.getClass().getSimpleName())
                    .build();
            diffFields.add(diff);
            return;
        }

        if (objB == null) {
            DiffField diff = DiffField.builder()
                    .fieldPath(currentPath)
                    .diffType(DiffType.FIELD_MISSING)
                    .expectedValue(stringify(objA))
                    .actualValue(null)
                    .expectedType(objA.getClass().getSimpleName())
                    .actualType(null)
                    .build();
            diffFields.add(diff);
            return;
        }

        Class<?> classA = objA.getClass();
        Class<?> classB = objB.getClass();

        if (!classA.equals(classB)) {
            DiffField diff = DiffField.builder()
                    .fieldPath(currentPath)
                    .diffType(DiffType.TYPE_MISMATCH)
                    .expectedValue(stringify(objA))
                    .actualValue(stringify(objB))
                    .expectedType(classA.getSimpleName())
                    .actualType(classB.getSimpleName())
                    .build();
            diffFields.add(diff);
            return;
        }

        if (objA instanceof Map && objB instanceof Map) {
            compareMap(currentPath, (Map<?, ?>) objA, (Map<?, ?>) objB, diffFields);
        } else if (objA instanceof List && objB instanceof List) {
            compareList(currentPath, (List<?>) objA, (List<?>) objB, diffFields);
        } else {
            if (!Objects.equals(objA, objB)) {
                DiffField diff = DiffField.builder()
                        .fieldPath(currentPath)
                        .diffType(DiffType.VALUE_CHANGED)
                        .expectedValue(stringify(objA))
                        .actualValue(stringify(objB))
                        .expectedType(classA.getSimpleName())
                        .actualType(classB.getSimpleName())
                        .build();
                diffFields.add(diff);
            }
        }
    }

    private void compareMap(String path, Map<?, ?> mapA, Map<?, ?> mapB, List<DiffField> diffFields) {
        Set<?> allKeys = new HashSet<>();
        allKeys.addAll(mapA.keySet());
        allKeys.addAll(mapB.keySet());

        for (Object key : allKeys) {
            String currentPath = path.isEmpty() ? String.valueOf(key) : path + "." + key;
            Object valueA = mapA.get(key);
            Object valueB = mapB.get(key);
            compareValue(currentPath, valueA, valueB, diffFields);
        }
    }

    private void compareList(String path, List<?> listA, List<?> listB, List<DiffField> diffFields) {
        int maxSize = Math.max(listA.size(), listB.size());

        for (int i = 0; i < maxSize; i++) {
            String currentPath = path + "[" + i + "]";
            Object valueA = i < listA.size() ? listA.get(i) : null;
            Object valueB = i < listB.size() ? listB.get(i) : null;
            compareValue(currentPath, valueA, valueB, diffFields);
        }
    }

    private String stringify(Object obj) {
        if (obj == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return obj.toString();
        }
    }

    public Object parseJson(String json) {
        if (json == null || json.trim().isEmpty()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Object>() {});
        } catch (Exception e) {
            log.warn("Failed to parse JSON, returning as string: {}", e.getMessage());
            return json;
        }
    }
}

package com.notebook.artifact.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.TreeMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class HashService {
    
    private final ObjectMapper objectMapper;

    public String calculateParameterHash(Map<String, Object> parameters) {
        try {
            TreeMap<String, Object> sortedParams = new TreeMap<>(parameters);
            String jsonString = objectMapper.writeValueAsString(sortedParams);
            return DigestUtils.sha256Hex(jsonString);
        } catch (JsonProcessingException e) {
            log.error("计算参数哈希失败", e);
            throw new RuntimeException("参数序列化失败", e);
        }
    }

    public String generateParameterSignature(Map<String, Object> parameters) {
        StringBuilder sb = new StringBuilder();
        TreeMap<String, Object> sortedParams = new TreeMap<>(parameters);
        for (Map.Entry<String, Object> entry : sortedParams.entrySet()) {
            if (sb.length() > 0) {
                sb.append("&");
            }
            sb.append(entry.getKey()).append("=").append(entry.getValue());
        }
        return sb.toString();
    }

    public String calculateEnvironmentHash(String pythonVersion, String dependencies) {
        String combined = pythonVersion + "|" + dependencies;
        return DigestUtils.sha256Hex(combined);
    }

    public String calculateFileHash(String content) {
        return DigestUtils.sha256Hex(content);
    }
}

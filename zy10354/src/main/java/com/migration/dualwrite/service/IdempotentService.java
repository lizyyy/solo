package com.migration.dualwrite.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.migration.dualwrite.constant.ErrorCode;
import com.migration.dualwrite.dto.MigrationTask;
import com.migration.dualwrite.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class IdempotentService {
    private final Map<String, MigrationTask> idempotentCache = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public String generateIdempotentKey(Object... args) {
        try {
            StringBuilder sb = new StringBuilder();
            for (Object arg : args) {
                if (arg != null) {
                    sb.append(objectMapper.writeValueAsString(arg));
                }
            }
            return DigestUtils.md5Hex(sb.toString());
        } catch (JsonProcessingException e) {
            log.error("生成幂等键失败", e);
            throw new BusinessException(ErrorCode.IDEMPOTENT_KEY_GENERATE_FAILED, "生成幂等键失败");
        }
    }

    public MigrationTask getCachedResult(String key) {
        return idempotentCache.get(key);
    }

    public void cacheResult(String key, MigrationTask task) {
        idempotentCache.put(key, task);
    }

    public void clearCache() {
        idempotentCache.clear();
    }
}

package com.api.slimming.service;

import cn.hutool.core.util.StrUtil;
import com.api.slimming.entity.SlimmingRecord;
import com.api.slimming.mapper.SlimmingRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class IdempotentService {

    @Autowired
    private SlimmingRecordMapper slimmingRecordMapper;

    private final Map<String, Long> requestCache = new ConcurrentHashMap<>();

    private static final long CACHE_EXPIRE_TIME = TimeUnit.HOURS.toMillis(1);

    public boolean isDuplicateRequest(String requestId) {
        if (StrUtil.isBlank(requestId)) {
            return false;
        }

        Long cachedTime = requestCache.get(requestId);
        if (cachedTime != null) {
            if (System.currentTimeMillis() - cachedTime < CACHE_EXPIRE_TIME) {
                log.info("检测到重复请求: {}", requestId);
                return true;
            } else {
                requestCache.remove(requestId);
            }
        }

        LambdaQueryWrapper<SlimmingRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(SlimmingRecord::getRequestId, requestId);
        SlimmingRecord existingRecord = slimmingRecordMapper.selectOne(queryWrapper);

        if (existingRecord != null) {
            log.info("数据库中已存在该请求记录: {}", requestId);
            requestCache.put(requestId, System.currentTimeMillis());
            return true;
        }

        return false;
    }

    public void markRequestProcessed(String requestId) {
        if (StrUtil.isNotBlank(requestId)) {
            requestCache.put(requestId, System.currentTimeMillis());
        }
    }

    public SlimmingRecord getExistingRecord(String requestId) {
        if (StrUtil.isBlank(requestId)) {
            return null;
        }

        LambdaQueryWrapper<SlimmingRecord> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(SlimmingRecord::getRequestId, requestId);
        return slimmingRecordMapper.selectOne(queryWrapper);
    }

    public void cleanExpiredCache() {
        long now = System.currentTimeMillis();
        requestCache.entrySet().removeIf(entry -> now - entry.getValue() > CACHE_EXPIRE_TIME);
    }
}

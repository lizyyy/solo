package com.api.slimming.service;

import cn.hutool.core.util.StrUtil;
import com.api.slimming.dto.ApiResult;
import com.api.slimming.dto.SlimmingRequest;
import com.api.slimming.dto.SlimmingResult;
import com.api.slimming.engine.FieldSlimmingEngine;
import com.api.slimming.engine.SceneMatcher;
import com.api.slimming.entity.SlimmingRecord;
import com.api.slimming.entity.SlimmingRule;
import com.api.slimming.mapper.SlimmingRecordMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

@Slf4j
@Service
public class SlimmingExecuteService {

    @Autowired
    private FieldSlimmingEngine fieldSlimmingEngine;

    @Autowired
    private SceneMatcher sceneMatcher;

    @Autowired
    private SlimmingRecordMapper slimmingRecordMapper;

    @Autowired
    private IdempotentService idempotentService;

    @Transactional(rollbackFor = Exception.class)
    public ApiResult<SlimmingResult> executeSlimming(SlimmingRequest request) {
        String requestId = request.getRequestId();
        if (StrUtil.isBlank(requestId)) {
            requestId = "REQ-" + System.currentTimeMillis();
        }

        if (idempotentService.isDuplicateRequest(requestId)) {
            SlimmingRecord existingRecord = idempotentService.getExistingRecord(requestId);
            if (existingRecord != null) {
                SlimmingResult result = convertToResult(existingRecord);
                return ApiResult.success(result).requestId(requestId);
            }
        }

        SlimmingResult result = new SlimmingResult();
        result.setRequestId(requestId);
        result.setApiPath(request.getApiPath());
        result.setSceneCode(request.getSceneCode());

        SlimmingRecord record = new SlimmingRecord();
        record.setRequestId(requestId);
        record.setApiPath(request.getApiPath());
        record.setSceneCode(request.getSceneCode());
        record.setClientIp(request.getClientIp());
        record.setRequestTime(LocalDateTime.now());

        try {
            Optional<SlimmingRule> ruleOpt = sceneMatcher.matchRule(request.getApiPath(), request.getSceneCode());

            if (!ruleOpt.isPresent()) {
                log.info("未找到匹配的瘦身规则，返回原始响应: {}", request.getApiPath());
                result.setSlimmedResponse(request.getOriginalResponse());
                result.setOriginalSize(fieldSlimmingEngine.calculateSize(request.getOriginalResponse()));
                result.setSlimmedSize(result.getOriginalSize());
                result.setSavedSize(0);
                result.setSavedRatio(0.0);
                result.setSuccess(true);

                record.setOriginalSize(result.getOriginalSize());
                record.setSlimmedSize(result.getSlimmedSize());
                record.setSavedSize(0);
                record.setSavedRatio(0.0);
                record.setSuccess(true);
            } else {
                SlimmingRule rule = ruleOpt.get();
                result.setRuleNo(rule.getRuleNo());
                record.setRuleId(rule.getId());
                record.setRuleNo(rule.getRuleNo());

                String slimmedResponse = fieldSlimmingEngine.slimResponse(request.getOriginalResponse(), rule);
                result.setSlimmedResponse(slimmedResponse);

                int originalSize = fieldSlimmingEngine.calculateSize(request.getOriginalResponse());
                int slimmedSize = fieldSlimmingEngine.calculateSize(slimmedResponse);
                double savedRatio = fieldSlimmingEngine.calculateSavedRatio(originalSize, slimmedSize);

                result.setOriginalSize(originalSize);
                result.setSlimmedSize(slimmedSize);
                result.setSavedSize(originalSize - slimmedSize);
                result.setSavedRatio(savedRatio);
                result.setSuccess(true);

                record.setOriginalSize(originalSize);
                record.setSlimmedSize(slimmedSize);
                record.setSavedSize(originalSize - slimmedSize);
                record.setSavedRatio(savedRatio);
                record.setSuccess(true);

                log.info("API瘦身执行成功: apiPath={}, ruleNo={}, savedSize={}, savedRatio={}%",
                        request.getApiPath(), rule.getRuleNo(), result.getSavedSize(), result.getSavedRatio());
            }
        } catch (Exception e) {
            log.error("API瘦身执行失败", e);
            result.setSlimmedResponse(request.getOriginalResponse());
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());

            record.setSuccess(false);
            record.setErrorMessage(e.getMessage());
        }

        slimmingRecordMapper.insert(record);
        idempotentService.markRequestProcessed(requestId);

        return ApiResult.success(result).requestId(requestId);
    }

    private SlimmingResult convertToResult(SlimmingRecord record) {
        SlimmingResult result = new SlimmingResult();
        result.setRequestId(record.getRequestId());
        result.setRuleNo(record.getRuleNo());
        result.setApiPath(record.getApiPath());
        result.setSceneCode(record.getSceneCode());
        result.setOriginalSize(record.getOriginalSize());
        result.setSlimmedSize(record.getSlimmedSize());
        result.setSavedSize(record.getSavedSize());
        result.setSavedRatio(record.getSavedRatio());
        result.setSuccess(record.getSuccess());
        result.setErrorMessage(record.getErrorMessage());
        return result;
    }
}

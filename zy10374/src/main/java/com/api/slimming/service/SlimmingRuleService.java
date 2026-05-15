package com.api.slimming.service;

import cn.hutool.core.util.IdUtil;
import cn.hutool.core.util.StrUtil;
import com.alibaba.fastjson.JSON;
import com.api.slimming.dto.*;
import com.api.slimming.engine.FieldSlimmingEngine;
import com.api.slimming.entity.RuleHistory;
import com.api.slimming.entity.SlimmingRecord;
import com.api.slimming.entity.SlimmingRule;
import com.api.slimming.enums.OperationTypeEnum;
import com.api.slimming.enums.RuleStatusEnum;
import com.api.slimming.mapper.RuleHistoryMapper;
import com.api.slimming.mapper.SlimmingRecordMapper;
import com.api.slimming.mapper.SlimmingRuleMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class SlimmingRuleService {

    @Autowired
    private SlimmingRuleMapper slimmingRuleMapper;

    @Autowired
    private RuleHistoryMapper ruleHistoryMapper;

    @Autowired
    private SlimmingRecordMapper slimmingRecordMapper;

    @Autowired
    private FieldSlimmingEngine fieldSlimmingEngine;

    @Autowired
    private IdempotentService idempotentService;

    @Transactional(rollbackFor = Exception.class)
    public ApiResult<SlimmingRule> createRule(RuleCreateRequest request) {
        if (idempotentService.isDuplicateRequest(request.getRequestId())) {
            SlimmingRecord existingRecord = idempotentService.getExistingRecord(request.getRequestId());
            if (existingRecord != null && existingRecord.getRuleId() != null) {
                SlimmingRule existingRule = slimmingRuleMapper.selectById(existingRecord.getRuleId());
                if (existingRule != null) {
                    return ApiResult.success(existingRule).requestId(request.getRequestId());
                }
            }
        }

        SlimmingRule rule = new SlimmingRule();
        rule.setRuleNo("RULE-" + IdUtil.simpleUUID().substring(0, 8).toUpperCase());
        rule.setApiPath(request.getApiPath());
        rule.setApiEndpointId(request.getApiEndpointId());
        rule.setSceneCode(request.getSceneCode());
        rule.setClientSceneId(request.getClientSceneId());

        if (request.getExcludeFields() != null && !request.getExcludeFields().isEmpty()) {
            rule.setExcludeFields(String.join(",", request.getExcludeFields()));
        }
        if (request.getIncludeFields() != null && !request.getIncludeFields().isEmpty()) {
            rule.setIncludeFields(String.join(",", request.getIncludeFields()));
        }
        rule.setNestedRules(request.getNestedRules());
        rule.setStatus(RuleStatusEnum.DRAFT.getCode());
        rule.setVersion("1.0");
        rule.setCreatedBy(request.getCreatedBy());
        rule.setRemark(request.getRemark());

        slimmingRuleMapper.insert(rule);

        saveHistory(rule.getId(), rule.getRuleNo(), OperationTypeEnum.CREATE,
                null, RuleStatusEnum.DRAFT.getCode(), request.getCreatedBy(), "创建规则", null, JSON.toJSONString(rule));

        idempotentService.markRequestProcessed(request.getRequestId());

        return ApiResult.success(rule).requestId(request.getRequestId());
    }

    public ApiResult<ValidationResult> validateRule( RuleValidateRequest request) {
        SlimmingRule rule = slimmingRuleMapper.selectById(request.getRuleId());
        if (rule == null) {
            return ApiResult.fail(404, "规则不存在");
        }

        ValidationResult validationResult = fieldSlimmingEngine.validateRule(request.getOriginalResponse(), rule);

        if (validationResult.getValid()) {
            rule.setStatus(RuleStatusEnum.VALIDATING.getCode());
            slimmingRuleMapper.updateById(rule);

            saveHistory(rule.getId(), rule.getRuleNo(), OperationTypeEnum.VALIDATE,
                    RuleStatusEnum.DRAFT.getCode(), RuleStatusEnum.VALIDATING.getCode(),
                    request.getOperator(), "规则校验通过", null, JSON.toJSONString(rule));
        }

        return ApiResult.success(validationResult);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResult<SlimmingRule> activateRule(RuleStatusUpdateRequest request) {
        SlimmingRule rule = slimmingRuleMapper.selectById(request.getRuleId());
        if (rule == null) {
            return ApiResult.fail(404, "规则不存在");
        }

        Integer previousStatus = rule.getStatus();

        rule.setStatus(RuleStatusEnum.VALID.getCode());
        rule.setEffectiveTime(LocalDateTime.now());
        slimmingRuleMapper.updateById(rule);

        saveHistory(rule.getId(), rule.getRuleNo(), OperationTypeEnum.ACTIVATE,
                previousStatus, RuleStatusEnum.VALID.getCode(),
                request.getOperator(), "激活规则", null, JSON.toJSONString(rule));

        return ApiResult.success(rule);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResult<SlimmingRule> deactivateRule(RuleStatusUpdateRequest request) {
        SlimmingRule rule = slimmingRuleMapper.selectById(request.getRuleId());
        if (rule == null) {
            return ApiResult.fail(404, "规则不存在");
        }

        Integer previousStatus = rule.getStatus();

        rule.setStatus(RuleStatusEnum.INVALID.getCode());
        rule.setExpireTime(LocalDateTime.now());
        slimmingRuleMapper.updateById(rule);

        saveHistory(rule.getId(), rule.getRuleNo(), OperationTypeEnum.DEACTIVATE,
                previousStatus, RuleStatusEnum.INVALID.getCode(),
                request.getOperator(), "停用规则", null, JSON.toJSONString(rule));

        return ApiResult.success(rule);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApiResult<SlimmingRule> rollbackRule(RuleRollbackRequest request) {
        SlimmingRule rule = slimmingRuleMapper.selectById(request.getRuleId());
        if (rule == null) {
            return ApiResult.fail(404, "规则不存在");
        }

        LambdaQueryWrapper<RuleHistory> historyWrapper = new LambdaQueryWrapper<>();
        historyWrapper.eq(RuleHistory::getRuleId, request.getRuleId());
        historyWrapper.orderByDesc(RuleHistory::getCreateTime);
        List<RuleHistory> historyList = ruleHistoryMapper.selectList(historyWrapper);

        if (historyList.isEmpty()) {
            return ApiResult.fail(500, "没有可回滚的历史版本");
        }

        RuleHistory targetHistory = null;
        for (RuleHistory history : historyList) {
            if (history.getSnapshotBefore() != null) {
                SlimmingRule beforeRule = JSON.parseObject(history.getSnapshotBefore(), SlimmingRule.class);
                if (beforeRule != null && request.getTargetVersion().equals(beforeRule.getVersion())) {
                    targetHistory = history;
                    break;
                }
            }
        }

        if (targetHistory == null) {
            return ApiResult.fail(500, "未找到目标版本");
        }

        SlimmingRule beforeRule = JSON.parseObject(targetHistory.getSnapshotBefore(), SlimmingRule.class);

        String previousVersion = rule.getVersion();
        String previousJson = JSON.toJSONString(rule);

        BeanUtils.copyProperties(beforeRule, rule, "id", "createTime", "updateTime", "deleted");
        rule.setStatus(RuleStatusEnum.ROLLBACKED.getCode());
        rule.setVersion(increaseVersion(rule.getVersion()));
        rule.setPreviousVersion(previousVersion);

        slimmingRuleMapper.updateById(rule);

        saveHistory(rule.getId(), rule.getRuleNo(), OperationTypeEnum.ROLLBACK,
                RuleStatusEnum.VALID.getCode(), RuleStatusEnum.ROLLBACKED.getCode(),
                request.getOperator(), "回滚规则到版本" + request.getTargetVersion(), previousJson, JSON.toJSONString(rule));

        return ApiResult.success(rule);
    }

    public ApiResult<SlimmingRule> getRuleById(Long id) {
        SlimmingRule rule = slimmingRuleMapper.selectById(id);
        if (rule == null) {
            return ApiResult.fail(404, "规则不存在");
        }
        return ApiResult.success(rule);
    }

    public ApiResult<IPage<SlimmingRule>> queryRules(RuleQueryRequest request) {
        Page<SlimmingRule> page = new Page<>(request.getPageNum(), request.getPageSize());

        LambdaQueryWrapper<SlimmingRule> queryWrapper = new LambdaQueryWrapper<>();
        if (StrUtil.isNotBlank(request.getRuleNo())) {
            queryWrapper.like(SlimmingRule::getRuleNo, request.getRuleNo());
        }
        if (StrUtil.isNotBlank(request.getApiPath())) {
            queryWrapper.like(SlimmingRule::getApiPath, request.getApiPath());
        }
        if (StrUtil.isNotBlank(request.getSceneCode())) {
            queryWrapper.eq(SlimmingRule::getSceneCode, request.getSceneCode());
        }
        if (request.getStatus() != null) {
            queryWrapper.eq(SlimmingRule::getStatus, request.getStatus());
        }
        if (StrUtil.isNotBlank(request.getCreatedBy())) {
            queryWrapper.eq(SlimmingRule::getCreatedBy, request.getCreatedBy());
        }
        if (request.getCreateTimeStart() != null) {
            queryWrapper.ge(SlimmingRule::getCreateTime, request.getCreateTimeStart());
        }
        if (request.getCreateTimeEnd() != null) {
            queryWrapper.le(SlimmingRule::getCreateTime, request.getCreateTimeEnd());
        }
        queryWrapper.orderByDesc(SlimmingRule::getCreateTime);

        IPage<SlimmingRule> result = slimmingRuleMapper.selectPage(page, queryWrapper);
        return ApiResult.success(result);
    }

    public ApiResult<List<RuleHistory>> getRuleHistory(Long ruleId) {
        LambdaQueryWrapper<RuleHistory> queryWrapper = new LambdaQueryWrapper<>();
        queryWrapper.eq(RuleHistory::getRuleId, ruleId);
        queryWrapper.orderByDesc(RuleHistory::getCreateTime);

        List<RuleHistory> historyList = ruleHistoryMapper.selectList(queryWrapper);
        return ApiResult.success(historyList);
    }

    private String increaseVersion(String version) {
        try {
            String[] parts = version.split("\\.");
            int major = Integer.parseInt(parts[0]);
            int minor = parts.length > 1 ? Integer.parseInt(parts[1]) : 0;
            return major + "." + (minor + 1);
        } catch (Exception e) {
            return "1.0";
        }
    }

    private void saveHistory(Long ruleId, String ruleNo, OperationTypeEnum operationType,
                             Integer previousStatus, Integer currentStatus, String operator,
                             String remark, String snapshotBefore, String snapshotAfter) {
        RuleHistory history = new RuleHistory();
        history.setRuleId(ruleId);
        history.setRuleNo(ruleNo);
        history.setOperationType(operationType.getCode());
        history.setPreviousStatus(previousStatus);
        history.setCurrentStatus(currentStatus);
        history.setOperator(operator);
        history.setOperationRemark(remark);
        history.setSnapshotBefore(snapshotBefore);
        history.setSnapshotAfter(snapshotAfter);
        ruleHistoryMapper.insert(history);
    }
}

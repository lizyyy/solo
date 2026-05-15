package com.api.slimming.controller;

import com.api.slimming.dto.*;
import com.api.slimming.entity.RuleHistory;
import com.api.slimming.entity.SlimmingRule;
import com.api.slimming.service.SlimmingRuleService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/rules")
public class SlimmingRuleController {

    @Autowired
    private SlimmingRuleService slimmingRuleService;

    @PostMapping
    public ApiResult<SlimmingRule> createRule(@Valid @RequestBody RuleCreateRequest request) {
        return slimmingRuleService.createRule(request);
    }

    @PostMapping("/validate")
    public ApiResult<ValidationResult> validateRule(@Valid @RequestBody RuleValidateRequest request) {
        return slimmingRuleService.validateRule(request);
    }

    @PostMapping("/{id}/activate")
    public ApiResult<SlimmingRule> activateRule(@PathVariable Long id, @RequestBody RuleStatusUpdateRequest request) {
        request.setRuleId(id);
        return slimmingRuleService.activateRule(request);
    }

    @PostMapping("/{id}/deactivate")
    public ApiResult<SlimmingRule> deactivateRule(@PathVariable Long id, @RequestBody RuleStatusUpdateRequest request) {
        request.setRuleId(id);
        return slimmingRuleService.deactivateRule(request);
    }

    @PostMapping("/{id}/rollback")
    public ApiResult<SlimmingRule> rollbackRule(@PathVariable Long id, @Valid @RequestBody RuleRollbackRequest request) {
        request.setRuleId(id);
        return slimmingRuleService.rollbackRule(request);
    }

    @GetMapping("/{id}")
    public ApiResult<SlimmingRule> getRuleById(@PathVariable Long id) {
        return slimmingRuleService.getRuleById(id);
    }

    @PostMapping("/query")
    public ApiResult<IPage<SlimmingRule>> queryRules(@RequestBody RuleQueryRequest request) {
        return slimmingRuleService.queryRules(request);
    }

    @GetMapping("/{id}/history")
    public ApiResult<List<RuleHistory>> getRuleHistory(@PathVariable Long id) {
        return slimmingRuleService.getRuleHistory(id);
    }
}

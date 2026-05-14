package com.account.freeze.controller;

import com.account.freeze.common.Result;
import com.account.freeze.dto.FreezeRuleCreateDTO;
import com.account.freeze.entity.FreezeRule;
import com.account.freeze.service.FreezeRuleService;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/rule")
@RequiredArgsConstructor
public class FreezeRuleController {

    private final FreezeRuleService freezeRuleService;

    @GetMapping("/current/version")
    public Result<Integer> getCurrentRuleVersion() {
        return Result.success(freezeRuleService.getCurrentRuleVersion());
    }

    @GetMapping("/version/{version}")
    public Result<FreezeRule> getRuleByVersion(@PathVariable Integer version) {
        return Result.success(freezeRuleService.getRuleByVersion(version));
    }

    @GetMapping("/list")
    public Result<List<FreezeRule>> listAllRules() {
        return Result.success(freezeRuleService.listAllRules());
    }

    @PostMapping("/create")
    public Result<FreezeRule> createNewRule(@Validated @RequestBody FreezeRuleCreateDTO dto) {
        return Result.success(freezeRuleService.createNewRule(dto));
    }

    @PostMapping("/version/{version}/disable")
    public Result<Void> disableRule(@PathVariable Integer version, @RequestParam String operator) {
        freezeRuleService.disableRule(version, operator);
        return Result.success();
    }

    @PostMapping("/init")
    public Result<Void> initDefaultRules(@RequestParam String operator) {
        freezeRuleService.initDefaultRules(operator);
        return Result.success();
    }
}

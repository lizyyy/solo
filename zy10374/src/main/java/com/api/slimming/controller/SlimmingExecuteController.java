package com.api.slimming.controller;

import com.api.slimming.dto.ApiResult;
import com.api.slimming.dto.SlimmingRequest;
import com.api.slimming.dto.SlimmingResult;
import com.api.slimming.service.SlimmingExecuteService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;

@RestController
@RequestMapping("/api/execute")
public class SlimmingExecuteController {

    @Autowired
    private SlimmingExecuteService slimmingExecuteService;

    @PostMapping("/slimming")
    public ApiResult<SlimmingResult> executeSlimming(@Valid @RequestBody SlimmingRequest request) {
        return slimmingExecuteService.executeSlimming(request);
    }
}

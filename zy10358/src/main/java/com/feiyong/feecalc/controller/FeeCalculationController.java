package com.feiyong.feecalc.controller;

import com.feiyong.feecalc.dto.ApiResponse;
import com.feiyong.feecalc.dto.CalculateRequest;
import com.feiyong.feecalc.dto.CalculateResult;
import com.feiyong.feecalc.entity.ActionTimeline;
import com.feiyong.feecalc.service.FeeCalculationService;
import com.feiyong.feecalc.service.TimelineService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/fee")
public class FeeCalculationController {

    @Autowired
    private FeeCalculationService feeCalculationService;

    @Autowired
    private TimelineService timelineService;

    @PostMapping("/calculate")
    public ApiResponse<CalculateResult> calculate(@Valid @RequestBody CalculateRequest request) {
        try {
            CalculateResult result = feeCalculationService.createCalculation(request);
            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("创建试算失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }

    @GetMapping("/result/{requestNo}")
    public ApiResponse<CalculateResult> getResult(@PathVariable String requestNo) {
        try {
            CalculateResult result = feeCalculationService.getResult(requestNo);
            return ApiResponse.success(result);
        } catch (Exception e) {
            log.error("查询试算结果失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }

    @PostMapping("/lock/{requestNo}")
    public ApiResponse<Map<String, String>> lockPrice(@PathVariable String requestNo, @RequestParam(required = false) String operator) {
        try {
            var certificate = feeCalculationService.lockPrice(requestNo, operator);
            return ApiResponse.success(Map.of("certificateNo", certificate.getCertificateNo()));
        } catch (Exception e) {
            log.error("锁价失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }

    @GetMapping("/validate/{certificateNo}")
    public ApiResponse<Boolean> validateCertificate(@PathVariable String certificateNo) {
        try {
            boolean valid = feeCalculationService.validateCertificate(certificateNo);
            return ApiResponse.success(valid);
        } catch (Exception e) {
            log.error("校验凭证失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }

    @PostMapping("/charge/{certificateNo}")
    public ApiResponse<String> charge(@PathVariable String certificateNo, @RequestParam(required = false) String operator) {
        try {
            feeCalculationService.charge(certificateNo, operator);
            return ApiResponse.success("扣费成功");
        } catch (Exception e) {
            log.error("扣费失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }

    @GetMapping("/timeline/{requestNo}")
    public ApiResponse<List<ActionTimeline>> getTimeline(@PathVariable String requestNo) {
        try {
            List<ActionTimeline> timeline = timelineService.getTimelineByRequestNo(requestNo);
            return ApiResponse.success(timeline);
        } catch (Exception e) {
            log.error("查询时间线失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }
}

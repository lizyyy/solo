package com.feiyong.feecalc.controller;

import com.feiyong.feecalc.dto.ApiResponse;
import com.feiyong.feecalc.dto.CalculateRequest;
import com.feiyong.feecalc.dto.CalculateResult;
import com.feiyong.feecalc.dto.DiagnosisSummary;
import com.feiyong.feecalc.entity.ActionTimeline;
import com.feiyong.feecalc.service.DiagnosisService;
import com.feiyong.feecalc.service.FeeCalculationService;
import com.feiyong.feecalc.service.TimelineService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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

    @Autowired
    private DiagnosisService diagnosisService;

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

    @GetMapping("/diagnosis/{requestNo}")
    public ApiResponse<DiagnosisSummary> getDiagnosis(@PathVariable String requestNo) {
        try {
            DiagnosisSummary summary = diagnosisService.generateDiagnosis(requestNo);
            return ApiResponse.success(summary);
        } catch (Exception e) {
            log.error("生成排查汇总失败", e);
            return ApiResponse.fail(e.getMessage());
        }
    }

    @GetMapping("/export/text/{requestNo}")
    public ResponseEntity<String> exportText(@PathVariable String requestNo) {
        try {
            String content = diagnosisService.exportAsText(requestNo);
            String filename = "diagnosis-" + requestNo + "-" + 
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".txt";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(content);
        } catch (Exception e) {
            log.error("导出文本失败", e);
            return ResponseEntity.badRequest().body("导出失败: " + e.getMessage());
        }
    }

    @GetMapping("/export/json/{requestNo}")
    public ResponseEntity<String> exportJson(@PathVariable String requestNo) {
        try {
            String content = diagnosisService.exportAsJson(requestNo);
            String filename = "diagnosis-" + requestNo + "-" + 
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".json";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + filename)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(content);
        } catch (Exception e) {
            log.error("导出JSON失败", e);
            return ResponseEntity.badRequest().body("导出失败: " + e.getMessage());
        }
    }
}

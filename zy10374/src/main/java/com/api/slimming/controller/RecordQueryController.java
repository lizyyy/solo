package com.api.slimming.controller;

import com.api.slimming.dto.ApiResult;
import com.api.slimming.dto.HistoryQueryRequest;
import com.api.slimming.dto.RecordQueryRequest;
import com.api.slimming.entity.RuleHistory;
import com.api.slimming.entity.SlimmingRecord;
import com.api.slimming.service.RecordQueryService;
import com.baomidou.mybatisplus.core.metadata.IPage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/records")
public class RecordQueryController {

    @Autowired
    private RecordQueryService recordQueryService;

    @PostMapping("/query")
    public ApiResult<IPage<SlimmingRecord>> queryRecords(@RequestBody RecordQueryRequest request) {
        return recordQueryService.queryRecords(request);
    }

    @GetMapping("/{id}")
    public ApiResult<SlimmingRecord> getRecordById(@PathVariable Long id) {
        return recordQueryService.getRecordById(id);
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> exportRecords(@RequestBody RecordQueryRequest request) {
        ApiResult<byte[]> result = recordQueryService.exportRecords(request);
        if (!result.getCode().equals(200)) {
            return ResponseEntity.badRequest().body(result.getMessage().getBytes(StandardCharsets.UTF_8));
        }

        String fileName = "slimming_records_" + System.currentTimeMillis() + ".csv";
        try {
            fileName = URLEncoder.encode(fileName, "UTF-8").replaceAll("\\+", "%20");
        } catch (Exception e) {
            // ignore
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(result.getData());
    }

    @PostMapping("/history/query")
    public ApiResult<IPage<RuleHistory>> queryHistory(@RequestBody HistoryQueryRequest request) {
        return recordQueryService.queryHistory(request);
    }
}

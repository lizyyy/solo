package com.riskcontrol.graylist.controller;

import com.riskcontrol.graylist.dto.ApiResponse;
import com.riskcontrol.graylist.dto.GraylistRecordDTO;
import com.riskcontrol.graylist.dto.ImportResultDTO;
import com.riskcontrol.graylist.dto.ReviewRequestDTO;
import com.riskcontrol.graylist.entity.ReviewHistory;
import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.service.GraylistExportService;
import com.riskcontrol.graylist.service.GraylistImportService;
import com.riskcontrol.graylist.service.GraylistReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/graylist")
@RequiredArgsConstructor
public class GraylistController {

    private final GraylistImportService graylistImportService;
    private final GraylistReviewService graylistReviewService;
    private final GraylistExportService graylistExportService;

    @PostMapping("/import")
    public ApiResponse<ImportResultDTO> importGraylist(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "importUser", defaultValue = "system") String importUser) throws IOException {
        ImportResultDTO result = graylistImportService.importGraylist(file, importUser);
        return ApiResponse.success("导入完成", result);
    }

    @PostMapping("/review")
    public ApiResponse<GraylistRecordDTO> review(@Valid @RequestBody ReviewRequestDTO request) {
        GraylistRecordDTO result = graylistReviewService.review(request);
        return ApiResponse.success("复核完成", result);
    }

    @GetMapping("/{id}")
    public ApiResponse<GraylistRecordDTO> getById(@PathVariable Long id) {
        GraylistRecordDTO result = graylistReviewService.getById(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/list")
    public ApiResponse<Page<GraylistRecordDTO>> list(
            @RequestParam(required = false) String customerId,
            @RequestParam(required = false) String customerName,
            @RequestParam(required = false) GraylistStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<GraylistRecordDTO> result = graylistReviewService.list(customerId, customerName, status, pageable);
        return ApiResponse.success(result);
    }

    @GetMapping("/{id}/history")
    public ApiResponse<List<ReviewHistory>> getHistory(@PathVariable Long id) {
        List<ReviewHistory> result = graylistReviewService.getHistory(id);
        return ApiResponse.success(result);
    }

    @GetMapping("/check/{customerId}")
    public ApiResponse<GraylistRecordDTO> checkCustomerStatus(@PathVariable String customerId) {
        GraylistRecordDTO result = graylistReviewService.checkCustomerStatus(customerId);
        if (result != null && Boolean.TRUE.equals(result.getIsExpiredNotReviewed())) {
            return ApiResponse.badRequest(
                    "该客户灰名单已到期未复核，已自动拦截",
                    "EXPIRED_NOT_REVIEWED",
                    result.getNextStepHint()
            );
        }
        return ApiResponse.success(result);
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String customerId,
            @RequestParam(required = false) String customerName,
            @RequestParam(required = false) GraylistStatus status) throws IOException {
        byte[] data = graylistExportService.exportGraylist(customerId, customerName, status);
        String fileName = "灰名单复核记录_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + URLEncoder.encode(fileName, StandardCharsets.UTF_8))
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(data);
    }

    @PostMapping("/check-expired")
    public ApiResponse<String> checkExpiredRecords() {
        graylistReviewService.checkExpiredRecords();
        return ApiResponse.success("到期检查完成");
    }
}

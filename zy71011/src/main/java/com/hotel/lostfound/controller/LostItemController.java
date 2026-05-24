package com.hotel.lostfound.controller;

import com.hotel.lostfound.common.ApiResponse;
import com.hotel.lostfound.dto.request.*;
import com.hotel.lostfound.dto.response.*;
import com.hotel.lostfound.service.ExportService;
import com.hotel.lostfound.service.LostItemService;
import com.hotel.lostfound.service.StatisticsService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/lost-items")
public class LostItemController {

    private final LostItemService lostItemService;
    private final StatisticsService statisticsService;
    private final ExportService exportService;

    public LostItemController(LostItemService lostItemService,
                             StatisticsService statisticsService,
                             ExportService exportService) {
        this.lostItemService = lostItemService;
        this.statisticsService = statisticsService;
        this.exportService = exportService;
    }

    @PostMapping
    public ApiResponse<LostItemDetailVO> create(@Valid @RequestBody CreateLostItemRequest request) {
        return ApiResponse.success(lostItemService.createLostItem(request));
    }

    @PostMapping("/verify")
    public ApiResponse<LostItemDetailVO> verify(@Valid @RequestBody VerifyItemRequest request) {
        return ApiResponse.success(lostItemService.verifyItem(request));
    }

    @PostMapping("/claim")
    public ApiResponse<ClaimRecordVO> claim(@Valid @RequestBody ClaimItemRequest request) {
        return ApiResponse.success(lostItemService.claimItem(request));
    }

    @PostMapping("/mail")
    public ApiResponse<MailRecordVO> mail(@Valid @RequestBody MailItemRequest request) {
        return ApiResponse.success(lostItemService.mailItem(request));
    }

    @PostMapping("/dispose")
    public ApiResponse<DisposalRecordVO> dispose(@Valid @RequestBody DisposeItemRequest request) {
        return ApiResponse.success(lostItemService.disposeItem(request));
    }

    @PostMapping("/supplement")
    public ApiResponse<SupplementRecordVO> supplement(@Valid @RequestBody SupplementRequest request) {
        return ApiResponse.success(lostItemService.supplement(request));
    }

    @GetMapping("/{id}")
    public ApiResponse<LostItemDetailVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(lostItemService.getLostItemDetail(id));
    }

    @GetMapping
    public ApiResponse<Page<LostItemListVO>> query(QueryLostItemRequest request) {
        return ApiResponse.success(lostItemService.queryLostItems(request));
    }

    @GetMapping("/expiring")
    public ApiResponse<List<LostItemListVO>> getExpiringItems() {
        return ApiResponse.success(lostItemService.getExpiringItems());
    }

    @GetMapping("/statistics")
    public ApiResponse<StatisticsVO> getStatistics() {
        return ApiResponse.success(statisticsService.getStatistics());
    }

    @PostMapping("/export")
    public ResponseEntity<byte[]> export(@Valid @RequestBody ExportRequest request) {
        byte[] data = exportService.exportLostItems(request);
        
        String filename = "遗失物品记录_" + 
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + 
                ".xlsx";
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                        "attachment; filename*=UTF-8''" + encodedFilename)
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}

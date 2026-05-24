package com.floodrelief.controller;

import com.floodrelief.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/reports")
public class ReportController {
    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/allocation/{shelterId}")
    public ResponseEntity<byte[]> downloadAllocationReport(@PathVariable Long shelterId) throws IOException {
        byte[] excelData = reportService.generateAllocationReport(shelterId);
        
        String fileName = "安置物资报告_" + shelterId + "_" + 
                LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".xlsx";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", new String(fileName.getBytes("UTF-8"), "ISO-8859-1"));

        return ResponseEntity.ok()
                .headers(headers)
                .body(excelData);
    }
}

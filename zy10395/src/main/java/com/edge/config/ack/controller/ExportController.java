package com.edge.config.ack.controller;

import com.edge.config.ack.dto.DeliveryQueryReq;
import com.edge.config.ack.service.ExportService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@RestController
@RequestMapping("/api/v1/export")
@RequiredArgsConstructor
public class ExportController {
    private final ExportService exportService;
    private static final DateTimeFormatter FILE_NAME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @GetMapping("/delivery")
    public ResponseEntity<byte[]> exportDelivery(DeliveryQueryReq req) throws IOException {
        log.info("export delivery request, nodeCode:{}, versionNo:{}", req.getNodeCode(), req.getVersionNo());
        byte[] data = exportService.exportDelivery(req);
        String fileName = "delivery_" + LocalDateTime.now().format(FILE_NAME_FORMATTER) + ".xlsx";
        return buildResponse(data, fileName);
    }

    @GetMapping("/receipt/{deliveryNo}")
    public ResponseEntity<byte[]> exportReceipt(@PathVariable String deliveryNo) throws IOException {
        log.info("export receipt request, deliveryNo:{}", deliveryNo);
        byte[] data = exportService.exportReceipt(deliveryNo);
        String fileName = "receipt_" + deliveryNo + "_" + LocalDateTime.now().format(FILE_NAME_FORMATTER) + ".xlsx";
        return buildResponse(data, fileName);
    }

    @GetMapping("/failure/{deliveryNo}")
    public ResponseEntity<byte[]> exportFailure(@PathVariable String deliveryNo) throws IOException {
        log.info("export failure request, deliveryNo:{}", deliveryNo);
        byte[] data = exportService.exportFailure(deliveryNo);
        String fileName = "failure_" + deliveryNo + "_" + LocalDateTime.now().format(FILE_NAME_FORMATTER) + ".xlsx";
        return buildResponse(data, fileName);
    }

    @GetMapping("/check/{deliveryNo}")
    public ResponseEntity<byte[]> exportCheck(@PathVariable String deliveryNo) throws IOException {
        log.info("export check request, deliveryNo:{}", deliveryNo);
        byte[] data = exportService.exportCheck(deliveryNo);
        String fileName = "check_" + deliveryNo + "_" + LocalDateTime.now().format(FILE_NAME_FORMATTER) + ".xlsx";
        return buildResponse(data, fileName);
    }

    private ResponseEntity<byte[]> buildResponse(byte[] data, String fileName) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", URLEncoder.encode(fileName, StandardCharsets.UTF_8));
        headers.setContentLength(data.length);
        return ResponseEntity.ok().headers(headers).body(data);
    }
}

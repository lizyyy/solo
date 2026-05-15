package com.edge.config.ack.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.edge.config.ack.common.Result;
import com.edge.config.ack.dto.*;
import com.edge.config.ack.entity.*;
import com.edge.config.ack.service.ConfigDeliveryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/delivery")
@RequiredArgsConstructor
public class ConfigDeliveryController {
    private final ConfigDeliveryService deliveryService;

    @PostMapping("/create")
    public Result<ConfigDelivery> createDelivery(@Valid @RequestBody DeliveryCreateReq req, HttpServletRequest request) {
        log.info("create delivery request, nodeCode:{}, versionNo:{}", req.getNodeCode(), req.getVersionNo());
        return deliveryService.createDelivery(req, request);
    }

    @PostMapping("/ack")
    public Result<AckReceipt> ackDelivery(@Valid @RequestBody DeliveryAckReq req, HttpServletRequest request) {
        log.info("ack delivery request, deliveryNo:{}, ackResult:{}", req.getDeliveryNo(), req.getAckResult());
        return deliveryService.ackDelivery(req, request);
    }

    @PostMapping("/effective-check")
    public Result<EffectiveCheck> effectiveCheck(@Valid @RequestBody EffectiveCheckReq req) {
        log.info("effective check request, deliveryNo:{}, checkResult:{}", req.getDeliveryNo(), req.getCheckResult());
        return deliveryService.effectiveCheck(req);
    }

    @GetMapping("/list")
    public Result<IPage<ConfigDelivery>> queryDelivery(@Valid DeliveryQueryReq req) {
        log.info("query delivery request, nodeCode:{}, versionNo:{}, status:{}", req.getNodeCode(), req.getVersionNo(), req.getStatus());
        return deliveryService.queryDelivery(req);
    }

    @GetMapping("/{deliveryNo}")
    public Result<ConfigDelivery> getDeliveryDetail(@PathVariable String deliveryNo) {
        log.info("get delivery detail request, deliveryNo:{}", deliveryNo);
        return deliveryService.getDeliveryDetail(deliveryNo);
    }

    @GetMapping("/{deliveryNo}/receipts")
    public Result<List<AckReceipt>> getReceiptHistory(@PathVariable String deliveryNo) {
        log.info("get receipt history request, deliveryNo:{}", deliveryNo);
        return deliveryService.getReceiptHistory(deliveryNo);
    }

    @GetMapping("/{deliveryNo}/failures")
    public Result<List<FailureReason>> getFailureHistory(@PathVariable String deliveryNo) {
        log.info("get failure history request, deliveryNo:{}", deliveryNo);
        return deliveryService.getFailureHistory(deliveryNo);
    }

    @GetMapping("/reconciliation/{versionNo}")
    public Result<List<ReconciliationResult>> reconciliation(@PathVariable String versionNo) {
        log.info("reconciliation request, versionNo:{}", versionNo);
        return deliveryService.reconciliation(versionNo);
    }
}

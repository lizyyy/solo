package com.livestock.transfer.common;

import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class TransferNoGenerator {
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private final AtomicInteger counter = new AtomicInteger(0);

    public String generateTransferNo() {
        String timestamp = LocalDateTime.now().format(FORMATTER);
        int seq = counter.incrementAndGet() % 10000;
        return "TF" + timestamp + String.format("%04d", seq);
    }

    public String generateAcceptanceNo() {
        String timestamp = LocalDateTime.now().format(FORMATTER);
        int seq = counter.incrementAndGet() % 10000;
        return "AC" + timestamp + String.format("%04d", seq);
    }

    public String generateReportNo() {
        String timestamp = LocalDateTime.now().format(FORMATTER);
        int seq = counter.incrementAndGet() % 10000;
        return "RP" + timestamp + String.format("%04d", seq);
    }
}

package com.manufacture.outsourcing.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

public class NoGenerator {

    private NoGenerator() {
    }

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    public static String generateOrderNo() {
        return "PO" + LocalDateTime.now().format(DATE_FORMATTER) + randomSuffix(4);
    }

    public static String generateBatchNo() {
        return "DB" + LocalDateTime.now().format(DATE_FORMATTER) + randomSuffix(4);
    }

    public static String generateInspectionNo() {
        return "IR" + LocalDateTime.now().format(DATE_FORMATTER) + randomSuffix(4);
    }

    public static String generateDeductionNo() {
        return "DR" + LocalDateTime.now().format(DATE_FORMATTER) + randomSuffix(4);
    }

    public static String generateReplenishmentNo() {
        return "RT" + LocalDateTime.now().format(DATE_FORMATTER) + randomSuffix(4);
    }

    private static String randomSuffix(int length) {
        String uuid = UUID.randomUUID().toString().replace("-", "");
        return uuid.substring(0, length).toUpperCase();
    }
}

package com.paymentguard.common.util;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

public final class IdGenerator {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    private IdGenerator() {}

    public static String generateOrderId() {
        String timestamp = LocalDateTime.now().format(DATE_FORMATTER);
        String random = generateRandomString(8);
        return "ORD" + timestamp + random;
    }

    public static String generatePaymentId() {
        String timestamp = LocalDateTime.now().format(DATE_FORMATTER);
        String random = generateRandomString(10);
        return "PAY" + timestamp + random;
    }

    public static String generateTransactionId() {
        String timestamp = LocalDateTime.now().format(DATE_FORMATTER);
        String random = generateRandomString(12);
        return "TXN" + timestamp + random;
    }

    public static String generateCallbackId() {
        String timestamp = LocalDateTime.now().format(DATE_FORMATTER);
        String random = generateRandomString(8);
        return "CBK" + timestamp + random;
    }

    public static String generateTraceId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 32);
    }

    public static String generateSpanId() {
        return generateRandomString(16);
    }

    public static String generateIdempotencyKey() {
        return UUID.randomUUID().toString();
    }

    private static String generateRandomString(int length) {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}

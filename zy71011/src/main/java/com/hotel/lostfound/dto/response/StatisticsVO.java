package com.hotel.lostfound.dto.response;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
public class StatisticsVO {

    private long totalItems;

    private long registeredCount;

    private long verifiedCount;

    private long pendingClaimCount;

    private long claimedCount;

    private long mailedCount;

    private long disposedCount;

    private long expiredCount;

    private long valuableCount;

    private long pendingReviewCount;

    private long newItemsThisMonth;

    private LocalDateTime queryTime;

    private Map<String, Long> categoryStats;
}

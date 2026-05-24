package com.hotel.lostfound.dto.response;

import java.time.LocalDateTime;
import java.util.Map;

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

    public long getTotalItems() {
        return totalItems;
    }

    public void setTotalItems(long totalItems) {
        this.totalItems = totalItems;
    }

    public long getRegisteredCount() {
        return registeredCount;
    }

    public void setRegisteredCount(long registeredCount) {
        this.registeredCount = registeredCount;
    }

    public long getVerifiedCount() {
        return verifiedCount;
    }

    public void setVerifiedCount(long verifiedCount) {
        this.verifiedCount = verifiedCount;
    }

    public long getPendingClaimCount() {
        return pendingClaimCount;
    }

    public void setPendingClaimCount(long pendingClaimCount) {
        this.pendingClaimCount = pendingClaimCount;
    }

    public long getClaimedCount() {
        return claimedCount;
    }

    public void setClaimedCount(long claimedCount) {
        this.claimedCount = claimedCount;
    }

    public long getMailedCount() {
        return mailedCount;
    }

    public void setMailedCount(long mailedCount) {
        this.mailedCount = mailedCount;
    }

    public long getDisposedCount() {
        return disposedCount;
    }

    public void setDisposedCount(long disposedCount) {
        this.disposedCount = disposedCount;
    }

    public long getExpiredCount() {
        return expiredCount;
    }

    public void setExpiredCount(long expiredCount) {
        this.expiredCount = expiredCount;
    }

    public long getValuableCount() {
        return valuableCount;
    }

    public void setValuableCount(long valuableCount) {
        this.valuableCount = valuableCount;
    }

    public long getPendingReviewCount() {
        return pendingReviewCount;
    }

    public void setPendingReviewCount(long pendingReviewCount) {
        this.pendingReviewCount = pendingReviewCount;
    }

    public long getNewItemsThisMonth() {
        return newItemsThisMonth;
    }

    public void setNewItemsThisMonth(long newItemsThisMonth) {
        this.newItemsThisMonth = newItemsThisMonth;
    }

    public LocalDateTime getQueryTime() {
        return queryTime;
    }

    public void setQueryTime(LocalDateTime queryTime) {
        this.queryTime = queryTime;
    }

    public Map<String, Long> getCategoryStats() {
        return categoryStats;
    }

    public void setCategoryStats(Map<String, Long> categoryStats) {
        this.categoryStats = categoryStats;
    }
}

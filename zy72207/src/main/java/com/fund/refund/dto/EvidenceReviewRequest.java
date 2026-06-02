package com.fund.refund.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class EvidenceReviewRequest {

    private Long batchId;

    private String reviewer;

    private List<EvidenceItem> evidenceItems;

    public static class EvidenceItem {
        private String bizNo;
        private LocalDate exDividendDate;
        private String evidenceSource;
        private String evidenceContent;
        private String screenshotUrl;
        private String reviewRemark;
        private LocalDateTime reviewedAt;

        public String getBizNo() {
            return bizNo;
        }

        public void setBizNo(String bizNo) {
            this.bizNo = bizNo;
        }

        public LocalDate getExDividendDate() {
            return exDividendDate;
        }

        public void setExDividendDate(LocalDate exDividendDate) {
            this.exDividendDate = exDividendDate;
        }

        public String getEvidenceSource() {
            return evidenceSource;
        }

        public void setEvidenceSource(String evidenceSource) {
            this.evidenceSource = evidenceSource;
        }

        public String getEvidenceContent() {
            return evidenceContent;
        }

        public void setEvidenceContent(String evidenceContent) {
            this.evidenceContent = evidenceContent;
        }

        public String getScreenshotUrl() {
            return screenshotUrl;
        }

        public void setScreenshotUrl(String screenshotUrl) {
            this.screenshotUrl = screenshotUrl;
        }

        public String getReviewRemark() {
            return reviewRemark;
        }

        public void setReviewRemark(String reviewRemark) {
            this.reviewRemark = reviewRemark;
        }

        public LocalDateTime getReviewedAt() {
            return reviewedAt;
        }

        public void setReviewedAt(LocalDateTime reviewedAt) {
            this.reviewedAt = reviewedAt;
        }
    }

    public Long getBatchId() {
        return batchId;
    }

    public void setBatchId(Long batchId) {
        this.batchId = batchId;
    }

    public String getReviewer() {
        return reviewer;
    }

    public void setReviewer(String reviewer) {
        this.reviewer = reviewer;
    }

    public List<EvidenceItem> getEvidenceItems() {
        return evidenceItems;
    }

    public void setEvidenceItems(List<EvidenceItem> evidenceItems) {
        this.evidenceItems = evidenceItems;
    }
}

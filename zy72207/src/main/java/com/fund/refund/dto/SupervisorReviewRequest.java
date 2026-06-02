package com.fund.refund.dto;

import java.util.List;

public class SupervisorReviewRequest {

    private Long batchId;

    private String supervisor;

    private List<ReviewItem> reviewItems;

    public static class ReviewItem {
        private Long detailId;
        private String bizNo;
        private String sameBizNoGroup;
        private Boolean approved;
        private String supervisorRemark;

        public Long getDetailId() {
            return detailId;
        }

        public void setDetailId(Long detailId) {
            this.detailId = detailId;
        }

        public String getBizNo() {
            return bizNo;
        }

        public void setBizNo(String bizNo) {
            this.bizNo = bizNo;
        }

        public String getSameBizNoGroup() {
            return sameBizNoGroup;
        }

        public void setSameBizNoGroup(String sameBizNoGroup) {
            this.sameBizNoGroup = sameBizNoGroup;
        }

        public Boolean getApproved() {
            return approved;
        }

        public void setApproved(Boolean approved) {
            this.approved = approved;
        }

        public String getSupervisorRemark() {
            return supervisorRemark;
        }

        public void setSupervisorRemark(String supervisorRemark) {
            this.supervisorRemark = supervisorRemark;
        }
    }

    public Long getBatchId() {
        return batchId;
    }

    public void setBatchId(Long batchId) {
        this.batchId = batchId;
    }

    public String getSupervisor() {
        return supervisor;
    }

    public void setSupervisor(String supervisor) {
        this.supervisor = supervisor;
    }

    public List<ReviewItem> getReviewItems() {
        return reviewItems;
    }

    public void setReviewItems(List<ReviewItem> reviewItems) {
        this.reviewItems = reviewItems;
    }
}

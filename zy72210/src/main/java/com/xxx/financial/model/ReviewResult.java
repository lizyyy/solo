package com.xxx.financial.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.xxx.financial.enums.ReviewStatus;

import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewResult {
    private boolean success;
    private ReviewStatus finalStatus;
    private String reviewNo;
    private List<String> messages;
    private List<SelfCheckResult> selfCheckReport;
    private List<ConflictEvidence> conflictReport;
    private String nextAction;
    private String handler;

    public ReviewResult() {
    }

    public ReviewResult(boolean success, ReviewStatus finalStatus, String reviewNo) {
        this.success = success;
        this.finalStatus = finalStatus;
        this.reviewNo = reviewNo;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public ReviewStatus getFinalStatus() {
        return finalStatus;
    }

    public void setFinalStatus(ReviewStatus finalStatus) {
        this.finalStatus = finalStatus;
    }

    public String getReviewNo() {
        return reviewNo;
    }

    public void setReviewNo(String reviewNo) {
        this.reviewNo = reviewNo;
    }

    public List<String> getMessages() {
        return messages;
    }

    public void setMessages(List<String> messages) {
        this.messages = messages;
    }

    public List<SelfCheckResult> getSelfCheckReport() {
        return selfCheckReport;
    }

    public void setSelfCheckReport(List<SelfCheckResult> selfCheckReport) {
        this.selfCheckReport = selfCheckReport;
    }

    public List<ConflictEvidence> getConflictReport() {
        return conflictReport;
    }

    public void setConflictReport(List<ConflictEvidence> conflictReport) {
        this.conflictReport = conflictReport;
    }

    public String getNextAction() {
        return nextAction;
    }

    public void setNextAction(String nextAction) {
        this.nextAction = nextAction;
    }

    public String getHandler() {
        return handler;
    }

    public void setHandler(String handler) {
        this.handler = handler;
    }

    public String formatResultSummary() {
        StringBuilder sb = new StringBuilder();
        sb.append("【企业票据贴现利息复核结果】\n");
        sb.append("复核单号: ").append(reviewNo).append("\n");
        sb.append("最终状态: ").append(finalStatus.getDescription()).append("\n");
        sb.append("处理结果: ").append(success ? "成功" : "需人工介入").append("\n");
        if (nextAction != null) {
            sb.append("下一步操作: ").append(nextAction).append("\n");
        }
        if (handler != null) {
            sb.append("处理人: ").append(handler).append("\n");
        }
        return sb.toString();
    }
}

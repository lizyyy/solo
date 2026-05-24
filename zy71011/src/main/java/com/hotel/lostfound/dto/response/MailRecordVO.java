package com.hotel.lostfound.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class MailRecordVO {

    private Long id;

    private String receiverName;

    private String receiverPhone;

    private String receiverAddress;

    private String courierCompany;

    private String trackingNumber;

    private BigDecimal postage;

    private boolean postagePaid;

    private String itemProofImageUrls;

    private String shippingProofImageUrls;

    private String handledBy;

    private LocalDateTime shippedAt;

    private LocalDateTime deliveredAt;

    private boolean signedReceived;

    private String remark;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public void setReceiverName(String receiverName) {
        this.receiverName = receiverName;
    }

    public String getReceiverPhone() {
        return receiverPhone;
    }

    public void setReceiverPhone(String receiverPhone) {
        this.receiverPhone = receiverPhone;
    }

    public String getReceiverAddress() {
        return receiverAddress;
    }

    public void setReceiverAddress(String receiverAddress) {
        this.receiverAddress = receiverAddress;
    }

    public String getCourierCompany() {
        return courierCompany;
    }

    public void setCourierCompany(String courierCompany) {
        this.courierCompany = courierCompany;
    }

    public String getTrackingNumber() {
        return trackingNumber;
    }

    public void setTrackingNumber(String trackingNumber) {
        this.trackingNumber = trackingNumber;
    }

    public BigDecimal getPostage() {
        return postage;
    }

    public void setPostage(BigDecimal postage) {
        this.postage = postage;
    }

    public boolean isPostagePaid() {
        return postagePaid;
    }

    public void setPostagePaid(boolean postagePaid) {
        this.postagePaid = postagePaid;
    }

    public String getItemProofImageUrls() {
        return itemProofImageUrls;
    }

    public void setItemProofImageUrls(String itemProofImageUrls) {
        this.itemProofImageUrls = itemProofImageUrls;
    }

    public String getShippingProofImageUrls() {
        return shippingProofImageUrls;
    }

    public void setShippingProofImageUrls(String shippingProofImageUrls) {
        this.shippingProofImageUrls = shippingProofImageUrls;
    }

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    public LocalDateTime getShippedAt() {
        return shippedAt;
    }

    public void setShippedAt(LocalDateTime shippedAt) {
        this.shippedAt = shippedAt;
    }

    public LocalDateTime getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(LocalDateTime deliveredAt) {
        this.deliveredAt = deliveredAt;
    }

    public boolean isSignedReceived() {
        return signedReceived;
    }

    public void setSignedReceived(boolean signedReceived) {
        this.signedReceived = signedReceived;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}

package com.hotel.lostfound.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "mail_records")
public class MailRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false)
    private LostItem lostItem;

    @Column(nullable = false, length = 100)
    private String receiverName;

    @Column(nullable = false, length = 50)
    private String receiverPhone;

    @Column(nullable = false, length = 500)
    private String receiverAddress;

    @Column(nullable = false, length = 100)
    private String courierCompany;

    @Column(nullable = false, length = 50)
    private String trackingNumber;

    @Column(precision = 8, scale = 2)
    private BigDecimal postage;

    private boolean postagePaid;

    @Column(length = 500)
    private String itemProofImageUrls;

    @Column(length = 500)
    private String shippingProofImageUrls;

    @Column(nullable = false, length = 50)
    private String handledBy;

    @Column(nullable = false)
    private LocalDateTime shippedAt;

    private LocalDateTime deliveredAt;

    private boolean signedReceived;

    @Column(length = 500)
    private String remark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String requestId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LostItem getLostItem() {
        return lostItem;
    }

    public void setLostItem(LostItem lostItem) {
        this.lostItem = lostItem;
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

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }
}

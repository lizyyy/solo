package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "lost_items")
public class LostItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String itemNo;

    @Column(nullable = false, length = 200)
    private String itemName;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ItemCategory category;

    @Column(precision = 10, scale = 2)
    private BigDecimal estimatedValue;

    private boolean isValuable;

    private boolean requireManagerReview;

    private String roomNumber;

    @Column(length = 100)
    private String pickUpLocation;

    @Column(nullable = false, length = 50)
    private String pickedByStaff;

    @Column(length = 100)
    private String storageLocation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LostItemStatus status;

    @Column(nullable = false)
    private LocalDateTime foundTime;

    private LocalDateTime expiredTime;

    @Column(length = 200)
    private String ownerName;

    @Column(length = 50)
    private String ownerPhone;

    private boolean verified;

    private String verifiedBy;

    private LocalDateTime verifiedAt;

    @Column(length = 500)
    private String verifyRemark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "lostItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ClaimRecord> claimRecords = new ArrayList<>();

    @OneToMany(mappedBy = "lostItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StatusHistory> statusHistories = new ArrayList<>();

    @OneToMany(mappedBy = "lostItem", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<MailRecord> mailRecords = new ArrayList<>();

    @OneToOne(mappedBy = "lostItem", cascade = CascadeType.ALL)
    private DisposalRecord disposalRecord;

    @Column(nullable = false)
    private String requestId;

    public void addStatusHistory(LostItemStatus fromStatus, LostItemStatus toStatus, String operator, String remark) {
        StatusHistory history = new StatusHistory();
        history.setLostItem(this);
        history.setFromStatus(fromStatus);
        history.setToStatus(toStatus);
        history.setOperator(operator);
        history.setRemark(remark);
        history.setOperateTime(LocalDateTime.now());
        this.statusHistories.add(history);
    }
}

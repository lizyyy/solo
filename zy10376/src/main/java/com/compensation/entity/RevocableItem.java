package com.compensation.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "revocable_item", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"action_id", "itemId"})
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RevocableItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String itemId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "action_id", nullable = false)
    private ExecutedAction executedAction;
    
    @Column(nullable = false, length = 128)
    private String itemType;
    
    @Column(nullable = false, length = 512)
    private String itemKey;
    
    @Column(length = 1024)
    private String itemDescription;
    
    @Column(length = 2048)
    private String beforeState;
    
    @Column(length = 2048)
    private String afterState;
    
    @Column(nullable = false)
    private Boolean revocable;
    
    @Column(length = 128)
    private String compensationMethod;
    
    @Column(length = 2048)
    private String compensationParams;
    
    private Boolean compensated;
    
    private LocalDateTime compensatedAt;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (revocable == null) revocable = true;
        if (compensated == null) compensated = false;
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

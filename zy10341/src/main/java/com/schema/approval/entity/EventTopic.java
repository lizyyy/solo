package com.schema.approval.entity;

import com.schema.approval.enums.CompatibilityLevel;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "event_topic", uniqueConstraints = {
    @UniqueConstraint(columnNames = "topic_name")
})
public class EventTopic extends BaseEntity {
    @Column(name = "topic_name", nullable = false, length = 255)
    private String topicName;

    @Column(name = "description", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "compatibility_level", nullable = false)
    private CompatibilityLevel compatibilityLevel = CompatibilityLevel.BACKWARD;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "owner_team", nullable = false)
    private String ownerTeam;

    @Column(name = "business_domain")
    private String businessDomain;
}

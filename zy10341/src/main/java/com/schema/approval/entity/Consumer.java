package com.schema.approval.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "consumer", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"consumer_group", "topic_id"})
})
public class Consumer extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id", nullable = false)
    private EventTopic topic;

    @Column(name = "consumer_group", nullable = false)
    private String consumerGroup;

    @Column(name = "service_name", nullable = false)
    private String serviceName;

    @Column(name = "owner_team", nullable = false)
    private String ownerTeam;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "notify_on_schema_change", nullable = false)
    private Boolean notifyOnSchemaChange = true;
}

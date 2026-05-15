package com.observability.tagvalidation.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@Entity
@Table(name = "allowed_value", indexes = {
    @Index(name = "idx_value", columnList = "value"),
    @Index(name = "idx_tag_key_id", columnList = "tag_key_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = "tagKey")
public class AllowedValue extends BaseEntity {
    @Column(name = "value", nullable = false, length = 256)
    private String value;

    @Column(name = "description", length = 512)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tag_key_id", nullable = false)
    private TagKey tagKey;
}

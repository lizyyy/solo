package com.observability.tagvalidation.repository;

import com.observability.tagvalidation.entity.AllowedValue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AllowedValueRepository extends JpaRepository<AllowedValue, Long> {
    List<AllowedValue> findByTagKeyId(Long tagKeyId);
    Optional<AllowedValue> findByTagKeyIdAndValue(Long tagKeyId, String value);
    boolean existsByTagKeyIdAndValue(Long tagKeyId, String value);
}

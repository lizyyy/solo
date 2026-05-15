package com.crossborder.approval.repository;

import com.crossborder.approval.model.entity.DataDomain;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DataDomainRepository extends JpaRepository<DataDomain, Long> {
    Optional<DataDomain> findByCode(String code);
}

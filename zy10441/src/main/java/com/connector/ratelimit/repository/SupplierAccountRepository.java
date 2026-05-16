package com.connector.ratelimit.repository;

import com.connector.ratelimit.model.entity.SupplierAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplierAccountRepository extends JpaRepository<SupplierAccount, Long> {
    Optional<SupplierAccount> findByAccountCode(String accountCode);
    List<SupplierAccount> findBySupplierCode(String supplierCode);
}

package com.paymentguard.payment.repository;

import com.paymentguard.common.enums.PaymentStatus;
import com.paymentguard.payment.entity.PaymentTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentTransactionRepository extends JpaRepository<PaymentTransaction, Long> {

    Optional<PaymentTransaction> findByTransactionId(String transactionId);

    Optional<PaymentTransaction> findByChannelOrderId(String channelOrderId);

    List<PaymentTransaction> findByOrderIdOrderByCreatedAtDesc(String orderId);

    @Query("SELECT p FROM PaymentTransaction p WHERE p.orderId = :orderId AND p.status = :status")
    List<PaymentTransaction> findByOrderIdAndStatus(@Param("orderId") String orderId, 
                                                     @Param("status") PaymentStatus status);

    long countByOrderIdAndStatus(String orderId, PaymentStatus status);

    boolean existsByTransactionId(String transactionId);
}

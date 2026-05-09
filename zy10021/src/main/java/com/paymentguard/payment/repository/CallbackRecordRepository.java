package com.paymentguard.payment.repository;

import com.paymentguard.common.enums.CallbackStatus;
import com.paymentguard.payment.entity.CallbackRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CallbackRecordRepository extends JpaRepository<CallbackRecord, Long> {

    List<CallbackRecord> findByOrderIdOrderByCreatedAtDesc(String orderId);

    List<CallbackRecord> findByTransactionIdOrderByCreatedAtDesc(String transactionId);

    List<CallbackRecord> findByTraceIdOrderByCreatedAtAsc(String traceId);

    @Query("SELECT COUNT(c) FROM CallbackRecord c WHERE c.transactionId = :transactionId")
    long countByTransactionId(@Param("transactionId") String transactionId);

    @Query("SELECT COUNT(c) FROM CallbackRecord c WHERE c.transactionId = :transactionId AND c.status = :status")
    long countByTransactionIdAndStatus(@Param("transactionId") String transactionId, 
                                       @Param("status") CallbackStatus status);

    @Query("SELECT c FROM CallbackRecord c WHERE c.orderId = :orderId AND c.isDuplicate = true")
    List<CallbackRecord> findDuplicateCallbacksByOrderId(@Param("orderId") String orderId);
}

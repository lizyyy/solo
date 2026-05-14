package com.feiyong.feecalc.repository;

import com.feiyong.feecalc.entity.DiscountItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DiscountItemRepository extends JpaRepository<DiscountItem, Long> {

    Optional<DiscountItem> findByDiscountCodeAndEnabledTrue(String discountCode);

    List<DiscountItem> findByDiscountCodeInAndEnabledTrue(List<String> discountCodes);
}

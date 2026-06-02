package com.fund.refund.mapper;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fund.refund.entity.RefundDetail;
import org.apache.ibatis.annotations.Mapper;
import java.util.List;

@Mapper
public interface RefundDetailMapper extends BaseMapper<RefundDetail> {

    default List<RefundDetail> selectByBatchId(Long batchId) {
        return selectList(new LambdaQueryWrapper<RefundDetail>()
                .eq(RefundDetail::getBatchId, batchId)
                .orderByAsc(RefundDetail::getCustodianRowNo, RefundDetail::getDetailType));
    }

    default List<RefundDetail> selectByBizNo(Long batchId, String bizNo) {
        return selectList(new LambdaQueryWrapper<RefundDetail>()
                .eq(RefundDetail::getBatchId, batchId)
                .eq(RefundDetail::getBizNo, bizNo)
                .orderByAsc(RefundDetail::getDetailType));
    }

    default List<RefundDetail> selectBySameBizNoGroup(Long batchId, String sameBizNoGroup) {
        return selectList(new LambdaQueryWrapper<RefundDetail>()
                .eq(RefundDetail::getBatchId, batchId)
                .eq(RefundDetail::getSameBizNoGroup, sameBizNoGroup)
                .orderByAsc(RefundDetail::getDetailType));
    }

    default List<RefundDetail> selectPendingSupervisor(Long batchId) {
        return selectList(new LambdaQueryWrapper<RefundDetail>()
                .eq(RefundDetail::getBatchId, batchId)
                .eq(RefundDetail::getProcessStatus, "pending_supervisor")
                .orderByAsc(RefundDetail::getSameBizNoGroup, RefundDetail::getDetailType));
    }
}

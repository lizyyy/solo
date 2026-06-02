package com.fund.refund.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.fund.refund.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {
}

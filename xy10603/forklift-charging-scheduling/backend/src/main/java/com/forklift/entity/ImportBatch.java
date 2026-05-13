package com.forklift.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("import_batches")
public class ImportBatch {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String batchCode;
    private String fileName;
    private String fileType;
    private Integer totalRecords;
    private Integer successCount;
    private Integer failCount;
    private String status;
    private String errorLog;
    private LocalDateTime createdAt;
    private String createdBy;
}

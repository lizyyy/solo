import { AppDataSource } from "../config/database";
import { ExceptionLog } from "../entities/ExceptionLog";
import { v4 as uuidv4 } from "uuid";

export class ExceptionLogService {
  private exceptionLogRepository = AppDataSource.getRepository(ExceptionLog);

  async logException(
    requestPath: string,
    requestMethod: string,
    rawInput: string,
    error: Error,
    handlingConclusion?: string
  ): Promise<ExceptionLog> {
    const log = new ExceptionLog();
    log.requestId = uuidv4();
    log.requestPath = requestPath;
    log.requestMethod = requestMethod;
    log.rawInput = rawInput;
    log.errorMessage = error.message;
    log.errorStack = error.stack;
    log.handlingConclusion = handlingConclusion || "待处理";
    log.isResolved = false;

    return await this.exceptionLogRepository.save(log);
  }

  async resolveException(
    logId: string,
    resolvedBy: string,
    handlingConclusion: string
  ): Promise<ExceptionLog> {
    const log = await this.exceptionLogRepository.findOne({
      where: { id: logId },
    });

    if (!log) {
      throw new Error(`异常日志 ${logId} 不存在`);
    }

    log.isResolved = true;
    log.resolvedBy = resolvedBy;
    log.resolvedAt = new Date();
    log.handlingConclusion = handlingConclusion;

    return await this.exceptionLogRepository.save(log);
  }

  async getExceptionLogs(isResolved?: boolean): Promise<ExceptionLog[]> {
    const where = isResolved !== undefined ? { isResolved } : {};
    return await this.exceptionLogRepository.find({
      where,
      order: { createdAt: "DESC" },
    });
  }

  async getExceptionLog(id: string): Promise<ExceptionLog | null> {
    return await this.exceptionLogRepository.findOne({
      where: { id },
    });
  }
}

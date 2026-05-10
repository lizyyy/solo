import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from '../services/health.service';

@ApiTags('系统')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '健康检查' })
  async health() {
    return this.healthService.health();
  }

  @Get('status')
  @ApiOperation({ summary: '系统状态' })
  async status() {
    return this.healthService.getSystemStatus();
  }
}

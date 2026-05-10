import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('屠宰检疫证流转服务')
    .setDescription(
      '屠宰检疫证流转系统 - 解决养殖、运输、市场端证号重复问题，提供批次绑定、运输核销、市场验收等功能',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('检疫证管理', '检疫证的录入、查询和状态管理')
    .addTag('批次管理', '批次绑定、解绑和查询')
    .addTag('运输核销', '运输记录的登记和核销')
    .addTag('市场验收', '市场端的验收和核验')
    .addTag('作废重开', '检疫证作废和重新开具')
    .addTag('监管导出', '监管部门数据导出和复核')
    .addTag('历史记录', '流转历史和审计日志查询')
    .addTag('人工复核', '异常情况的人工复核处理')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`\n========================================
  屠宰检疫证流转服务已启动
  API 地址: http://localhost:${port}/api/v1
  Swagger 文档: http://localhost:${port}/docs
========================================`);
}

bootstrap();

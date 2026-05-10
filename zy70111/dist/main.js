"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const logger = new common_1.Logger('Bootstrap');
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.enableCors();
    const config = new swagger_1.DocumentBuilder()
        .setTitle('屠宰检疫证流转服务')
        .setDescription('屠宰检疫证流转系统 - 解决养殖、运输、市场端证号重复问题，提供批次绑定、运输核销、市场验收等功能')
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const port = configService.get('PORT', 3000);
    await app.listen(port);
    logger.log(`\n========================================
  屠宰检疫证流转服务已启动
  API 地址: http://localhost:${port}/api/v1
  Swagger 文档: http://localhost:${port}/docs
========================================`);
}
bootstrap();
//# sourceMappingURL=main.js.map
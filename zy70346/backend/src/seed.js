const { v4: uuidv4 } = require('uuid');
const sequelize = require('./config/database');
const {
  Template,
  TemplateVersion,
  VariableDictionary,
  ReleaseRecord,
  AuditLog
} = require('./models');

const sampleTemplates = [
  {
    name: '登录验证码',
    category: 'verification',
    description: '用户登录、注册、找回密码时发送的验证码短信',
    variables: [
      {
        variableName: 'code',
        displayName: '验证码',
        isRequired: true,
        dataType: 'string',
        defaultValue: '123456',
        description: '6位数字验证码'
      },
      {
        variableName: 'expireMinutes',
        displayName: '有效期（分钟）',
        isRequired: true,
        dataType: 'number',
        defaultValue: '5',
        description: '验证码有效期'
      },
      {
        variableName: 'productName',
        displayName: '产品名称',
        isRequired: true,
        dataType: 'string',
        defaultValue: '我的应用',
        description: '品牌或产品名称'
      }
    ],
    smsContent: '【{{productName}}】您的验证码是{{code}}，{{expireMinutes}}分钟内有效，请勿泄露给他人。',
    emailSubject: '{{productName}} - 登录验证码',
    emailContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">{{productName}}</h1>
  </div>
  <div style="padding: 40px; background: #f8f9fa;">
    <h2 style="color: #333; margin-top: 0;">您的验证码</h2>
    <div style="background: white; padding: 30px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <span style="font-size: 48px; font-weight: bold; color: #667eea; letter-spacing: 10px;">{{code}}</span>
    </div>
    <p style="color: #666; line-height: 1.6;">
      请在 <strong>{{expireMinutes}}分钟</strong> 内完成验证。
    </p>
    <p style="color: #999; font-size: 14px; margin-top: 30px;">
      如果您没有进行此操作，请忽略此邮件。
    </p>
  </div>
</div>`,
    inAppTitle: '登录验证码',
    inAppContent: '您的验证码是 {{code}}，{{expireMinutes}}分钟内有效。'
  },
  {
    name: '月度账单提醒',
    category: 'billing',
    description: '每月账单生成后发送给用户的提醒通知',
    variables: [
      {
        variableName: 'userName',
        displayName: '用户姓名',
        isRequired: true,
        dataType: 'string',
        defaultValue: '张三',
        description: '用户的姓名或昵称'
      },
      {
        variableName: 'billMonth',
        displayName: '账单月份',
        isRequired: true,
        dataType: 'string',
        defaultValue: '2024年1月',
        description: '账单所属月份'
      },
      {
        variableName: 'amount',
        displayName: '账单金额',
        isRequired: true,
        dataType: 'string',
        defaultValue: '199.00',
        description: '账单应付金额'
      },
      {
        variableName: 'dueDate',
        displayName: '截止日期',
        isRequired: true,
        dataType: 'date',
        defaultValue: '2024-01-31',
        description: '付款截止日期'
      }
    ],
    smsContent: '【我的应用】{{userName}}您好，您{{billMonth}}的账单已生成，应付金额{{amount}}元，请于{{dueDate}}前完成支付。',
    emailSubject: '您的{{billMonth}}账单已生成',
    emailContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #2c3e50; padding: 30px; text-align: center;">
    <h1 style="color: white; margin: 0;">账单提醒</h1>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 16px; color: #333;">尊敬的 {{userName}}：</p>
    <p style="font-size: 16px; color: #333;">您 {{billMonth}} 的账单已生成，详情如下：</p>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 10px 0; color: #666;">账单月份</td>
          <td style="padding: 10px 0; text-align: right; color: #333;">{{billMonth}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666;">应付金额</td>
          <td style="padding: 10px 0; text-align: right; color: #e74c3c; font-size: 24px; font-weight: bold;">¥{{amount}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #666;">截止日期</td>
          <td style="padding: 10px 0; text-align: right; color: #333;">{{dueDate}}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="#" style="display: inline-block; background: #3498db; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px;">立即支付</a>
    </div>
    
    <p style="color: #999; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
      如有疑问，请联系客服：400-123-4567
    </p>
  </div>
</div>`,
    inAppTitle: '{{billMonth}}账单提醒',
    inAppContent: '您好{{userName}}，您{{billMonth}}的账单已生成，应付金额{{amount}}元，截止日期{{dueDate}}。'
  },
  {
    name: '限时活动通知',
    category: 'promotion',
    description: '促销活动、优惠信息等营销通知',
    variables: [
      {
        variableName: 'productName',
        displayName: '活动名称',
        isRequired: true,
        dataType: 'string',
        defaultValue: '新年特惠',
        description: '促销活动的名称'
      },
      {
        variableName: 'discount',
        displayName: '优惠力度',
        isRequired: true,
        dataType: 'string',
        defaultValue: '8折',
        description: '折扣或优惠描述'
      },
      {
        variableName: 'validUntil',
        displayName: '有效期至',
        isRequired: true,
        dataType: 'date',
        defaultValue: '2024-02-01',
        description: '活动截止日期'
      },
      {
        variableName: 'couponCode',
        displayName: '优惠码',
        isRequired: false,
        dataType: 'string',
        defaultValue: 'NEWYEAR2024',
        description: '专属优惠码'
      }
    ],
    smsContent: '【我的应用】{{productName}}活动火热进行中！全场{{discount}}优惠，使用优惠码{{couponCode}}，活动截止{{validUntil}}。',
    emailSubject: '{{productName}} - {{discount}}优惠限时领！',
    emailContent: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 50px 30px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 32px;">{{productName}}</h1>
    <p style="color: rgba(255,255,255,0.9); font-size: 18px; margin-top: 15px;">限时优惠，不容错过！</p>
  </div>
  
  <div style="padding: 30px; background: #fff;">
    <div style="text-align: center; padding: 30px 0; border-bottom: 2px dashed #eee;">
      <p style="color: #666; font-size: 16px; margin: 0;">全场</p>
      <p style="font-size: 72px; font-weight: bold; color: #f5576c; margin: 10px 0;">{{discount}}</p>
      <p style="color: #666; font-size: 16px; margin: 0;">优惠</p>
    </div>
    
    <div style="background: #fff8e1; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
      <p style="color: #666; margin: 0 0 10px 0;">您的专属优惠码</p>
      <span style="font-size: 28px; font-weight: bold; color: #f57c00; letter-spacing: 3px;">{{couponCode}}</span>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="#" style="display: inline-block; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 30px; font-size: 18px; font-weight: bold;">立即抢购</a>
    </div>
    
    <p style="color: #999; text-align: center; font-size: 14px;">
      活动截止日期：{{validUntil}}
    </p>
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
      <p style="color: #999; font-size: 12px;">
        如有疑问，请联系客服<br>
        不想再收到此类邮件？<a href="#" style="color: #667eea;">取消订阅</a>
      </p>
    </div>
  </div>
</div>`,
    inAppTitle: '{{productName}} - {{discount}}优惠限时领！',
    inAppContent: '{{productName}}活动火热进行中！全场{{discount}}优惠，使用优惠码{{couponCode}}，活动截止{{validUntil}}。'
  }
];

async function seed() {
  try {
    console.log('Starting database seeding...');
    
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    
    console.log('Database synchronized.');
    
    for (const templateData of sampleTemplates) {
      const templateId = uuidv4();
      
      const template = await Template.create({
        id: templateId,
        name: templateData.name,
        category: templateData.category,
        description: templateData.description,
        status: 'active'
      });
      
      console.log(`Created template: ${template.name}`);
      
      if (templateData.variables && templateData.variables.length > 0) {
        await VariableDictionary.bulkCreate(
          templateData.variables.map(v => ({
            id: uuidv4(),
            templateId,
            variableName: v.variableName,
            displayName: v.displayName,
            isRequired: v.isRequired,
            dataType: v.dataType,
            defaultValue: v.defaultValue,
            description: v.description
          }))
        );
        console.log(`  - Added ${templateData.variables.length} variables`);
      }
      
      const variableSnapshot = JSON.stringify(templateData.variables || []);
      const channelLimits = JSON.stringify({
        sms: { maxLength: 67 },
        email: { subjectMaxLength: 100 },
        inApp: { titleMaxLength: 50 }
      });
      
      const version = await TemplateVersion.create({
        id: uuidv4(),
        templateId,
        version: 'v1',
        versionNumber: 1,
        smsContent: templateData.smsContent,
        emailSubject: templateData.emailSubject,
        emailContent: templateData.emailContent,
        inAppTitle: templateData.inAppTitle,
        inAppContent: templateData.inAppContent,
        variableDictionary: variableSnapshot,
        channelLimits,
        status: 'draft',
        createdBy: 'seed'
      });
      
      console.log(`  - Created version: ${version.version}`);
      
      await AuditLog.create({
        id: uuidv4(),
        templateId,
        versionId: version.id,
        action: 'create',
        details: JSON.stringify({
          name: templateData.name,
          category: templateData.category,
          variablesCount: templateData.variables?.length || 0
        }),
        operator: 'seed'
      });
    }
    
    console.log('\nDatabase seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`  - ${sampleTemplates.length} templates created`);
    console.log(`  - Verification: ${sampleTemplates.filter(t => t.category === 'verification').length}`);
    console.log(`  - Billing: ${sampleTemplates.filter(t => t.category === 'billing').length}`);
    console.log(`  - Promotion: ${sampleTemplates.filter(t => t.category === 'promotion').length}`);
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

seed();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const models = require('./models');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

function initializeSampleData() {
  models.createSubscription('订单服务', '交易团队', '/api/v1/users', ['id', 'name', 'email']);
  models.createSubscription('支付服务', '支付团队', '/api/v1/users', ['id', 'balance']);
  models.createSubscription('通知服务', '消息团队', '/api/v1/users', ['id', 'name', 'email']);
  models.createSubscription('报表服务', '数据团队', '/api/v1/users', ['id', 'profile']);
  models.createSubscription('订单服务', '交易团队', '/api/v1/orders', ['id', 'amount', 'status']);
  models.createSubscription('库存服务', '仓储团队', '/api/v1/orders', ['id', 'items']);

  const baseSchema = {
    id: { type: 'string', description: '用户ID' },
    name: { type: 'string', description: '用户名' },
    email: { type: 'string', description: '用户邮箱' },
    balance: { type: 'number', description: '账户余额' },
    profile: {
      type: 'object',
      description: '用户资料',
      properties: {
        avatar: { type: 'string', description: '头像URL' },
        phone: { type: 'string', description: '手机号' }
      }
    }
  };

  const schemaAfterDeleteEmail = {
    id: { type: 'string', description: '用户ID' },
    name: { type: 'string', description: '用户名' },
    balance: { type: 'number', description: '账户余额' },
    profile: {
      type: 'object',
      description: '用户资料',
      properties: {
        avatar: { type: 'string', description: '头像URL' },
        phone: { type: 'string', description: '手机号' }
      }
    }
  };

  const schemaAfterBalanceTypeChange = {
    id: { type: 'string', description: '用户ID' },
    name: { type: 'string', description: '用户名' },
    email: { type: 'string', description: '用户邮箱' },
    balance: { type: 'string', description: '账户余额' },
    profile: {
      type: 'object',
      description: '用户资料',
      properties: {
        avatar: { type: 'string', description: '头像URL' },
        phone: { type: 'string', description: '手机号' }
      }
    }
  };

  const schemaAfterDescriptionChange = {
    id: { type: 'string', description: '用户ID' },
    name: { type: 'string', description: '用户姓名' },
    email: { type: 'string', description: '用户邮箱' },
    balance: { type: 'number', description: '账户余额' },
    profile: {
      type: 'object',
      description: '用户资料',
      properties: {
        avatar: { type: 'string', description: '头像URL' },
        phone: { type: 'string', description: '手机号' }
      }
    }
  };

  const schemaAfterPhoneDelete = {
    id: { type: 'string', description: '用户ID' },
    name: { type: 'string', description: '用户名' },
    email: { type: 'string', description: '用户邮箱' },
    balance: { type: 'number', description: '账户余额' },
    profile: {
      type: 'object',
      description: '用户资料',
      properties: {
        avatar: { type: 'string', description: '头像URL' }
      }
    }
  };

  models.createChange('/api/v1/users', baseSchema, schemaAfterDeleteEmail, 'zhangsan', '示例1：删除email字段 - 高风险');
  models.createChange('/api/v1/users', baseSchema, schemaAfterBalanceTypeChange, 'lisi', '示例2：balance类型从number改为string - 中风险');
  models.createChange('/api/v1/users', baseSchema, schemaAfterDescriptionChange, 'wangwu', '示例3：name描述从用户名改为用户姓名 - 低风险');
  models.createChange('/api/v1/users', baseSchema, schemaAfterPhoneDelete, 'zhaoliu', '示例4：删除profile.phone字段 - 高风险');

  models.createChange('/api/v1/users', baseSchema, schemaAfterDeleteEmail, 'zhangsan', '重复提交：删除email字段 - 验证去重');
}

initializeSampleData();

app.listen(PORT, () => {
  console.log(`依赖破坏提醒API服务运行在端口 ${PORT}`);
});

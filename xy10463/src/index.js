const express = require('express');
const bodyParser = require('body-parser');
require('./database');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const routes = require('./routes');
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '企业培训签到API系统',
    version: '1.0.0',
    endpoints: {
      employees: '/api/employees',
      sessions: '/api/sessions',
      registrations: '/api/registrations',
      checkins: '/api/checkins',
      exams: '/api/exams',
      retakes: '/api/retakes',
      certificates: '/api/certificates',
      statistics: '/api/statistics'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Training Checkin API running on http://localhost:${PORT}`);
});

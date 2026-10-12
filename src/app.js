require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const app = express();
app.disable('x-powered-by');
// Keep false unless the deployment has an explicitly trusted proxy network.
app.set('trust proxy', false);
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || false, credentials: false }));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.get('/health', (req, res) => res.json({ status: 'UP', service: 'omnichannel-iam-service' }));
app.use(require('./middleware/rateLimit'));
const routes = require('./routes');
app.use('/internal-api/iam/v4', routes);
// Retains the MySLT path locally; Gateway can forward /api/* unchanged.
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ isSuccess: false, errorCode: 'ROUTE_NOT_FOUND', errorMessege: 'Unknown IAM endpoint.', dataBundle: null, exceptionDetail: null, errorShow: 'Unknown IAM endpoint.' }));
app.use(require('./middleware/error.middleware'));
module.exports = app;

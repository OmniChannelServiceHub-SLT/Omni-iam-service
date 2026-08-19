// src/app.js
require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const errorHandler = require('./middleware/error.middleware');
const apiRoutes = require('./routes'); // auto-discovered from src/<tmfApiName>/routes.js

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? '*' : process.env.CORS_ORIGIN,
  credentials: process.env.CORS_ORIGIN !== '*',
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Own health check (useful for Docker/monitoring; not proxied by the Gateway).
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', service: 'omnichannel-iam-service', port: Number(process.env.PORT || 3001) });
});

// The Gateway restores the client's original path (including the
// /internal-api/iam/v1 prefix) before proxying - see proxyFactory.js's
// pathRewrite. So this service mounts its routes under that same prefix.
//
// Every endpoint below comes from its own src/<tmfApiName>/ folder - one
// per row of the "Identity and Access Management" sheet in
// Omni-Channel-API-Mapping-By-Service.xlsx - auto-discovered by
// src/routes/index.js.
app.use('/internal-api/iam/v1', apiRoutes);

app.use((req, res) => {
  res.status(404).json({
    isSuccess: false,
    errorMessege: `No IAM route matches ${req.method} ${req.originalUrl}`,
    exceptionDetail: null,
    dataBundle: null,
    errorShow: `No IAM route matches ${req.method} ${req.originalUrl}`,
    errorCode: 'E404',
  });
});

app.use(errorHandler);

module.exports = app;

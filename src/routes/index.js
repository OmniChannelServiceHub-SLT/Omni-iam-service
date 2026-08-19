// src/routes/index.js
// Auto-discovers every IAM API folder under src/API/<tmfApiName>/routes.js.
const fs = require('fs');
const path = require('path');
const express = require('express');

const API_DIR = path.join(__dirname, '..', 'API');

function findApiRouteFiles() {
  const found = [];
  if (!fs.existsSync(API_DIR)) return found;

  for (const entry of fs.readdirSync(API_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const routesFile = path.join(API_DIR, entry.name, 'routes.js');
    if (fs.existsSync(routesFile)) found.push(routesFile);
  }

  return found;
}

function buildRouter() {
  const router = express.Router();
  const routeFiles = findApiRouteFiles().sort();

  for (const file of routeFiles) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const moduleRouter = require(file);
    router.use(moduleRouter);
  }

  // eslint-disable-next-line no-console
  console.log(`[IAM] mounted ${routeFiles.length} API route(s) from src/API/<tmfApiName>/routes.js`);

  return router;
}

module.exports = buildRouter();

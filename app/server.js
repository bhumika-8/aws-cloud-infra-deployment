const express = require('express');
const os = require('os');
const path = require('path');
const packageJson = require('./package.json');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Basic request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });

  next();
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// GET /api - API catalog and documentation
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'Cloud Infrastructure Dashboard API',
    description: 'REST API providing genuine application health telemetry and runtime system metrics for cloud infrastructure validation.',
    version: packageJson.version,
    status: 'operational',
    endpoints: [
      {
        path: '/api',
        method: 'GET',
        description: 'Service description and available endpoint catalog'
      },
      {
        path: '/api/health',
        method: 'GET',
        description: 'Application health status, current timestamp, version, and server uptime'
      },
      {
        path: '/api/system-info',
        method: 'GET',
        description: 'Genuine operating system and runtime hardware metrics'
      }
    ]
  });
});

// GET /api/health - Application health check
app.get('/api/health', (req, res) => {
  try {
    const uptimeSeconds = process.uptime();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      uptime: Math.round(uptimeSeconds * 100) / 100
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error in /api/health:`, err.message);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Failed to retrieve application health status'
    });
  }
});

// GET /api/system-info - Genuine system & runtime telemetry
app.get('/api/system-info', (req, res) => {
  try {
    const cpus = os.cpus() || [];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercentage = totalMem > 0 ? Number(((usedMem / totalMem) * 100).toFixed(2)) : null;

    res.status(200).json({
      platform: os.platform(),
      type: os.type(),
      release: os.release(),
      architecture: os.arch(),
      nodeVersion: process.version,
      cpu: {
        model: cpus.length > 0 ? cpus[0].model : 'Unavailable',
        cores: cpus.length,
        speedMhz: cpus.length > 0 ? cpus[0].speed : null
      },
      memory: {
        totalBytes: totalMem,
        freeBytes: freeMem,
        usedBytes: usedMem,
        usedPercentage: usedPercentage
      },
      systemUptime: Math.floor(os.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error in /api/system-info:`, err.message);
    res.status(500).json({
      error: 'Failed to retrieve system information'
    });
  }
});

// 404 handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.originalUrl} does not exist.`
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unexpected error on ${req.method} ${req.originalUrl}:`, err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred while processing your request.'
  });
});

// Start listening
const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Cloud Infrastructure Dashboard server listening on port ${PORT} (Environment: ${NODE_ENV})`);
});

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`[${new Date().toISOString()}] Received ${signal}. Closing HTTP server gracefully...`);
  server.close(() => {
    console.log(`[${new Date().toISOString()}] HTTP server closed. Process exiting.`);
    process.exit(0);
  });

  // Force close if server does not terminate in 5s
  setTimeout(() => {
    console.error(`[${new Date().toISOString()}] Could not close connections in time, forcefully shutting down`);
    process.exit(1);
  }, 5000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

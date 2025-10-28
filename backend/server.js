const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Load environment variables from root .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Import routes
const sosRoutes = require('./routes/sosRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Authentication middleware for protected routes
const authenticateToken = (req, res, next) => {
  // This is a simple implementation - you may want to use JWT verification
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required'
    });
  }

  // For now, we'll extract user info from the token
  // In a real implementation, you'd verify the JWT token
  try {
    // Try JWT format first (with dots)
    if (token.includes('.')) {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      req.user = { id: payload.sub };
    } else {
      // Try base64-encoded JSON format (for testing)
      const payload = JSON.parse(Buffer.from(token, 'base64').toString());
      req.user = { id: payload.userId };
    }
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

// Routes
app.use('/api/sos', authenticateToken, sosRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ShareMyRide Backend'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ShareMyRide Backend Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
const express = require('express');
const cors = require('cors');
const config = require('./config/env');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/webhook', require('./routes/webhook'));
app.use('/api/admin', require('./routes/admin'));

// Basic health check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Start Server
app.listen(config.port, () => {
  console.log(`🤖 Parkside Medical Center Chatbot Server running on port ${config.port}`);
  console.log(`⚙️  Environment: ${config.nodeEnv}`);
});

const express = require('express');
const router = express.Router();
const config = require('../config/env');
const sheetsService = require('../services/sheetsService');
const sessionManager = require('../core/sessionManager');
const fs = require('fs');
const path = require('path');

// Simple secret-key authentication middleware
const auth = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === `Bearer ${config.admin.secret}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

router.use(auth);

// ─── Appointments ─────────────────────────────────────────────────────────────
router.get('/appointments', async (req, res) => {
  try {
    const data = await sheetsService.getAllAppointments();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Active Sessions (Inquiries) ──────────────────────────────────────────────
router.get('/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions();
  res.json(sessions);
});

// ─── Update Data Files ────────────────────────────────────────────────────────
const writeJson = (filename, data) => {
  fs.writeFileSync(path.join(__dirname, '..', 'data', filename), JSON.stringify(data, null, 2));
};

router.post('/doctors', (req, res) => {
  try {
    writeJson('doctors.json', req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/services', (req, res) => {
  try {
    writeJson('scanServices.json', req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/tests', (req, res) => {
  try {
    writeJson('labTests.json', req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const config = require('../config/env');
const wa = require('../adapters/whatsapp');
const flowController = require('../core/flowController');

// ─── Webhook Verification (GET) ──────────────────────────────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('[Webhook] Verified by Meta!');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// ─── Webhook Message Receiving (POST) ────────────────────────────────────────
router.post('/', async (req, res) => {
  // Meta expects a 200 OK immediately
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const messageData = change.value.messages && change.value.messages[0];
          const contactData = change.value.contacts && change.value.contacts[0];

          if (messageData) {
            const phone = messageData.from; // User's phone number
            const messageId = messageData.id;
            const messageType = messageData.type;

            // Mark message as read
            wa.markRead(messageId).catch(() => {});

            let text = '';
            let interactiveId = null;

            if (messageType === 'text') {
              text = messageData.text.body;
            } else if (messageType === 'interactive') {
              const interactive = messageData.interactive;
              if (interactive.type === 'button_reply') {
                interactiveId = interactive.button_reply.id;
                text = interactive.button_reply.title;
              } else if (interactive.type === 'list_reply') {
                interactiveId = interactive.list_reply.id;
                text = interactive.list_reply.title;
              }
            }

            // Process message via flow controller
            if (text || interactiveId) {
              await flowController.handleMessage(phone, text, messageType, interactiveId);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error);
  }
});

module.exports = router;

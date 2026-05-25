const axios = require('axios');
const config = require('../config/env');

const BASE_URL = `https://graph.facebook.com/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`;

const headers = () => ({
  Authorization: `Bearer ${config.whatsapp.accessToken}`,
  'Content-Type': 'application/json',
});

/**
 * Send a plain text message to a WhatsApp user.
 */
async function sendText(to, text) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text, preview_url: false },
  };
  return _post(payload);
}

/**
 * Send an interactive list menu (up to 10 items).
 * @param {string} to - recipient phone number
 * @param {string} headerText - header line
 * @param {string} bodyText - body message
 * @param {string} buttonLabel - button label (max 20 chars)
 * @param {Array} sections - [{ title, rows: [{ id, title, description }] }]
 */
async function sendListMenu(to, headerText, bodyText, buttonLabel, sections) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: headerText },
      body: { text: bodyText },
      footer: { text: config.clinic.name },
      action: {
        button: buttonLabel,
        sections,
      },
    },
  };
  return _post(payload);
}

/**
 * Send interactive reply buttons (up to 3 buttons).
 * @param {string} to
 * @param {string} bodyText
 * @param {Array} buttons - [{ id, title }]
 */
async function sendButtons(to, bodyText, buttons) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  };
  return _post(payload);
}

/**
 * Mark a message as read.
 */
async function markRead(messageId) {
  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  };
  return _post(payload);
}

async function _post(payload) {
  try {
    const res = await axios.post(BASE_URL, payload, { headers: headers() });
    return res.data;
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('[WhatsApp Adapter] Send error:', JSON.stringify(errData, null, 2));
    throw err;
  }
}

module.exports = { sendText, sendListMenu, sendButtons, markRead };

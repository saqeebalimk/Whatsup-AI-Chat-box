/**
 * testWebhook.js
 * A simple script to post simulated WhatsApp payload to localhost webhook.
 * Ensure the server is running on port 3000.
 */

const axios = require('axios');

async function sendMockMessage(text, phone = '1234567890') {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: phone,
                  id: `wamid.mock.${Date.now()}`,
                  type: 'text',
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  try {
    await axios.post('http://localhost:3000/api/webhook', payload);
    console.log(`[TEST] Sent: "${text}" from ${phone}`);
  } catch (err) {
    console.error(`[TEST] Error sending "${text}":`, err.message);
  }
}

async function runTests() {
  console.log('--- Starting Webhook Simulations ---');
  
  await sendMockMessage('Hi');
  await new Promise(r => setTimeout(r, 2000));
  
  await sendMockMessage('1'); // Select Book Appointment
  await new Promise(r => setTimeout(r, 2000));

  await sendMockMessage('John Doe'); // Name
  await new Promise(r => setTimeout(r, 2000));

  await sendMockMessage('35'); // Age
  await new Promise(r => setTimeout(r, 2000));
}

runTests();

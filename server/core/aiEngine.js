const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');
const faqs = require('../data/faqs.json');
const doctors = require('../data/doctors.json');
const labTests = require('../data/labTests.json');
const scanServices = require('../data/scanServices.json');

let genAI;
let model;

function getModel() {
  if (!model) {
    if (!config.gemini.apiKey) {
      console.warn('[AI Engine] No Gemini API key set – AI features will be disabled.');
      return null;
    }
    genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    model = genAI.getGenerativeModel({ model: config.gemini.model });
  }
  return model;
}

const SYSTEM_PROMPT = `
You are Parkside Medical Center's friendly virtual receptionist assistant on WhatsApp.

CLINIC INFORMATION:
${JSON.stringify(faqs.clinic, null, 2)}

DOCTORS:
${JSON.stringify(doctors.doctors.map(d => ({ name: d.name, specialty: d.specialty, days: d.days, timings: d.timings, fee: d.consultationFee })), null, 2)}

LAB TESTS:
${JSON.stringify(labTests.labTests.map(t => ({ name: t.name, price: t.price, fasting: t.fasting, turnaround: t.turnaroundTime })), null, 2)}

SCAN SERVICES:
${JSON.stringify(scanServices.scanServices.map(s => ({ name: s.name, cost: s.cost, timings: s.timings, prep: s.preparation })), null, 2)}

RULES:
1. Be professional, polite, concise, and reassuring. Use simple language.
2. You can answer in English, Hindi, or Kannada based on what the user writes in.
3. NEVER diagnose medical conditions or prescribe medications.
4. For emergencies, ALWAYS direct patients to call the emergency number immediately and do NOT make them wait.
5. If a question is outside clinic scope, say you're not sure and suggest calling reception.
6. Use WhatsApp formatting: *bold* for important info, emojis to make messages friendly.
7. Keep responses under 200 words. Be direct.
8. Do NOT make up information not in the clinic data above.

Respond to the patient's query below:
`;

/**
 * Classify the intent of an incoming message.
 * Returns one of: 'GREETING', 'APPOINTMENT', 'DOCTOR_INFO', 'LAB_TEST', 'SCAN', 'FAQ', 'EMERGENCY', 'HANDOVER', 'OTHER'
 */
async function classifyIntent(message) {
  const text = message.toLowerCase();

  // Check for emergency keywords first (no AI needed for safety)
  const emergencyWords = ['emergency', 'accident', 'chest pain', 'heart attack', 'stroke', 'unconscious', 'faint', 'bleeding heavily', 'can\'t breathe', 'breathing problem', 'severe pain'];
  if (emergencyWords.some(w => text.includes(w))) return 'EMERGENCY';

  // Check for greeting
  const greetWords = ['hi', 'hello', 'hey', 'helo', 'good morning', 'good afternoon', 'good evening', 'namaste', 'namaskar', 'hii', 'start', 'menu'];
  if (greetWords.some(w => text.includes(w)) && text.length < 30) return 'GREETING';

  // Check for human handover request
  const handoverWords = ['talk to human', 'speak to receptionist', 'talk to reception', 'human agent', 'real person', 'talk to doctor directly'];
  if (handoverWords.some(w => text.includes(w))) return 'HANDOVER';

  const model = getModel();
  if (!model) return 'OTHER';

  try {
    const prompt = `Classify this WhatsApp message from a patient at a medical clinic into ONE of these categories: APPOINTMENT, DOCTOR_INFO, LAB_TEST, SCAN, FAQ, EMERGENCY, HANDOVER, OTHER.

Message: "${message}"

Reply with ONLY the category name, nothing else.`;

    const result = await model.generateContent(prompt);
    const intent = result.response.text().trim().toUpperCase();
    const valid = ['APPOINTMENT', 'DOCTOR_INFO', 'LAB_TEST', 'SCAN', 'FAQ', 'EMERGENCY', 'HANDOVER', 'OTHER'];
    return valid.includes(intent) ? intent : 'OTHER';
  } catch (err) {
    console.error('[AI Engine] Intent classification error:', err.message);
    return 'OTHER';
  }
}

/**
 * Generate an AI-powered FAQ / natural language answer using Gemini.
 */
async function generateFaqAnswer(userMessage, sessionLanguage = 'en') {
  const model = getModel();
  if (!model) {
    return "I'm sorry, I couldn't process your query right now. Please call our reception for assistance.";
  }

  try {
    const langInstruction = sessionLanguage === 'hi'
      ? 'Respond in Hindi (Devanagari script).'
      : sessionLanguage === 'kn'
        ? 'Respond in Kannada.'
        : 'Respond in English.';

    const prompt = `${SYSTEM_PROMPT}\n${langInstruction}\n\nPatient's message: "${userMessage}"`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.error('[AI Engine] FAQ answer error:', err.message);
    return "I'm sorry, I couldn't fetch that information right now. Please call our reception for assistance.";
  }
}

/**
 * Detect language from user message (basic heuristic + Gemini fallback).
 */
function detectLanguage(text) {
  // Devanagari unicode range (Hindi)
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  // Kannada unicode range
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  return 'en';
}

module.exports = { classifyIntent, generateFaqAnswer, detectLanguage };

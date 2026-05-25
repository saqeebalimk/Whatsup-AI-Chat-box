const wa = require('../adapters/whatsapp');
const sessionManager = require('./sessionManager');
const aiEngine = require('./aiEngine');
const appointmentManager = require('./appointmentManager');
const doctors = require('../data/doctors.json');
const labTests = require('../data/labTests.json');
const scanServices = require('../data/scanServices.json');
const faqs = require('../data/faqs.json');
const config = require('../config/env');

// ─── Main Menu ────────────────────────────────────────────────────────────────

const MAIN_MENU_TEXT = `👋 *Welcome to ${config.clinic.name}!*

I'm your virtual receptionist. How can I help you today? Please choose an option:`;

const MAIN_MENU_SECTIONS = [
  {
    title: 'Appointments & Doctors',
    rows: [
      { id: 'BOOK_APPT', title: '📅 Book Appointment', description: 'Schedule a visit with a doctor' },
      { id: 'DOCTOR_TIMINGS', title: '👨‍⚕️ Doctor Timings', description: 'OPD schedule & consultation fees' },
    ],
  },
  {
    title: 'Lab & Diagnostics',
    rows: [
      { id: 'LAB_TESTS', title: '🧪 Lab Tests & Costs', description: 'Test prices, fasting info, reports' },
      { id: 'SCAN_SERVICES', title: '🔬 Scan Services', description: 'Ultrasound, Echo, Endoscopy, CBCT…' },
    ],
  },
  {
    title: 'Other Services',
    rows: [
      { id: 'DAYCARE', title: '🏥 Day Care / Admission', description: 'Admission & day care queries' },
      { id: 'PHARMACY', title: '💊 Pharmacy Queries', description: 'Medicine availability & timings' },
      { id: 'EMERGENCY', title: '🚨 Emergency Contact', description: 'Immediate emergency assistance' },
      { id: 'HUMAN', title: '📞 Talk to Reception', description: 'Connect with our staff' },
    ],
  },
];

// ─── Entry Point: handle any incoming message ─────────────────────────────────

async function handleMessage(phone, messageText, messageType = 'text', interactiveId = null) {
  const session = sessionManager.getOrCreateSession(phone);

  // Detect and save language preference
  const lang = aiEngine.detectLanguage(messageText);
  if (lang !== 'en') sessionManager.updateSession(phone, { language: lang });

  // If in human handover mode, silently log and notify staff
  if (session.isHumanHandover) {
    return; // Staff handles conversation directly
  }

  // Determine what the user said (button reply or text)
  const input = (interactiveId || messageText || '').trim();

  // Route based on current flow
  switch (session.flow) {
    case 'MAIN_MENU':
    case 'WELCOME':
      return handleMainMenuInput(phone, input, session);
    case 'BOOK_APPOINTMENT':
      return handleAppointmentFlow(phone, input, session);
    case 'DOCTOR_INFO':
      return handleDoctorInfo(phone, input, session);
    case 'LAB_INFO':
      return handleLabInfo(phone, input, session);
    case 'SCAN_INFO':
      return handleScanInfo(phone, input, session);
    default:
      return handleMainMenuInput(phone, input, session);
  }
}

// ─── Main Menu Handler ────────────────────────────────────────────────────────

async function handleMainMenuInput(phone, input, session) {
  const lower = input.toLowerCase();

  // Greeting → show menu
  if (['hi', 'hello', 'hey', 'start', 'menu', 'namaste', '0', 'main menu', 'hii'].some(g => lower.includes(g)) && lower.length < 20) {
    return sendMainMenu(phone);
  }

  // Handle interactive button/list selection
  switch (input.toUpperCase()) {
    case 'BOOK_APPT':       return startAppointmentFlow(phone);
    case 'DOCTOR_TIMINGS':  return sendDoctorList(phone);
    case 'LAB_TESTS':       return startLabInfo(phone);
    case 'SCAN_SERVICES':   return startScanInfo(phone);
    case 'DAYCARE':         return sendText(phone, `🏥 *Day Care & Admission at ${config.clinic.name}*\n\n✅ Day care procedures: minor surgeries, IV infusions, endoscopy, etc.\n✅ Short-term admission available.\n\nFor detailed queries, please contact our reception:\n📞 *${config.clinic.phone}*`);
    case 'PHARMACY':        return sendText(phone, `💊 *Pharmacy Timings:*\n\n📅 Mon–Sat: 8:00 AM – 9:00 PM\n📅 Sunday: 9:00 AM – 1:00 PM\n\nWe stock branded and generic medicines. Prescription required for Rx drugs.`);
    case 'EMERGENCY':       return sendEmergencyMessage(phone);
    case 'HUMAN':           return initiateHandover(phone);
    case 'BACK_MENU':       return sendMainMenu(phone);
  }

  // Text number shortcuts (1–8)
  const num = parseInt(input);
  if (!isNaN(num)) {
    const shortcuts = { 1: 'BOOK_APPT', 2: 'DOCTOR_TIMINGS', 3: 'LAB_TESTS', 4: 'SCAN_SERVICES', 5: 'DAYCARE', 6: 'PHARMACY', 7: 'EMERGENCY', 8: 'HUMAN' };
    if (shortcuts[num]) return handleMainMenuInput(phone, shortcuts[num], session);
  }

  // Emergency keyword anywhere in text
  const emergencyWords = ['emergency', 'accident', 'heart attack', 'stroke', 'chest pain', 'unconscious', 'severe bleeding', 'can\'t breathe'];
  if (emergencyWords.some(w => lower.includes(w))) return sendEmergencyMessage(phone);

  // AI-powered natural language fallback
  const intent = await aiEngine.classifyIntent(input);
  switch (intent) {
    case 'APPOINTMENT':    return startAppointmentFlow(phone);
    case 'DOCTOR_INFO':    return sendDoctorList(phone);
    case 'LAB_TEST':       return startLabInfo(phone);
    case 'SCAN':           return startScanInfo(phone);
    case 'EMERGENCY':      return sendEmergencyMessage(phone);
    case 'HANDOVER':       return initiateHandover(phone);
    case 'FAQ': {
      const answer = await aiEngine.generateFaqAnswer(input, session.language);
      await wa.sendText(phone, answer);
      await sendBackButton(phone);
      return;
    }
    default: {
      const answer = await aiEngine.generateFaqAnswer(input, session.language);
      await wa.sendText(phone, answer);
      await sendBackButton(phone);
    }
  }
}

// ─── Appointment Booking Flow ─────────────────────────────────────────────────

const APPT_STEPS = ['name', 'age', 'gender', 'phone_confirm', 'doctor', 'date', 'time', 'reason'];
const APPT_PROMPTS = {
  name:          '👤 Please enter your *full name*:',
  age:           '🎂 Please enter your *age*:',
  gender:        '⚧ Please select your *gender*:',
  phone_confirm: (phone) => `📱 Is *+${phone}* your WhatsApp number?\n\nReply *Yes* to confirm or enter a different mobile number:`,
  doctor:        '👨‍⚕️ Which *doctor* would you like to see? (Select from list)',
  date:          '📅 Please enter your *preferred date* (e.g., 27 May 2026 or 27/05/2026):',
  time:          (slots) => `⏰ Please choose a *preferred time slot*:\n\n${slots.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nReply with the slot number or type a time:`,
  reason:        '📝 Briefly describe your *reason for visit* / main complaint:',
};

async function startAppointmentFlow(phone) {
  sessionManager.updateSession(phone, { flow: 'BOOK_APPOINTMENT', step: 'name', data: {} });
  await wa.sendText(phone, `📅 *Appointment Booking*\n\nGreat! Let's get you booked in. This will take about a minute.\n\nType *cancel* at any time to go back to the main menu.\n\n${APPT_PROMPTS.name}`);
}

async function handleAppointmentFlow(phone, input, session) {
  const lower = input.toLowerCase().trim();

  if (lower === 'cancel') {
    sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME', data: {} });
    return sendMainMenu(phone);
  }

  const step = session.step;
  const data = session.data || {};

  switch (step) {
    case 'name': {
      if (input.length < 2) return wa.sendText(phone, '⚠️ Please enter a valid name.');
      data.name = input.trim();
      sessionManager.updateSession(phone, { step: 'age', data });
      return wa.sendText(phone, APPT_PROMPTS.age);
    }
    case 'age': {
      const age = parseInt(input);
      if (isNaN(age) || age < 1 || age > 120) return wa.sendText(phone, '⚠️ Please enter a valid age (e.g., 35).');
      data.age = age;
      sessionManager.updateSession(phone, { step: 'gender', data });
      return wa.sendButtons(phone, APPT_PROMPTS.gender, [
        { id: 'GENDER_M', title: '♂ Male' },
        { id: 'GENDER_F', title: '♀ Female' },
        { id: 'GENDER_O', title: '⚧ Other' },
      ]);
    }
    case 'gender': {
      const gMap = { GENDER_M: 'Male', GENDER_F: 'Female', GENDER_O: 'Other', male: 'Male', female: 'Female', m: 'Male', f: 'Female' };
      const gender = gMap[input.toUpperCase()] || gMap[lower];
      if (!gender) return wa.sendText(phone, '⚠️ Please reply Male, Female, or Other.');
      data.gender = gender;
      sessionManager.updateSession(phone, { step: 'phone_confirm', data });
      return wa.sendText(phone, APPT_PROMPTS.phone_confirm(phone));
    }
    case 'phone_confirm': {
      if (lower === 'yes' || lower === 'y' || lower === 'हाँ') {
        data.contactPhone = phone;
      } else {
        const digits = input.replace(/\D/g, '');
        if (digits.length < 10) return wa.sendText(phone, '⚠️ Please enter a valid 10-digit mobile number, or reply *Yes* to use your WhatsApp number.');
        data.contactPhone = digits;
      }
      sessionManager.updateSession(phone, { step: 'doctor', data });
      return sendDoctorSelectMenu(phone);
    }
    case 'doctor': {
      // Input is either a doctor ID or name text
      let doc = doctors.doctors.find(d => d.id === input.toLowerCase());
      if (!doc) doc = doctors.doctors.find(d => d.name.toLowerCase().includes(lower) || d.specialty.toLowerCase().includes(lower));
      if (!doc) {
        // Accept "1", "2" etc as shorthand
        const idx = parseInt(input) - 1;
        if (!isNaN(idx) && doctors.doctors[idx]) doc = doctors.doctors[idx];
      }
      if (!doc) return wa.sendText(phone, '⚠️ Doctor not found. Please select from the list or type the doctor\'s name.');
      data.doctor = doc.name;
      data.doctorId = doc.id;
      data.doctorSlots = doc.slots;
      sessionManager.updateSession(phone, { step: 'date', data });
      return wa.sendText(phone, `✅ *${doc.name}* selected.\n\n📅 *Available days:* ${doc.days.join(', ')}\n\n${APPT_PROMPTS.date}`);
    }
    case 'date': {
      if (input.length < 3) return wa.sendText(phone, '⚠️ Please enter a valid date (e.g., 27 May 2026 or 27/05/2026).');
      data.preferredDate = input.trim();
      sessionManager.updateSession(phone, { step: 'time', data });
      const slots = data.doctorSlots || ['10:00 AM', '11:00 AM', '12:00 PM', '2:00 PM', '5:00 PM'];
      return wa.sendText(phone, APPT_PROMPTS.time(slots));
    }
    case 'time': {
      // Accept slot number or free text
      const idx = parseInt(input) - 1;
      const slots = data.doctorSlots || [];
      data.preferredTime = (!isNaN(idx) && slots[idx]) ? slots[idx] : input.trim();
      sessionManager.updateSession(phone, { step: 'reason', data });
      return wa.sendText(phone, APPT_PROMPTS.reason);
    }
    case 'reason': {
      if (input.length < 2) return wa.sendText(phone, '⚠️ Please briefly describe your complaint or reason for visit.');
      data.reason = input.trim();
      sessionManager.updateSession(phone, { step: 'confirm', data });
      // Show summary and ask for confirmation
      const summary = `✅ *Appointment Summary*\n\n👤 Name: ${data.name}\n🎂 Age: ${data.age}\n⚧ Gender: ${data.gender}\n📱 Phone: ${data.contactPhone}\n👨‍⚕️ Doctor: ${data.doctor}\n📅 Date: ${data.preferredDate}\n⏰ Time: ${data.preferredTime}\n📝 Complaint: ${data.reason}\n\nShall I confirm this booking?`;
      return wa.sendButtons(phone, summary, [
        { id: 'APPT_CONFIRM', title: '✅ Confirm' },
        { id: 'APPT_CANCEL', title: '❌ Cancel' },
      ]);
    }
    case 'confirm': {
      if (input.toUpperCase() === 'APPT_CONFIRM' || lower === 'confirm' || lower === 'yes') {
        try {
          await appointmentManager.saveAppointment(phone, data);
          await wa.sendText(phone, `🎉 *Booking Request Received!*\n\nThank you, *${data.name}*! Your appointment request has been submitted.\n\n📋 *Appointment Details:*\n👨‍⚕️ Doctor: ${data.doctor}\n📅 Date: ${data.preferredDate}\n⏰ Time: ${data.preferredTime}\n\n⏳ Status: *Pending Confirmation*\n\nOur receptionist will confirm your appointment shortly. You may receive a call or WhatsApp message from us.\n\n📞 For urgent queries: ${config.clinic.phone}`);
          sessionManager.resetSession(phone);
          setTimeout(() => sendMainMenu(phone), 2000);
        } catch (err) {
          console.error('[Flow] Appointment save error:', err.message);
          await wa.sendText(phone, `✅ Your appointment request has been noted, *${data.name}*! Our team will contact you to confirm. For urgent help: 📞 ${config.clinic.phone}`);
          sessionManager.resetSession(phone);
        }
      } else {
        sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME', data: {} });
        await wa.sendText(phone, '❌ Appointment booking cancelled.');
        await sendMainMenu(phone);
      }
      return;
    }
    default:
      sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME', data: {} });
      return sendMainMenu(phone);
  }
}

// ─── Doctor Info Flow ─────────────────────────────────────────────────────────

async function sendDoctorList(phone) {
  sessionManager.updateSession(phone, { flow: 'DOCTOR_INFO', step: 'SELECT' });
  const text = `👨‍⚕️ *Our Doctors:*\n\n${doctors.doctors.map((d, i) =>
    `*${i + 1}. ${d.name}*\n   🩺 ${d.specialty}\n   📅 ${d.days.join(', ')}\n   🕐 ${d.timings}${d.eveningTimings ? ` | ${d.eveningTimings}` : ''}\n   💰 Fee: ₹${d.consultationFee}`
  ).join('\n\n')}\n\nReply with the doctor number for full details or type *menu* to go back.`;
  await wa.sendText(phone, text);
}

async function sendDoctorSelectMenu(phone) {
  const sections = [{ title: 'Select a Doctor', rows: doctors.doctors.map(d => ({ id: d.id, title: d.name, description: `${d.specialty} | ₹${d.consultationFee}` })) }];
  await wa.sendListMenu(phone, 'Select Doctor', '👨‍⚕️ Choose your preferred doctor:', 'View Doctors', sections);
}

async function handleDoctorInfo(phone, input, session) {
  const lower = input.toLowerCase();
  if (lower === 'menu' || lower === 'back') {
    sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME' });
    return sendMainMenu(phone);
  }
  const idx = parseInt(input) - 1;
  const doc = (!isNaN(idx) && doctors.doctors[idx])
    ? doctors.doctors[idx]
    : doctors.doctors.find(d => d.id === lower || d.name.toLowerCase().includes(lower));
  if (!doc) return wa.sendText(phone, '⚠️ Doctor not found. Reply with the number (1-' + doctors.doctors.length + ') or type *menu* to go back.');
  const text = `👨‍⚕️ *${doc.name}*\n🩺 ${doc.specialty}\n📋 ${doc.qualification}\n\n📅 *Days:* ${doc.days.join(', ')}\n🕐 *Morning:* ${doc.timings}${doc.eveningTimings ? `\n🌙 *Evening:* ${doc.eveningTimings}` : ''}\n💰 *Consultation Fee:* ₹${doc.consultationFee}\n\nℹ️ ${doc.notes}\n\nType *menu* to go back or send *1* to book an appointment.`;
  await wa.sendText(phone, text);
}

// ─── Lab Tests Flow ───────────────────────────────────────────────────────────

async function startLabInfo(phone) {
  sessionManager.updateSession(phone, { flow: 'LAB_INFO', step: 'QUERY' });
  await wa.sendText(phone, `🧪 *Lab Tests & Pathology*\n\nType the name of the test you're looking for, or ask a question like:\n• "Do I need to fast for lipid profile?"\n• "Cost of thyroid test"\n• "When does CBC report come?"\n\nPopular tests:\n${labTests.labTests.slice(0, 6).map((t, i) => `${i + 1}. ${t.name}`).join('\n')}\n\nType *menu* to go back.`);
}

async function handleLabInfo(phone, input, session) {
  const lower = input.toLowerCase();
  if (lower === 'menu' || lower === 'back' || lower === 'main menu') {
    sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME' });
    return sendMainMenu(phone);
  }
  // Try to find exact test match
  const test = labTests.labTests.find(t =>
    t.name.toLowerCase().includes(lower) ||
    (t.aliases || []).some(a => lower.includes(a.toLowerCase()))
  );
  if (test) {
    return wa.sendText(phone, `🧪 *${test.name}*\n\n💰 *Price:* ₹${test.price}\n🍎 *Fasting Required:* ${test.fasting ? `Yes – ${test.fastingHours} hours` : 'No'}\n📋 *Preparation:* ${test.preparation}\n⏱️ *Report Ready:* ${test.turnaroundTime}\n🏷️ *Category:* ${test.category}\n\nType another test name or *menu* to go back.`);
  }
  // AI fallback
  const answer = await aiEngine.generateFaqAnswer(`Lab test question: ${input}`, session.language);
  await wa.sendText(phone, answer);
  await wa.sendText(phone, '_Type another test name or *menu* to go back._');
}

// ─── Scan Services Flow ───────────────────────────────────────────────────────

async function startScanInfo(phone) {
  sessionManager.updateSession(phone, { flow: 'SCAN_INFO', step: 'QUERY' });
  const list = scanServices.scanServices.map((s, i) => `${i + 1}. ${s.name} — ₹${s.cost}`).join('\n');
  await wa.sendText(phone, `🔬 *Scan & Diagnostic Services*\n\n${list}\n\nType the scan name or number for details.\nType *menu* to go back.`);
}

async function handleScanInfo(phone, input, session) {
  const lower = input.toLowerCase();
  if (lower === 'menu' || lower === 'back') {
    sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME' });
    return sendMainMenu(phone);
  }
  const idx = parseInt(input) - 1;
  const scan = (!isNaN(idx) && scanServices.scanServices[idx])
    ? scanServices.scanServices[idx]
    : scanServices.scanServices.find(s =>
        s.name.toLowerCase().includes(lower) ||
        (s.aliases || []).some(a => lower.includes(a.toLowerCase()))
      );
  if (scan) {
    return wa.sendText(phone, `🔬 *${scan.name}*\n\n💰 *Cost:* ₹${scan.cost}\n📅 *Timings:* ${scan.timings}\n🗓️ *Days:* ${scan.days}\n📋 *Preparation:* ${scan.preparation}\n📄 *Report Time:* ${scan.reportingTime}\n📆 *Appointment Required:* ${scan.appointmentRequired ? 'Yes – please call to book' : 'No – walk-in available'}\n\nℹ️ ${scan.notes || ''}\n\nType another scan name or *menu* to go back.`);
  }
  const answer = await aiEngine.generateFaqAnswer(`Scan/diagnostic question: ${input}`, session.language);
  await wa.sendText(phone, answer);
  await wa.sendText(phone, '_Type another scan name or *menu* to go back._');
}

// ─── Emergency ────────────────────────────────────────────────────────────────

async function sendEmergencyMessage(phone) {
  await wa.sendText(phone, `🚨 *EMERGENCY — Please Call Immediately!*\n\n📞 *Emergency Line:* ${config.clinic.emergencyNumber || config.clinic.phone}\n\n⚠️ For life-threatening emergencies, please call *108* (Ambulance) or go to the nearest hospital emergency room immediately.\n\n*Do NOT wait for a chatbot response in an emergency.*\n\nOur team is available to help. Please call now.`);
  sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME' });
}

// ─── Human Handover ───────────────────────────────────────────────────────────

async function initiateHandover(phone) {
  sessionManager.setHumanHandover(phone, true);
  await wa.sendText(phone, `📞 *Connecting you to our reception team...*\n\nA staff member will respond to your message shortly.\n\n⏰ Reception hours: Mon–Sat 9 AM – 8 PM\n📞 Or call us directly: ${config.clinic.phone}\n\n_Type *menu* at any time to return to the automated assistant._`);
  // Notify staff
  try {
    const { notifyStaffHandover } = require('./appointmentManager');
    await notifyStaffHandover(phone);
  } catch (e) {
    console.warn('[Flow] Staff handover notification failed:', e.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sendMainMenu(phone) {
  sessionManager.updateSession(phone, { flow: 'MAIN_MENU', step: 'WELCOME' });
  await wa.sendListMenu(phone, `${config.clinic.name}`, MAIN_MENU_TEXT, '📋 View Options', MAIN_MENU_SECTIONS);
}

async function sendBackButton(phone) {
  await wa.sendButtons(phone, '↩️ What would you like to do next?', [
    { id: 'BACK_MENU', title: '🏠 Main Menu' },
    { id: 'HUMAN', title: '📞 Talk to Reception' },
  ]);
}

async function sendText(phone, text) {
  return wa.sendText(phone, text);
}

module.exports = { handleMessage };

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const config = require('../config/env');

let sheetsClient = null;

async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  try {
    const credPath = path.resolve(config.sheets.credentialsPath);
    if (!fs.existsSync(credPath)) {
      console.warn('[Sheets] Service account JSON not found at:', credPath);
      return null;
    }
    const auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    return sheetsClient;
  } catch (err) {
    console.error('[Sheets] Auth error:', err.message);
    return null;
  }
}

/**
 * Ensure the Appointments sheet has the correct header row.
 */
async function ensureHeaders(sheets) {
  const sheetId = config.sheets.sheetId;
  if (!sheetId) return;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Appointments!A1:J1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Appointments!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['Date', 'Time', 'Patient Name', 'Age', 'Gender', 'Phone', 'Doctor', 'Complaint', 'Status', 'Timestamp']],
        },
      });
    }
  } catch (err) {
    console.warn('[Sheets] Header check failed:', err.message);
  }
}

/**
 * Check if a phone number already has a pending appointment in the sheet.
 */
async function hasDuplicateAppointment(sheets, phone) {
  const sheetId = config.sheets.sheetId;
  if (!sheetId || !sheets) return false;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Appointments!F:I',
    });
    const rows = res.data.values || [];
    return rows.some(row => row[0] === phone && row[3] === 'Pending Confirmation');
  } catch (err) {
    console.warn('[Sheets] Duplicate check failed:', err.message);
    return false;
  }
}

/**
 * Append a new appointment row to Google Sheets.
 */
async function appendAppointment(appointmentData) {
  const sheets = await getSheetsClient();
  const sheetId = config.sheets.sheetId;
  if (!sheetId || !sheets) {
    console.warn('[Sheets] Sheets not configured – saving locally only.');
    return false;
  }
  await ensureHeaders(sheets);
  const now = new Date();
  const row = [
    appointmentData.preferredDate,
    appointmentData.preferredTime,
    appointmentData.name,
    appointmentData.age,
    appointmentData.gender,
    appointmentData.contactPhone,
    appointmentData.doctor,
    appointmentData.reason,
    'Pending Confirmation',
    now.toISOString(),
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Appointments!A:J',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
  return true;
}

/**
 * Get all appointments from the sheet.
 */
async function getAllAppointments() {
  const sheets = await getSheetsClient();
  const sheetId = config.sheets.sheetId;
  if (!sheetId || !sheets) return getLocalAppointments();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Appointments!A:J',
    });
    const rows = res.data.values || [];
    if (rows.length <= 1) return [];
    const [headers, ...data] = rows;
    return data.map(row => ({
      date: row[0] || '',
      time: row[1] || '',
      patientName: row[2] || '',
      age: row[3] || '',
      gender: row[4] || '',
      phone: row[5] || '',
      doctor: row[6] || '',
      complaint: row[7] || '',
      status: row[8] || 'Pending Confirmation',
      timestamp: row[9] || '',
    }));
  } catch (err) {
    console.error('[Sheets] GetAll error:', err.message);
    return getLocalAppointments();
  }
}

// ─── Local JSON fallback ──────────────────────────────────────────────────────

const LOCAL_FILE = path.join(__dirname, '../data/appointments.json');

function getLocalAppointments() {
  try {
    if (fs.existsSync(LOCAL_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return [];
}

function saveLocalAppointment(data) {
  const appointments = getLocalAppointments();
  const now = new Date();
  appointments.push({ ...data, status: 'Pending Confirmation', timestamp: now.toISOString() });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(appointments, null, 2));
}

module.exports = { appendAppointment, getAllAppointments, hasDuplicateAppointment, getSheetsClient, saveLocalAppointment };

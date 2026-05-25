const sheetsService = require('../services/sheetsService');
const wa = require('../adapters/whatsapp');
const config = require('../config/env');

/**
 * Handle saving the appointment and notifying staff.
 */
async function saveAppointment(patientPhone, data) {
  // Save locally first
  sheetsService.saveLocalAppointment(data);
  
  // Try Google Sheets
  try {
    const isDuplicate = await sheetsService.hasDuplicateAppointment(await sheetsService.getSheetsClient(), patientPhone);
    if (!isDuplicate) {
      await sheetsService.appendAppointment(data);
    } else {
      console.log(`[AppointmentManager] Duplicate appointment detected for ${patientPhone}, saving locally only.`);
    }
  } catch (err) {
    console.error('[AppointmentManager] Google Sheets append error:', err.message);
  }

  // Notify Staff
  await notifyStaffNewAppointment(data);
}

/**
 * Send WhatsApp alert to designated staff number.
 */
async function notifyStaffNewAppointment(data) {
  const staffNum = config.whatsapp.staffNumber;
  if (!staffNum) return;

  const msg = `🔔 *New Appointment Request*\n\n👤 Name: ${data.name}\n📱 Ph: ${data.contactPhone || 'N/A'}\n👨‍⚕️ Dr: ${data.doctor}\n📅 Date: ${data.preferredDate}\n⏰ Time: ${data.preferredTime}\n📝 Reason: ${data.reason}\n\n_Please confirm via the admin dashboard._`;
  
  try {
    await wa.sendText(staffNum, msg);
  } catch (err) {
    console.error('[AppointmentManager] Staff notification failed:', err.message);
  }
}

/**
 * Send WhatsApp alert to staff when user requests human handover.
 */
async function notifyStaffHandover(patientPhone) {
  const staffNum = config.whatsapp.staffNumber;
  if (!staffNum) return;

  const msg = `🚨 *Human Handover Requested*\n\nPatient Phone: +${patientPhone}\n\nPlease check WhatsApp Inbox and respond directly.`;
  
  try {
    await wa.sendText(staffNum, msg);
  } catch (err) {
    console.error('[AppointmentManager] Staff handover alert failed:', err.message);
  }
}

module.exports = { saveAppointment, notifyStaffHandover };

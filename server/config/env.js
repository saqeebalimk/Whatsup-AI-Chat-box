require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v19.0',
    staffNumber: process.env.STAFF_WHATSAPP_NUMBER,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-1.5-flash',
  },

  sheets: {
    sheetId: process.env.GOOGLE_SHEET_ID,
    credentialsPath: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || './config/google-service-account.json',
  },

  admin: {
    secret: process.env.ADMIN_SECRET || 'changeme',
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    staffEmail: process.env.STAFF_EMAIL,
  },

  clinic: {
    name: process.env.CLINIC_NAME || 'Parkside Medical Center',
    phone: process.env.CLINIC_PHONE,
    emergencyNumber: process.env.EMERGENCY_NUMBER,
  },
};

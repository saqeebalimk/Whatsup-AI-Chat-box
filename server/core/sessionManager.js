/**
 * In-memory session manager for WhatsApp conversations.
 * Each session is keyed by the user's phone number.
 * Sessions expire after SESSION_TTL_MINUTES of inactivity.
 */

const SESSION_TTL_MINUTES = 30;
const sessions = new Map();

function getSession(phone) {
  const session = sessions.get(phone);
  if (!session) return null;

  const now = Date.now();
  const age = (now - session.lastActivity) / 60000;
  if (age > SESSION_TTL_MINUTES) {
    sessions.delete(phone);
    return null;
  }
  return session;
}

function createSession(phone) {
  const session = {
    phone,
    flow: 'MAIN_MENU',   // Current flow name
    step: 'WELCOME',     // Current step within the flow
    data: {},             // Collected appointment/inquiry data
    lastActivity: Date.now(),
    isHumanHandover: false,
    language: 'en',       // Detected language preference
  };
  sessions.set(phone, session);
  return session;
}

function getOrCreateSession(phone) {
  return getSession(phone) || createSession(phone);
}

function updateSession(phone, updates) {
  const session = getOrCreateSession(phone);
  Object.assign(session, updates, { lastActivity: Date.now() });
  sessions.set(phone, session);
  return session;
}

function resetSession(phone) {
  sessions.delete(phone);
  return createSession(phone);
}

function setHumanHandover(phone, value = true) {
  updateSession(phone, { isHumanHandover: value, flow: value ? 'HANDOVER' : 'MAIN_MENU' });
}

function getAllSessions() {
  return Array.from(sessions.values());
}

// Cleanup expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, session] of sessions.entries()) {
    if ((now - session.lastActivity) / 60000 > SESSION_TTL_MINUTES) {
      sessions.delete(phone);
    }
  }
}, 10 * 60 * 1000);

module.exports = {
  getSession,
  createSession,
  getOrCreateSession,
  updateSession,
  resetSession,
  setHumanHandover,
  getAllSessions,
};

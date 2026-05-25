# Parkside Medical Center — WhatsApp AI Chatbot

A full-stack, AI-powered WhatsApp chatbot built for Parkside Medical Center. It handles automated appointment booking, natural language FAQ answering (via Gemini AI), lab/scan queries, and connects to a Google Sheet backoffice.

## Architecture & Features
- **Node.js (Express)** backend for the WhatsApp webhook and conversational logic.
- **In-memory finite state machine** to manage patient flows.
- **Google Gemini 1.5 Flash** for multi-lingual intent parsing and human-like FAQ responses.
- **Google Sheets Integration** to save appointments directly to a spreadsheet.
- **React (Vite) Admin Dashboard** for staff to view and export appointments.
- **JSON Data Files** (`doctors.json`, `labTests.json`, etc.) to easily update clinic info without code changes.

## 1. Prerequisites

1. **Node.js**: v18+ required.
2. **Meta Developer Account**: You need to set up a WhatsApp Business API account.
3. **Google Cloud Console**: 
   - Get a Gemini API key from Google AI Studio.
   - Enable the Google Sheets API and create a Service Account JSON file.

## 2. Setup Guide

### Install Dependencies
Run the installation script in the root directory:
```bash
npm run install:all
```

### Environment Variables
Copy the `.env.example` in `server/` to a new file called `.env`.
```bash
cp server/.env.example server/.env
```
Fill in the exact values for Meta tokens, your Gemini API key, Google Sheet ID, and Admin Secret.

### Google Sheets Configuration
1. Create a Service Account in Google Cloud Console.
2. Generate and download the JSON key.
3. Save it as `server/config/google-service-account.json`.
4. Share your Google Sheet (Editor access) with the client email found inside that JSON file.

## 3. Running Locally

You can spin up both the backend server and frontend dashboard concurrently:

```bash
# Terminal 1: Run Backend
npm run dev:server
# Server starts on http://localhost:3000

# Terminal 2: Run Dashboard
npm run dev:dashboard
# Dashboard starts on http://localhost:5173
```

To expose your local webhook to Meta during testing, use `ngrok`:
```bash
ngrok http 3000
```
Set your Meta webhook URL to e.g. `https://<ngrok-id>.ngrok.io/api/webhook`.
Set the verify token to the value of `WHATSAPP_VERIFY_TOKEN` in your `.env`.

## 4. Admin Dashboard
- Open `http://localhost:5173`
- Login using the value you set for `ADMIN_SECRET` in the `.env` file. (Default: `change_this_to_a_strong_secret_password`).

## 5. Webhook Testing Command
You can test the conversational parser locally via terminal using a mocked webhook script:
```bash
node server/scripts/testWebhook.js
```

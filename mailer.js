/**
 * Navodaya Open 2026 - Automated Email Notification Service
 * Supports standard SMTP (Gmail, SendGrid, Resend, Amazon SES, Custom SMTP)
 */

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

/**
 * Creates and configures the Nodemailer transporter using environment variables.
 * Returns null if SMTP configuration is not provided or nodemailer is not installed.
 */
function createTransporter() {
  if (!nodemailer) {
    console.warn('[Mailer Warning] "nodemailer" package is not installed. Run "npm install" in your terminal to enable automatic email dispatch.');
    return null;
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const service = process.env.SMTP_SERVICE; // e.g. 'gmail'

  // If service is specified (like 'gmail')
  if (service && user && pass) {
    return nodemailer.createTransport({
      service: service,
      auth: {
        user: user,
        pass: pass
      }
    });
  }

  // If host and auth are provided
  if (host && user && pass) {
    return nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure,
      auth: {
        user: user,
        pass: pass
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });
  }

  // If host provided without auth (local relay or dev)
  if (host) {
    return nodemailer.createTransport({
      host: host,
      port: port,
      secure: secure
    });
  }

  return null;
}

/**
 * Generates tournament-branded responsive HTML for the registration confirmation email.
 */
function generateConfirmationEmailHtml(reg) {
  const isDoubles = Boolean(reg.partnerName || (reg.category && reg.category.toLowerCase().includes('doubles')));
  const dateStr = reg.timestamp ? new Date(reg.timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : new Date().toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Navodaya Open 2026 - Registration Confirmed</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0b0f19;
      padding: 30px 10px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #131b2e;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      padding: 36px 24px 28px;
      text-align: center;
      border-bottom: 2px solid #eab308;
    }
    .badge-top {
      display: inline-block;
      background: rgba(234, 179, 8, 0.15);
      border: 1px solid #eab308;
      color: #facc15;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding: 5px 14px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 26px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 6px;
      letter-spacing: -0.5px;
    }
    .subtitle {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }
    .body-content {
      padding: 28px 24px;
    }
    .status-banner {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%);
      border: 1px solid #10b981;
      border-radius: 12px;
      padding: 16px 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .status-text {
      color: #34d399;
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 4px;
    }
    .status-sub {
      color: #cbd5e1;
      font-size: 13px;
      margin: 0;
    }
    .id-cards-grid {
      display: table;
      width: 100%;
      margin-bottom: 24px;
    }
    .id-card-cell {
      display: table-cell;
      width: 50%;
      padding: 0 6px;
    }
    .id-card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
    }
    .id-card-label {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .id-card-value {
      font-size: 20px;
      font-weight: 800;
      color: #facc15;
      letter-spacing: 0.5px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #eab308;
      margin: 20px 0 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(234, 179, 8, 0.2);
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    .info-table td {
      padding: 9px 12px;
      font-size: 13px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .info-label {
      color: #94a3b8;
      width: 38%;
      font-weight: 500;
    }
    .info-val {
      color: #f1f5f9;
      font-weight: 600;
    }
    .rules-card {
      background: rgba(30, 41, 59, 0.6);
      border-left: 3px solid #3b82f6;
      border-radius: 8px;
      padding: 14px 16px;
      margin: 20px 0;
    }
    .rules-title {
      font-size: 13px;
      font-weight: 700;
      color: #60a5fa;
      margin: 0 0 6px;
    }
    .rules-list {
      margin: 0;
      padding-left: 18px;
      color: #cbd5e1;
      font-size: 12px;
      line-height: 1.6;
    }
    .footer {
      background-color: #0f172a;
      padding: 24px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 12px;
      color: #64748b;
    }
    .footer a {
      color: #eab308;
      text-decoration: none;
    }
    @media only screen and (max-width: 480px) {
      .id-card-cell {
        display: block;
        width: 100%;
        margin-bottom: 10px;
        padding: 0;
      }
      .title {
        font-size: 22px;
      }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      
      <!-- Header -->
      <div class="header">
        <div class="badge-top">Official Entry Confirmation</div>
        <h1 class="title">NAVODAYA OPEN 2026</h1>
        <p class="subtitle">International Badminton Tournament</p>
      </div>

      <!-- Main Body -->
      <div class="body-content">
        
        <!-- Status Banner -->
        <div class="status-banner">
          <div class="status-text">&#10004; Registration Confirmed</div>
          <div class="status-sub">Your entry has been recorded in the tournament database.</div>
        </div>

        <!-- ID Cards Grid -->
        <div class="id-cards-grid">
          <div class="id-card-cell">
            <div class="id-card">
              <div class="id-card-label">Team ID</div>
              <div class="id-card-value">${reg.teamId || 'T1001'}</div>
            </div>
          </div>
          <div class="id-card-cell">
            <div class="id-card">
              <div class="id-card-label">Player ID (UID)</div>
              <div class="id-card-value">${reg.playerId || '1001'}</div>
            </div>
          </div>
        </div>

        <!-- Event Details -->
        <div class="section-title">Event Information</div>
        <table class="info-table">
          <tr>
            <td class="info-label">Category</td>
            <td class="info-val">${reg.category || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Level / Flight</td>
            <td class="info-val" style="color: #facc15;">${reg.flight || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Registered Date</td>
            <td class="info-val">${dateStr}</td>
          </tr>
        </table>

        <!-- Participant Details -->
        <div class="section-title">Main Player Details</div>
        <table class="info-table">
          <tr>
            <td class="info-label">Full Name</td>
            <td class="info-val">${reg.name || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Contact / Phone</td>
            <td class="info-val">${reg.phone || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Email Address</td>
            <td class="info-val">${reg.email || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Iqama / ID</td>
            <td class="info-val">${reg.iqama || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Gender &amp; DOB</td>
            <td class="info-val">${reg.gender || ''} &bull; ${reg.dob || ''}</td>
          </tr>
          <tr>
            <td class="info-label">Nationality</td>
            <td class="info-val">${reg.nationality || 'N/A'}</td>
          </tr>
          ${reg.club ? `
          <tr>
            <td class="info-label">Club / City</td>
            <td class="info-val">${reg.club}</td>
          </tr>
          ` : ''}
        </table>

        <!-- Partner Details (if Doubles) -->
        ${isDoubles ? `
        <div class="section-title">Partner / Co-Player Details</div>
        <table class="info-table">
          <tr>
            <td class="info-label">Partner Name</td>
            <td class="info-val">${reg.partnerName || 'N/A'}</td>
          </tr>
          ${reg.partnerPlayerId ? `
          <tr>
            <td class="info-label">Partner Player ID</td>
            <td class="info-val" style="color: #facc15;">${reg.partnerPlayerId}</td>
          </tr>
          ` : ''}
          <tr>
            <td class="info-label">Partner Contact</td>
            <td class="info-val">${reg.partnerPhone || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Partner Iqama / ID</td>
            <td class="info-val">${reg.partnerIqama || 'N/A'}</td>
          </tr>
          <tr>
            <td class="info-label">Gender &amp; DOB</td>
            <td class="info-val">${reg.partnerGender || ''} &bull; ${reg.partnerDob || ''}</td>
          </tr>
          <tr>
            <td class="info-label">Nationality</td>
            <td class="info-val">${reg.partnerNationality || 'N/A'}</td>
          </tr>
        </table>
        ` : ''}

        <!-- Tournament Guidelines -->
        <div class="rules-card">
          <div class="rules-title">&#128227; Important Tournament Guidelines</div>
          <ul class="rules-list">
            <li><strong>Check-in:</strong> Please report at the registration desk at least <strong>30 minutes</strong> prior to your scheduled match time with your official Iqama/ID.</li>
            <li><strong>Footwear:</strong> Non-marking badminton shoes are mandatory for all participants on court.</li>
            <li><strong>Match Schedules &amp; Fixtures:</strong> Draw sheets and schedule timings will be published prior to tournament commencement.</li>
            <li><strong>Tournament Discretion:</strong> Decisions of the Chief Referee and Organizing Committee are final and binding.</li>
          </ul>
        </div>

      </div>

      <!-- Footer -->
      <div class="footer">
        <p style="margin: 0 0 6px;">Thank you for registering for <strong>Navodaya Open 2026</strong>!</p>
        <p style="margin: 0 0 12px;">For queries or assistance, please contact tournament organizers at <a href="mailto:navodayaopen2026@gmail.com">navodayaopen2026@gmail.com</a></p>
        <div style="margin-top: 10px; margin-bottom: 14px; text-align: center;">
          <a href="https://wa.me/966569407699?text=Hi%2C%20I%20have%20an%20inquiry%20regarding%20Navodaya%20Open%202026%20(Team%20ID%3A%20${encodeURIComponent(reg.teamId || 'Entry')})" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 9px 18px; border-radius: 20px; box-shadow: 0 4px 12px rgba(37,211,102,0.35);">
            &#128172; Chat on WhatsApp
          </a>
        </div>
        <p style="margin: 14px 0 0; font-size: 11px; color: #64748b; letter-spacing: 0.05em; border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 12px;">Powered by Sikha</p>
      </div>

    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generates plain text version for email clients that do not support HTML.
 */
function generateConfirmationEmailText(reg) {
  const isDoubles = Boolean(reg.partnerName || (reg.category && reg.category.toLowerCase().includes('doubles')));
  return `
NAVODAYA OPEN 2026 - REGISTRATION CONFIRMATION
International Badminton Tournament

Your registration has been successfully confirmed.

--- REGISTRATION SUMMARY ---
Team ID: ${reg.teamId || 'T1001'}
Player ID (UID): ${reg.playerId || '1001'}
Category: ${reg.category || 'N/A'}
Level / Flight: ${reg.flight || 'N/A'}
Registered Date: ${reg.timestamp ? new Date(reg.timestamp).toLocaleString() : new Date().toLocaleString()}

--- MAIN PARTICIPANT ---
Name: ${reg.name || 'N/A'}
Phone: ${reg.phone || 'N/A'}
Email: ${reg.email || 'N/A'}
Iqama / ID: ${reg.iqama || 'N/A'}
Gender: ${reg.gender || 'N/A'} | DOB: ${reg.dob || 'N/A'}
Nationality: ${reg.nationality || 'N/A'}
Club / City: ${reg.club || 'N/A'}
${isDoubles ? `
--- CO-PARTICIPANT / PARTNER ---
Partner Name: ${reg.partnerName || 'N/A'}
Partner Player ID: ${reg.partnerPlayerId || 'N/A'}
Partner Contact: ${reg.partnerPhone || 'N/A'}
Partner Iqama / ID: ${reg.partnerIqama || 'N/A'}
Partner Gender: ${reg.partnerGender || 'N/A'} | DOB: ${reg.partnerDob || 'N/A'}
Partner Nationality: ${reg.partnerNationality || 'N/A'}
` : ''}
--- IMPORTANT TOURNAMENT GUIDELINES ---
1. Please report at the venue check-in desk at least 30 minutes before your scheduled fixture.
2. Official Iqama/ID must be presented upon check-in.
3. Non-marking badminton shoes are mandatory on all tournament courts.
4. The decisions of the Tournament Committee and Referees are final and binding.

For inquiries, please contact: navodayaopen2026@gmail.com
WhatsApp Support: https://wa.me/966569407699

Powered by Sikha
`.trim();
}

/**
 * Sends registration confirmation email to the participant.
 * Asynchronous and non-blocking: returns a promise that resolves safely.
 */
async function sendRegistrationConfirmationEmail(registration) {
  if (!registration || !registration.email) {
    console.warn('[Mailer] Cannot send confirmation email: Missing recipient email address.');
    return { success: false, reason: 'Missing recipient email' };
  }

  const transporter = createTransporter();
  if (!transporter) {
    console.log('[Mailer Notice] SMTP credentials not configured in .env. Registration saved without dispatching email. Set SMTP_HOST, SMTP_USER, SMTP_PASS to enable automatic emails.');
    return { success: false, reason: 'SMTP credentials not configured in .env' };
  }

  const rawFrom = process.env.EMAIL_FROM || '"Navodaya Open 2026" <noreply@navodayaopen.com>';
  const fromAddress = rawFrom.replace(/^["']|["']$/g, ''); // strip outer quotes if present
  const replyTo = process.env.REPLY_TO || process.env.ADMIN_EMAIL || undefined;
  const recipientEmail = registration.email.trim();
  const subject = `🏸 Navodaya Open 2026 - Registration Confirmed (${registration.teamId || 'Entry'} - ${registration.name})`;

  const mailOptions = {
    from: fromAddress,
    to: recipientEmail,
    subject: subject,
    text: generateConfirmationEmailText(registration),
    html: generateConfirmationEmailHtml(registration)
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  // If ADMIN_EMAIL is configured, add BCC
  if (process.env.ADMIN_EMAIL) {
    mailOptions.bcc = process.env.ADMIN_EMAIL.trim();
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer Success] Registration confirmation email sent to ${recipientEmail} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer Error] Failed to send email to ${recipientEmail}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Verifies the SMTP transporter connection.
 */
async function verifySmtpConnection() {
  const transporter = createTransporter();
  if (!transporter) {
    return {
      configured: false,
      message: 'SMTP is not configured. Please set SMTP_HOST, SMTP_USER, SMTP_PASS in .env'
    };
  }

  try {
    await transporter.verify();
    return {
      configured: true,
      verified: true,
      message: 'SMTP server connection verified successfully.'
    };
  } catch (err) {
    return {
      configured: true,
      verified: false,
      error: err.message,
      message: 'SMTP server connection failed: ' + err.message
    };
  }
}

module.exports = {
  sendRegistrationConfirmationEmail,
  verifySmtpConnection,
  generateConfirmationEmailHtml,
  generateConfirmationEmailText
};

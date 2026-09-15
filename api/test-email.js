/**
 * Serverless Handler for Vercel / Cloud Functions
 * GET / POST /api/test-email
 */

const { sendRegistrationConfirmationEmail, verifySmtpConnection } = require('../mailer');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const toEmail = req.query.to || (req.body && req.body.to);
    
    // Check connection first
    const smtpCheck = await verifySmtpConnection();
    if (!smtpCheck.configured) {
      return res.status(400).json({
        status: 'warning',
        message: 'SMTP is not configured in environment variables',
        smtpStatus: smtpCheck
      });
    }

    if (!toEmail) {
      return res.status(200).json({
        status: smtpCheck.verified ? 'success' : 'error',
        message: smtpCheck.message,
        smtpStatus: smtpCheck,
        hint: 'Pass ?to=your-email@example.com to send a test confirmation email.'
      });
    }

    // Send a sample test registration confirmation
    const samplePayload = {
      id: 9999,
      timestamp: new Date().toISOString(),
      teamId: 'T1001',
      playerId: '1001',
      name: 'Sample Participant',
      phone: '+966 50 000 0000',
      email: toEmail,
      iqama: '1234567890',
      gender: 'Male',
      dob: '1995-05-15',
      nationality: 'Indian',
      club: 'Navodaya Sports Club',
      category: 'Mens Doubles',
      flight: 'International',
      partnerName: 'Sample Partner',
      partnerPlayerId: '1002',
      partnerPhone: '+966 50 111 1111',
      partnerIqama: '2345678901',
      partnerGender: 'Male',
      partnerDob: '1996-08-20',
      partnerNationality: 'Indian'
    };

    const mailResult = await sendRegistrationConfirmationEmail(samplePayload);
    return res.status(200).json({
      status: mailResult.success ? 'success' : 'error',
      message: mailResult.success ? `Test registration email successfully sent to ${toEmail}` : 'Failed to send test email',
      details: mailResult,
      smtpStatus: smtpCheck
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
};

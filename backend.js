/**
 * Google Apps Script Backend for Navodaya Open 2026 Badminton Tournament
 * 
 * Spreadsheet Schema (17 Columns):
 *  1. Timestamp                 2. Full Name              3. Phone Number
 *  4. Email Address             5. Iqama / ID Number      6. Gender
 *  7. Date of Birth             8. Nationality            9. City / Club Name
 * 10. Event Category           11. Level / Flight        12. Partner Name
 * 13. Partner Contact          14. Partner Iqama / ID    15. Partner Gender
 * 16. Partner Date of Birth    17. Partner Nationality
 * 
 * Core Rules & Validations Enforced:
 * 1. Required Field Validation: Validates all mandatory inputs for Main Player and Partner.
 * 2. Iqama / ID Duplicate Check: Prevents identical Iqama/ID from registering twice in the same category.
 * 3. Max 3 Entries Limit: Enforces max 3 category participations per individual player (by Iqama/ID).
 * 4. Nearest Level Rule: Restricts multi-category entries to adjacent/nearest levels (within 1 flight step).
 * 
 * Deployment Instructions:
 * 1. Open Google Sheets (https://sheets.google.com).
 * 2. Create a new Spreadsheet and name it (e.g. "Navodaya Open 2026 Registrations").
 * 3. Go to "Extensions" > "Apps Script".
 * 4. Delete any existing code in the editor, and paste this entire file content.
 * 5. Save the project (click the disk icon).
 * 6. Click "Deploy" > "New deployment" (top right).
 * 7. Click the gear icon (Select type) and choose "Web app".
 * 8. Set deployment settings:
 *    - Description: "Navodaya Open 2026 Registration Backend v2"
 *    - Execute as: "Me (your-email@gmail.com)"
 *    - Who has access: "Anyone"
 * 9. Click "Deploy". Authorize permissions if prompted (Advanced > Go to Untitled project > Allow).
 * 10. Copy the "Web app URL" provided and set `SCRIPT_URL` at the top of `app.js`.
 */

function doPost(e) {
  // Setup CORS-compatible JSON output helper
  function jsonResponse(status, message, extraData = {}) {
    const response = {
      status: status,
      message: message,
      ...extraData
    };
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    // 1. Check if postData is received
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse('error', 'No post data received in request.');
    }

    // 2. Parse the JSON payload sent from the form
    const data = JSON.parse(e.postData.contents);
    
    function normalizeId(val) {
      if (!val) return '';
      return String(val).replace(/[\s\-_]/g, '').toUpperCase();
    }

    const name = data.name ? String(data.name).trim() : '';
    const phone = data.phone ? String(data.phone).trim() : '';
    const email = data.email ? String(data.email).trim() : '';
    const iqama = normalizeId(data.iqama);
    const gender = data.gender ? String(data.gender).trim() : '';
    const dob = data.dob ? String(data.dob).trim() : '';
    const nationality = data.nationality ? String(data.nationality).trim() : '';
    const club = data.club ? String(data.club).trim() : '';
    const category = data.category ? String(data.category).trim() : '';
    const flight = data.flight ? String(data.flight).trim() : '';
    const partnerName = data.partnerName ? String(data.partnerName).trim() : '';
    const partnerPhone = data.partnerPhone ? String(data.partnerPhone).trim() : '';
    const partnerIqama = normalizeId(data.partnerIqama);
    const partnerGender = data.partnerGender ? String(data.partnerGender).trim() : '';
    const partnerDob = data.partnerDob ? String(data.partnerDob).trim() : '';
    const partnerNationality = data.partnerNationality ? String(data.partnerNationality).trim() : '';

    // 3. Validation
    if (!name || !phone || !email || !iqama || !gender || !dob || !nationality || !category || !flight) {
      return jsonResponse('error', 'Validation failed. Please ensure all required fields are filled.');
    }

    if (iqama.length < 5) {
      return jsonResponse('error', 'Validation failed. Main player Iqama / ID number must be at least 5 characters.');
    }

    const isDoubles = category.toLowerCase().includes('doubles') || category.length > 0;
    if (isDoubles) {
      if (!partnerName || !partnerPhone || !partnerIqama || !partnerGender || !partnerDob || !partnerNationality) {
        return jsonResponse('error', 'Validation failed. Partner details (Name, Contact, Iqama, Gender, DOB, Nationality) are required for doubles entries.');
      }
      if (partnerIqama.length < 5) {
        return jsonResponse('error', 'Validation failed. Partner Iqama / ID number must be at least 5 characters.');
      }
      if (iqama === partnerIqama) {
        return jsonResponse('error', 'Main player and Partner cannot have the same Iqama / ID number.');
      }
    }

    // 4. Open the active spreadsheet and the sheet named "Registrations" (or create it if it doesn't exist)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Registrations");
    
    if (!sheet) {
      sheet = ss.insertSheet("Registrations");
    }

    // 5. Always ensure Row 1 has all 17 column headers styled properly
    const headers = [
      "Timestamp",
      "Full Name",
      "Phone Number",
      "Email Address",
      "Iqama / ID Number",
      "Gender",
      "Date of Birth",
      "Nationality",
      "City / Club Name",
      "Event Category",
      "Level / Flight",
      "Partner Name",
      "Partner Contact",
      "Partner Iqama / ID Number",
      "Partner Gender",
      "Partner Date of Birth",
      "Partner Nationality"
    ];

    sheet.getRange(1, 1, 1, 17).setValues([headers]);
    const headerRange = sheet.getRange(1, 1, 1, 17);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#e5e7eb");
    sheet.setFrozenRows(1);

    // 6. Iqama / ID Validation & Max Category / Level Checks
    if (sheet.getLastRow() > 1) {
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getValues();

      if (isDoubles && partnerIqama && iqama === partnerIqama) {
        return jsonResponse('error', 'Main player and Partner cannot have the same Iqama / ID number.');
      }

      const openFlightRanks = {
        "International": 0,
        "Premiere": 1,
        "Championship": 2,
        "F1": 3,
        "F2": 4,
        "F3": 5,
        "F4": 6,
        "F5": 7,
        "F6": 8
      };

      const juniorFlightRanks = {
        "Under 9": 0,
        "Under 11": 1,
        "Under 13": 2,
        "Under 15": 3,
        "Under 17": 4
      };

      function validatePlayerEntry(playerId, playerNameLabel) {
        if (!playerId) return null;
        const normId = normalizeId(playerId);

        let categoryCount = 0;
        let existingFlights = [];

        for (let i = 0; i < rows.length; i++) {
          const rowMainIqama = normalizeId(rows[i][4]);
          const rowPartnerIqama = normalizeId(rows[i][13]);
          const rowCategory = String(rows[i][9]).trim();
          const rowFlight = String(rows[i][10]).trim();

          const isMain = rowMainIqama === normId;
          const isPartner = rowPartnerIqama === normId;

          if (isMain || isPartner) {
            categoryCount++;
            existingFlights.push(rowFlight);

            // A) Check exact duplicate: An individual shall not participate more than once—either as a main participant or a co-participant—at the same level within a category.
            const targetCatLower = category.trim().toLowerCase();
            const targetFlightLower = flight.trim().toLowerCase();
            const rowCatLower = rowCategory.trim().toLowerCase();
            const rowFlightLower = rowFlight.trim().toLowerCase();

            if (rowCatLower === targetCatLower && rowFlightLower === targetFlightLower) {
              const role = isMain ? 'Main Participant' : 'Co-Participant / Partner';
              return `Registration blocked: An individual shall not participate more than once—either as a main participant or a co-participant—at the same level within a category. ${playerNameLabel} (Iqama/ID: ${normId}) is already registered for "${rowCategory}" in level "${rowFlight}" (as ${role}).`;
            }
          }
        }

        // B) Check maximum 3 event categories per player (Main or Co-Participant)
        if (categoryCount >= 3) {
          return `Registration blocked: ${playerNameLabel} (Iqama/ID: ${normId}) has already reached the maximum limit of 3 event category entries in this tournament (registered as Main Participant or Co-Participant).`;
        }

        // C) Check nearest level requirement (within 1 flight step up or down of nearest existing entry)
        const currentOpenRank = openFlightRanks[flight];
        const currentJuniorRank = juniorFlightRanks[flight];

        if (existingFlights.length > 0) {
          let minOpenDiff = Infinity;
          let minJuniorDiff = Infinity;
          let hasOpenCompare = false;
          let hasJuniorCompare = false;

          for (let j = 0; j < existingFlights.length; j++) {
            const prevFlight = existingFlights[j];

            if (currentOpenRank !== undefined && openFlightRanks[prevFlight] !== undefined) {
              hasOpenCompare = true;
              const diff = Math.abs(currentOpenRank - openFlightRanks[prevFlight]);
              if (diff < minOpenDiff) minOpenDiff = diff;
            }

            if (currentJuniorRank !== undefined && juniorFlightRanks[prevFlight] !== undefined) {
              hasJuniorCompare = true;
              const diff = Math.abs(currentJuniorRank - juniorFlightRanks[prevFlight]);
              if (diff < minJuniorDiff) minJuniorDiff = diff;
            }
          }

          if (hasOpenCompare && minOpenDiff > 1) {
            return `Level selection mismatch for ${playerNameLabel}. Your chosen level (${flight}) is not at the nearest/adjacent level of your existing entry level (${existingFlights.join(', ')}). Level selection must be at the same or adjacent level (within 1 flight step).`;
          }

          if (hasJuniorCompare && minJuniorDiff > 1) {
            return `Level selection mismatch for ${playerNameLabel}. Your chosen level (${flight}) is not at the nearest/adjacent level of your existing junior entry (${existingFlights.join(', ')}).`;
          }
        }

        return null;
      }

      // Validate Main Player
      const mainError = validatePlayerEntry(iqama, 'Main Player');
      if (mainError) {
        return jsonResponse('error', mainError);
      }

      // Validate Partner (if doubles)
      if (isDoubles && partnerIqama) {
        const partnerError = validatePlayerEntry(partnerIqama, 'Partner');
        if (partnerError) {
          return jsonResponse('error', partnerError);
        }
      }
    }

    // 7. Generate timezone-adjusted Timestamp
    const timestamp = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // 8. Append registration data as a new row
    sheet.appendRow([
      timestamp,
      name,
      phone,
      email,
      iqama,
      gender,
      dob,
      nationality,
      club,
      category,
      flight,
      partnerName,
      partnerPhone,
      partnerIqama,
      partnerGender,
      partnerDob,
      partnerNationality
    ]);

    // 9. Auto-adjust columns to fit content widths
    sheet.autoResizeColumns(1, 17);

    // 10. Send Email Confirmation
    let emailSent = false;
    try {
      if (email) {
        const subject = `Navodaya Open 2026 - Registration Confirmation (${category})`;

        let partnerHtml = '';
        if (isDoubles && partnerName) {
          partnerHtml = `
            <tr style="background-color: #f8fafc;">
              <td colspan="2" style="padding: 10px 14px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-size: 14px;">
                🎾 Partner Details
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Partner Name</td>
              <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${partnerName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Partner Contact</td>
              <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">+${partnerPhone}</td>
            </tr>
            <tr>
              <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Partner Iqama / ID</td>
              <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${partnerIqama}</td>
            </tr>
            <tr>
              <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Partner Gender & DOB</td>
              <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${partnerGender} | ${partnerDob}</td>
            </tr>
            <tr>
              <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Partner Nationality</td>
              <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${partnerNationality}</td>
            </tr>
          `;
        }

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
            <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; border-radius: 10px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #38bdf8;">NAVODAYA OPEN 2026</h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #94a3b8;">International Badminton Tournament Confirmation</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; margin-top: 16px; border: 1px solid #e2e8f0;">
              <h2 style="margin-top: 0; color: #1e293b; font-size: 16px; font-weight: 600;">Registration Confirmed! 🎉</h2>
              <p style="color: #475569; font-size: 14px; line-height: 1.5;">
                Dear <strong>${name}</strong>,<br>
                Thank you for registering for <strong>Navodaya Open 2026</strong>. Here are your tournament entry details:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <tr style="background-color: #f1f5f9;">
                  <td colspan="2" style="padding: 10px 14px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-size: 14px;">
                    📋 Event Information
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9; width: 40%;">Event Category</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0284c7; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${category}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Level / Flight</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${flight}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Registration Time</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; border-bottom: 1px solid #f1f5f9;">${timestamp}</td>
                </tr>
                
                <tr style="background-color: #f8fafc;">
                  <td colspan="2" style="padding: 10px 14px; font-weight: bold; color: #1e293b; border-bottom: 1px solid #e2e8f0; font-size: 14px;">
                    👤 Player Details
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Full Name</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Phone / WhatsApp</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">+${phone}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Iqama / ID Number</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${iqama}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Gender & DOB</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${gender} | ${dob}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">Nationality</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${nationality}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 14px; font-size: 13px; color: #64748b; border-bottom: 1px solid #f1f5f9;">City / Club Name</td>
                  <td style="padding: 8px 14px; font-size: 13px; color: #0f172a; font-weight: 500; border-bottom: 1px solid #f1f5f9;">${club}</td>
                </tr>
                
                ${partnerHtml}
              </table>
              
              <p style="color: #64748b; font-size: 12px; margin-top: 20px; line-height: 1.4; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
                This is an automated confirmation email for Navodaya Open 2026. Please retain this email for your records. If you have any questions, please contact tournament organizers.
              </p>
            </div>
          </div>
        `;

        const plainTextBody = `NAVODAYA OPEN 2026 - Registration Confirmation\n\nDear ${name},\nThank you for registering for Navodaya Open 2026.\n\nRegistration Details:\n- Event Category: ${category}\n- Level / Flight: ${flight}\n- Timestamp: ${timestamp}\n\nPlayer Details:\n- Name: ${name}\n- Phone: +${phone}\n- Iqama / ID: ${iqama}\n- Gender: ${gender}\n- DOB: ${dob}\n- Nationality: ${nationality}\n- City / Club: ${club}\n${isDoubles && partnerName ? `\nPartner Details:\n- Partner Name: ${partnerName}\n- Partner Phone: +${partnerPhone}\n- Partner Iqama: ${partnerIqama}\n- Partner Gender: ${partnerGender}\n- Partner DOB: ${partnerDob}\n- Partner Nationality: ${partnerNationality}\n` : ''}\nThank you!`;

        MailApp.sendEmail({
          to: email,
          subject: subject,
          body: plainTextBody,
          htmlBody: htmlBody
        });
        emailSent = true;
      }
    } catch (emailErr) {
      Logger.log('Failed to send confirmation email: ' + emailErr.toString());
    }

    // 11. Return success status
    return jsonResponse('success', 'Tournament entry saved successfully.', {
      timestamp: timestamp,
      insertedRow: sheet.getLastRow(),
      emailSent: emailSent
    });

  } catch (error) {
    return jsonResponse('error', 'Internal server error: ' + error.toString());
  }
}

/**
 * Handle GET requests (optional, useful for testing the endpoint in the browser)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'Navodaya Open 2026 Registration API endpoint is active. Use HTTP POST to send registrations.'
  })).setMimeType(ContentService.MimeType.JSON);
}



// ═══════════════════════════════════════════════════════════════════
//  Q-AURA 2026 — Google Apps Script Backend (Google Sheets Storage)
//  School of Quantum Science and Computing AI, Rathinam Global University
// ═══════════════════════════════════════════════════════════════════

var SHEET_NAME = "Registrations";

// ── Setup sheet headers ──────────────────────────────────────────
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    var headers = [
      "Reg ID", "Timestamp", "First Name", "Last Name", "Mobile", "Email", "College",
      "Technical Event", "Non-Technical Event", "Fee",
      "Team Name", "Leader Name", "Leader Phone", "Leader Email",
      "Teammate 2", "Teammate 3", "Teammate 4"
    ];
    var headerRow = sheet.getRange(1, 1, 1, headers.length);
    headerRow.setValues([headers]);
    headerRow.setBackground("#0e121b").setFontColor("#00f0ff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Handle POST from Registration Form ─────────────────────────────
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = setupSheet();

    var regId = data.regId || ("QAURA-2026-" + Math.floor(1000 + Math.random() * 9000));
    var timestamp = data.timestamp || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    
    var isHack = data.techEvent && data.techEvent.indexOf("Hackathon") !== -1;
    var assessedFee = data.fee || (isHack ? "₹300 (Team)" : "₹250");

    var row = [
      regId,
      timestamp,
      data.firstName || "",
      data.lastName  || "",
      data.mobile    || "",
      data.email     || "",
      data.college   || "",
      data.techEvent || "",
      data.nonTechEvent || "",
      assessedFee,
      data.teamName  || "",
      data.leaderName|| "",
      data.leaderPhone || "",
      data.leaderEmail || "",
      data.tm2       || "",
      data.tm3       || "",
      data.tm4       || ""
    ];

    sheet.appendRow(row);

    if (isHack) {
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 1, 1, row.length).setBackground("#241508");
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", regId: regId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Handle GET (Live Verification & Data Fetch) ────────────────────
function doGet(e) {
  try {
    var sheet = setupSheet();
    var data = sheet.getDataRange().getValues();
    
    // Check if a specific ID or search query was requested via QR Scan
    var queryId = (e && e.parameter && (e.parameter.id || e.parameter.regId)) ? String(e.parameter.id || e.parameter.regId).trim() : "";
    var queryFormat = (e && e.parameter && e.parameter.format) ? String(e.parameter.format).trim().toLowerCase() : "";

    if (data.length <= 1) {
      if (queryFormat === "json" || !queryId) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: "ok", registrations: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return HtmlService.createHtmlOutput(buildNotFoundHtml(queryId))
        .setTitle("Q-AURA 2026 Verification")
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    var headers = data[0];
    var rows = data.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });

    // If a specific ID is scanned
    if (queryId) {
      var normalizedQuery = queryId.toUpperCase().replace(/\s+/g, "");
      var match = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var rId = String(r["Reg ID"] || "").toUpperCase().replace(/\s+/g, "");
        var rMobile = String(r["Mobile"] || "").trim();
        if (rId === normalizedQuery || rMobile === normalizedQuery) {
          match = r;
          break;
        }
      }

      if (queryFormat === "json") {
        return ContentService
          .createTextOutput(JSON.stringify({ status: match ? "ok" : "not_found", registration: match }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (match) {
        return HtmlService.createHtmlOutput(buildVerificationHtml(match))
          .setTitle("VERIFIED: " + (match["Reg ID"] || "Q-AURA 2026"))
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      } else {
        return HtmlService.createHtmlOutput(buildNotFoundHtml(queryId))
          .setTitle("NOT FOUND: " + queryId)
          .addMetaTag('viewport', 'width=device-width, initial-scale=1');
      }
    }

    // Default: Return all records as JSON for admin/export
    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", registrations: rows }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── HTML Template: Live Verification Card (Mobile-Optimized) ────────
function buildVerificationHtml(r) {
  var isHack = r["Technical Event"] && String(r["Technical Event"]).indexOf("Hackathon") !== -1;
  var hackHtml = "";
  if (isHack) {
    var teammates = [r["Teammate 2"], r["Teammate 3"], r["Teammate 4"]].filter(function(m){ return m && String(m).trim().length > 0; }).join(", ");
    hackHtml = 
      '<div class="sec-title">🔥 HACKATHON STRIKE TEAM (10:00 AM – 4:00 PM)</div>' +
      '<div class="info-cell full"><div class="lbl">Team Name</div><div class="val highlight-orange">' + (r["Team Name"] || "—") + '</div></div>' +
      '<div class="grid">' +
        '<div class="info-cell"><div class="lbl">Team Leader</div><div class="val">' + (r["Leader Name"] || "—") + '</div></div>' +
        '<div class="info-cell"><div class="lbl">Leader Phone</div><div class="val">' + (r["Leader Phone"] || "—") + '</div></div>' +
      '</div>' +
      '<div class="info-cell full" style="margin-top:6px;"><div class="lbl">Teammates</div><div class="val">' + (teammates || "—") + '</div></div>' +
      '<div class="info-cell full" style="margin-top:6px;"><div class="lbl">Marathon Timing</div><div class="val highlight-gold">10:00 AM – 04:00 PM (6 Hours)</div></div>';
  }

  return '<!DOCTYPE html>' +
  '<html lang="en">' +
  '<head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Q-AURA 2026 Verification</title>' +
    '<style>' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07090e; color: #f0f4fc; min-height: 100vh; padding: 16px; display: flex; justify-content: center; align-items: flex-start; }' +
      '.card { max-width: 480px; width: 100%; background: #0e121b; border: 1.5px solid #00f0ff; border-radius: 14px; overflow: hidden; box-shadow: 0 0 35px rgba(0, 240, 255, 0.25); }' +
      '.header { background: #ffffff; padding: 16px; text-align: center; border-bottom: 2px solid #00f0ff; }' +
      '.dept-bar { background: #0f172a; padding: 10px; text-align: center; font-size: 11px; font-weight: 800; color: #38bdf8; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid rgba(0,240,255,0.3); }' +
      '.badge-wrap { text-align: center; padding: 18px 16px 12px; background: rgba(0, 255, 102, 0.08); border-bottom: 1px solid rgba(0, 255, 102, 0.25); }' +
      '.verified-badge { display: inline-flex; align-items: center; gap: 8px; background: #00ff66; color: #05140a; font-weight: 900; font-size: 12px; letter-spacing: 1.5px; padding: 6px 18px; border-radius: 30px; text-transform: uppercase; }' +
      '.reg-id-display { font-family: monospace; font-size: 22px; font-weight: 900; color: #00f0ff; letter-spacing: 2px; margin-top: 10px; }' +
      '.body-wrap { padding: 18px 16px; }' +
      '.sec-title { font-size: 11px; font-weight: 800; color: #00f0ff; letter-spacing: 1px; text-transform: uppercase; margin: 14px 0 8px; border-bottom: 1px solid rgba(0,240,255,0.2); padding-bottom: 4px; }' +
      '.sec-title:first-child { margin-top: 0; }' +
      '.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }' +
      '.info-cell { background: rgba(16, 22, 34, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; }' +
      '.info-cell.full { grid-column: 1 / -1; }' +
      '.lbl { font-size: 9px; text-transform: uppercase; color: #8b9bb4; font-weight: 700; letter-spacing: 0.5px; }' +
      '.val { font-size: 13px; font-weight: 700; color: #ffffff; margin-top: 2px; word-break: break-word; }' +
      '.highlight-cyan { color: #00f0ff; }' +
      '.highlight-green { color: #00ff66; }' +
      '.highlight-gold { color: #ffd700; }' +
      '.highlight-orange { color: #ff7700; }' +
      '.venue-box { background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 8px; padding: 12px; margin-top: 14px; font-size: 11.5px; line-height: 1.6; color: #e2e8f5; }' +
      '.footer { text-align: center; padding: 12px; font-size: 10px; color: #5a6880; border-top: 1px solid rgba(255,255,255,0.08); background: #07090e; }' +
    '</style>' +
  '</head>' +
  '<body>' +
    '<div class="card">' +
      '<div class="header">' +
        '<div style="font-size:15px;font-weight:900;color:#0f172a;letter-spacing:1px;">RATHINAM GLOBAL UNIVERSITY</div>' +
        '<div style="font-size:10px;color:#0284c7;font-weight:700;letter-spacing:1.5px;margin-top:2px;">NAAC GRADE A++ ACCREDITED</div>' +
      '</div>' +
      '<div class="dept-bar">School of Quantum Science &amp; Computing AI &bull; Q-AURA 2026</div>' +
      '<div class="badge-wrap">' +
        '<div class="verified-badge">✓ DATABASE VERIFIED</div>' +
        '<div class="reg-id-display">' + (r["Reg ID"] || "QAURA-2026") + '</div>' +
        '<div style="font-size:11px;color:#8b9bb4;margin-top:4px;">Verified Live from Official Event Registry</div>' +
      '</div>' +
      '<div class="body-wrap">' +
        '<div class="sec-title">👤 PARTICIPANT CREDENTIALS</div>' +
        '<div class="grid">' +
          '<div class="info-cell full"><div class="lbl">Participant Name</div><div class="val">' + (r["First Name"] || "") + ' ' + (r["Last Name"] || "") + '</div></div>' +
          '<div class="info-cell"><div class="lbl">Mobile Number</div><div class="val">' + (r["Mobile"] || "—") + '</div></div>' +
          '<div class="info-cell"><div class="lbl">Fee Status</div><div class="val highlight-gold">' + (r["Fee"] || "₹250") + '</div></div>' +
          '<div class="info-cell full"><div class="lbl">Email Address</div><div class="val">' + (r["Email"] || "—") + '</div></div>' +
          '<div class="info-cell full"><div class="lbl">Institution / College</div><div class="val">' + (r["College"] || "—") + '</div></div>' +
        '</div>' +
        '<div class="sec-title">🎯 EVENT ALLOCATION</div>' +
        '<div class="grid">' +
          '<div class="info-cell"><div class="lbl">Technical Arena</div><div class="val highlight-cyan">' + (r["Technical Event"] || "—") + '</div></div>' +
          '<div class="info-cell"><div class="lbl">Non-Technical Arena</div><div class="val highlight-green">' + (r["Non-Technical Event"] || "—") + '</div></div>' +
        '</div>' +
        hackHtml +
        '<div class="venue-box">' +
          '<strong>📍 REPORTING DIRECTIVES:</strong><br/>' +
          '&bull; <strong>Date:</strong> October 14, 2026 (Wednesday)<br/>' +
          '&bull; <strong>Reporting Time:</strong> 09:00 AM IST<br/>' +
          '&bull; <strong>Venue:</strong> Tower - C, Think Tank Theater, Rathinam Techzone Campus, Eachanari, Coimbatore – 641021' +
        '</div>' +
      '</div>' +
      '<div class="footer">' +
        '&copy; 2026 Rathinam Global University &bull; Official Registration Desk' +
      '</div>' +
    '</div>' +
  '</body>' +
  '</html>';
}

// ── HTML Template: Not Found Card ───────────────────────────────────
function buildNotFoundHtml(queryId) {
  return '<!DOCTYPE html>' +
  '<html lang="en">' +
  '<head>' +
    '<meta charset="UTF-8"/>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>' +
    '<title>Q-AURA 2026 Verification - Not Found</title>' +
    '<style>' +
      '* { box-sizing: border-box; margin: 0; padding: 0; }' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #07090e; color: #f0f4fc; min-height: 100vh; padding: 16px; display: flex; justify-content: center; align-items: center; }' +
      '.card { max-width: 440px; width: 100%; background: #0e121b; border: 1.5px solid #ff0055; border-radius: 14px; overflow: hidden; box-shadow: 0 0 35px rgba(255, 0, 85, 0.25); text-align: center; padding: 24px 20px; }' +
      '.icon { font-size: 48px; color: #ff0055; margin-bottom: 12px; }' +
      'h2 { font-size: 18px; color: #fff; margin-bottom: 8px; }' +
      'p { font-size: 13px; color: #8b9bb4; line-height: 1.6; margin-bottom: 16px; }' +
      '.badge-id { font-family: monospace; font-size: 16px; color: #ffd700; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); padding: 4px 14px; border-radius: 6px; display: inline-block; margin-bottom: 16px; }' +
      '.help-text { font-size: 12px; color: #38bdf8; background: rgba(56,189,248,0.08); padding: 10px; border-radius: 8px; border: 1px solid rgba(56,189,248,0.2); }' +
    '</style>' +
  '</head>' +
  '<body>' +
    '<div class="card">' +
      '<div class="icon">⚠️</div>' +
      '<h2>REGISTRATION NOT FOUND</h2>' +
      '<p>No active record matched the scanned credentials in the Q-AURA 2026 database:</p>' +
      '<div class="badge-id">' + (queryId || "UNKNOWN ID") + '</div>' +
      '<div class="help-text">' +
        'Please check at the registration helpdesk or contact:<br/>' +
        '<strong>K. AjithKumar (Student):</strong> 6385512473<br/>' +
        '<strong>S. S. Surya Prakash (Student):</strong> 80565 57572<br/>' +
        '<strong>R. Jeyasimhaa (Student):</strong> 99409 28677' +
      '</div>' +
    '</div>' +
  '</body>' +
  '</html>';
}

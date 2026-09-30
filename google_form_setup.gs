/**
 * ==============================================================================
 * Q-AURA 2026 — AUTOMATED GOOGLE FORM GENERATOR & WEBHOOK SYNC SCRIPT
 * School of Quantum Sciences, Computing & AI | Rathinam Global University
 * ==============================================================================
 * 
 * INSTRUCTIONS:
 * 1. Go to https://script.google.com and click "+ New project".
 * 2. Delete any existing code in Code.gs and paste this entire script.
 * 3. Select the function "createQAURA2026GoogleForm" from the dropdown.
 * 4. Click "Run" (Grant standard permissions when prompted).
 * 5. Check the Execution Log: It will output your live Google Form Edit & Published URLs!
 * ==============================================================================
 */

function createQAURA2026GoogleForm() {
  // 1. Create the Form
  const formTitle = "Q-AURA 2026 — National Level Technical Symposium Registration";
  const form = FormApp.create(formTitle);
  
  form.setDescription(
    "SCHOOL OF QUANTUM SCIENCE AND COMPUTING AI\n" +
    "Rathinam Global University, Coimbatore, Tamil Nadu\n\n" +
    "═════════════════════════════════════════════════════════════\n" +
    "⚡ REGISTRATION GUIDELINES & ENTRY FEE:\n" +
    "• Standard Registration Fee: ₹250 / Participant (1 Technical + 1 Non-Technical Event)\n" +
    "• Hackathon Strike Team Fee: ₹300 / Team (Strictly 3 Members Per Team | 5 Hours: 10:00 AM – 3:00 PM)\n" +
    "• Cash Prizes for Top 3 Hackathon Winners & Certificates for all attendees!\n" +
    "• Food & Accommodation: Will NOT be provided.\n" +
    "═════════════════════════════════════════════════════════════\n\n" +
    "📞 STUDENT COORDINATORS:\n" +
    "• K. Ajithkumar: +91 63855 12473\n" +
    "• A. Mukesh: +91 82708 66217\n" +
    "• R. Jeyasimhaa: +91 99409 28677\n" +
    "• S. S. Surya Prakash: +91 80566 57572\n" +
    "• M. Dharun: +91 88703 11010\n\n" +
    "📞 FACULTY COORDINATORS:\n" +
    "• Mr. P. Sukumar: +91 70103 03993\n" +
    "• Mr. V. Atharaiswara: +91 77083 33036\n" +
    "• Mr. M. Saravana Kumar: +91 99523 38439\n" +
    "• Mr. S. Sunil Kumar: +91 63858 65347\n" +
    "• Mr. M. Veera Surya: +91 85240 84816"
  );
  
  form.setCollectEmail(true);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);

  // ═════════════════════════════════════════════════════════════
  // SECTION 1: PARTICIPANT CREDENTIALS
  // ═════════════════════════════════════════════════════════════
  
  // First Name
  const firstNameItem = form.addTextItem();
  firstNameItem.setTitle("First Name");
  firstNameItem.setHelpText("Enter your legal first name");
  firstNameItem.setRequired(true);

  // Last Name
  const lastNameItem = form.addTextItem();
  lastNameItem.setTitle("Last Name");
  lastNameItem.setHelpText("Enter your surname or initial");
  lastNameItem.setRequired(true);

  // WhatsApp / Mobile Number
  const phoneItem = form.addTextItem();
  phoneItem.setTitle("WhatsApp Contact Number");
  phoneItem.setHelpText("10-digit mobile number for event alerts and pass verification");
  phoneItem.setRequired(true);
  const phoneValidation = FormApp.createTextValidation()
    .requireTextMatchesPattern("^[0-9]{10}$")
    .setHelpText("Please enter a valid 10-digit Indian phone number (e.g., 9876543210)")
    .build();
  phoneItem.setValidation(phoneValidation);

  // College / University Name
  const collegeItem = form.addTextItem();
  collegeItem.setTitle("College / University Name");
  collegeItem.setHelpText("Enter your full institution name");
  collegeItem.setRequired(true);

  // Department & Year
  const deptItem = form.addTextItem();
  deptItem.setTitle("Department & Year of Study");
  deptItem.setHelpText("e.g. B.Tech Artificial Intelligence & Data Science - III Year");
  deptItem.setRequired(true);

  // ═════════════════════════════════════════════════════════════
  // SECTION 2: TECHNICAL ARENA SELECTION
  // ═════════════════════════════════════════════════════════════
  const techSection = form.addPageBreakItem();
  techSection.setTitle("Track 1: Technical Arena Selection (Optional)");
  techSection.setHelpText("Select 1 technical event, or choose 'None' if participating only in a non-technical event. (At least 1 event total is required).");

  const techEventItem = form.addMultipleChoiceItem();
  techEventItem.setTitle("Select your Technical Event");
  techEventItem.setRequired(true);

  // Section 3: Hackathon Team Details (Branching)
  const hackathonSection = form.addPageBreakItem();
  hackathonSection.setTitle("⚡ Hackathon Strike Team Details (Strictly 3 Members)");
  hackathonSection.setHelpText("Entry Fee: ₹300 per Team | 5 Hours Challenge (10:00 AM – 3:00 PM)");

  // Section 4: Non-Technical Arena
  const nonTechSection = form.addPageBreakItem();
  nonTechSection.setTitle("Track 2: Non-Technical Arena Selection (Optional)");
  nonTechSection.setHelpText("Select 1 non-technical event, or choose 'None' if participating only in a technical event. (At least 1 event total is required).");

  // Configure Technical Event Choices with Page Navigation
  techEventItem.setChoices([
    techEventItem.createChoice("Cyber Forge [Hands-on Cybersecurity Workshop] (₹250)", nonTechSection),
    techEventItem.createChoice("Cloud Craft [AWS Cloud Infrastructure Workshop] (₹250)", nonTechSection),
    techEventItem.createChoice("CTF Challenge [Capture The Flag Live Hacking Arena] (₹250)", nonTechSection),
    techEventItem.createChoice("Hackathon [5 Hours Innovation Sprint - ₹300 / Team]", hackathonSection),
    techEventItem.createChoice("None [Skip Technical Arena - Participating in Non-Technical Event only]", nonTechSection)
  ]);

  // Hackathon Fields
  const teamNameItem = form.addTextItem();
  teamNameItem.setTitle("Hackathon Team Name");
  teamNameItem.setHelpText("Unique name representing your 3-member strike team");
  teamNameItem.setRequired(true);

  const teamLeadNameItem = form.addTextItem();
  teamLeadNameItem.setTitle("Team Leader Full Name");
  teamLeadNameItem.setHelpText("Primary contact person for the team");
  teamLeadNameItem.setRequired(true);

  const teamLeadPhoneItem = form.addTextItem();
  teamLeadPhoneItem.setTitle("Team Leader Phone / WhatsApp");
  teamLeadPhoneItem.setRequired(true);
  teamLeadPhoneItem.setValidation(phoneValidation);

  const teammate2Item = form.addTextItem();
  teammate2Item.setTitle("Teammate 2 Name & College / Department");
  teammate2Item.setHelpText("Full name, department and college");
  teammate2Item.setRequired(true);

  const teammate3Item = form.addTextItem();
  teammate3Item.setTitle("Teammate 3 Name & College / Department");
  teammate3Item.setHelpText("Full name, department and college");
  teammate3Item.setRequired(true);

  // Direct Hackathon Section to Non-Tech Section
  hackathonSection.setGoToPage(nonTechSection);

  // ═════════════════════════════════════════════════════════════
  // SECTION 4: NON-TECHNICAL ARENA
  // ═════════════════════════════════════════════════════════════
  const nonTechEventItem = form.addMultipleChoiceItem();
  nonTechEventItem.setTitle("Select your Non-Technical Event");
  nonTechEventItem.setRequired(true);
  nonTechEventItem.setChoiceValues([
    "Prompt Generating [AI Creative Engineering Challenge] (1:30 PM - 3:00 PM)",
    "Click N Chill [Campus Creative Photography Challenge] (1:30 PM - 3:00 PM)",
    "Quiz Competition [Fast-Paced Logic & General Tech Trivia] (2:00 PM - 3:00 PM)",
    "None [Skip Non-Technical Arena - Participating in Technical Event only]"
  ]);

  // ═════════════════════════════════════════════════════════════
  // SECTION 5: FEE CONFIRMATION & DECLARATION
  // ═════════════════════════════════════════════════════════════
  const paymentSection = form.addPageBreakItem();
  paymentSection.setTitle("Entry Fee Verification & Attendance Policy");
  paymentSection.setHelpText(
    "Standard Fee: ₹250 / Participant\n" +
    "Hackathon Fee: ₹300 / Team (3 Members)\n\n" +
    "• Food & Accommodation: Will NOT be provided.\n" +
    "• Reporting Time: 09:00 AM IST on October 14, 2026 at Tower-C, Think Tank Theater."
  );

  const utrItem = form.addTextItem();
  utrItem.setTitle("UPI Transaction ID / UTR Number");
  utrItem.setHelpText("Enter the 12-digit transaction ID or reference number of your payment (or 'CASH-AT-DESK' if pre-approved)");
  utrItem.setRequired(true);

  const agreeCheckItem = form.addCheckboxItem();
  agreeCheckItem.setTitle("Attendance & Protocol Agreement");
  agreeCheckItem.setRequired(true);
  agreeCheckItem.setChoiceValues([
    "I agree to follow all event rules and present my College ID card at the verification desk on October 14, 2026."
  ]);

  // ═════════════════════════════════════════════════════════════
  // 6. LINK SPREADSHEET AUTOMATICALLY
  // ═════════════════════════════════════════════════════════════
  const ss = SpreadsheetApp.create("Q-AURA 2026 - Registration Database (Google Form)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log("=============================================================");
  Logger.log("🎉 SUCCESS! Q-AURA 2026 GOOGLE FORM CREATED SUCCESSFULLY!");
  Logger.log("=============================================================");
  Logger.log("📋 Published (Form URL for Students): " + form.getPublishedUrl());
  Logger.log("✏️ Edit URL (Form Settings): " + form.getEditUrl());
  Logger.log("📊 Linked Responses Spreadsheet: " + ss.getUrl());
  Logger.log("=============================================================");
}

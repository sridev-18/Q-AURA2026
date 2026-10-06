# ⚡ Q-AURA 2026 — Official Registration & Verification Ecosystem
> **School of Quantum Science, Computing & AI**  
> **Rathinam Global University, Coimbatore, Tamil Nadu**  
> *October 14, 2026*

---

## 🌟 Overview
**Q-AURA 2026** is a full-stack, enterprise-grade event management and live on-desk registration system engineered for the national-level technical symposium at Rathinam Global University.

The ecosystem comprises three dedicated portals:
1. **Public Registration Portal** (`index.html`) — Student registration, event selection, UPI payment processing, and instant digital pass generator.
2. **On-Desk QR Verification Desk** (`verify.html` & `/verify`) — High-speed pass scanner, search desk, and attendance tracking for organizers.
3. **Executive Admin Dashboard** (`admin.html`) — Real-time telemetry, distribution analytics charts, filtering, and CSV export.

---

## 📁 Repository Structure

```text
├── assets/
│   ├── logo.png               # Rathinam Global University official emblem
│   └── poster.jpg             # Q-AURA 2026 event poster
├── admin.html                 # Central Admin Analytics & Control Dashboard
├── config.js                  # Frontend environment & API configuration
├── db.js                      # PostgreSQL 18 connection pool & schema migration
├── google_form_setup.gs       # Automated Google Form generator Apps Script
├── code.gs                    # Google Sheets webhook sync integration
├── index.html                 # Cyber-themed Student Registration Portal
├── package.json               # Node.js dependencies and scripts
├── server.js                  # Express.js REST API & QR verification server
├── verify.html                # On-Desk Camera QR Scanner & Manual Search
└── README.md                  # Project documentation
```

---

## 🎯 Events & Guidelines

### 🛠️ Track 1: Technical Events (Morning: 10:00 AM – 1:30 PM / 3:00 PM)
| # | Event | Category | Duration | Timing | Fee |
|---|---|---|---|---|---|
| **01** | **Cyber Forge** | Workshop | 2.0 hrs | 10:00 AM – 12:00 PM | ₹250 |
| **02** | **Cloud Craft** | Workshop | 2.0 hrs | 10:00 AM – 12:00 PM | ₹250 |
| **03** | **CTF Challenge** | Live Hacking Arena | 2.5 hrs | 10:00 AM – 1:30 PM | ₹250 |
| **04** | **Hackathon** | 5-Hour Innovation Sprint | 5.0 hrs | 10:00 AM – 3:00 PM | **₹300 / Team** |

> **⚠️ Hackathon Policy:**
> - Strictly **3 members per team** (1 Team Leader + 2 Teammates).
> - Cash prizes for Top 3 Hackathon winners + certificates for all participants.
> - **Food & Accommodation:** Will **NOT** be provided.

### 🎨 Track 2: Non-Technical Events (Afternoon: 1:30 PM – 3:00 PM)
| # | Event | Category | Duration | Timing | Fee |
|---|---|---|---|---|---|
| **05** | **Prompt Generating** | AI Creative Challenge | 1.5 hrs | 1:30 PM – 3:00 PM | Included in ₹250 pass |
| **06** | **Click N Chill** | Campus Photography | 1.5 hrs | 1:30 PM – 3:00 PM | Included in ₹250 pass |
| **07** | **Quiz Competition** | Logic & Tech Trivia | 1.0 hr | 2:00 PM – 3:00 PM | Included in ₹250 pass |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v16.0 or higher)
- [PostgreSQL](https://www.postgresql.org/) (v14 or higher)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/sridev-18/Q-AURA2026.git
cd Q-AURA2026
npm install
```

### 2. Configure Database
Set environment variables or verify connection parameters in `server.js` / `db.js`:
```env
PORT=5000
PGUSER=postgres
PGPASSWORD=your_password
PGDATABASE=qaura2026_db
PGHOST=localhost
PGPORT=5432
```

### 3. Launch Server
```bash
npm start
# or
node server.js
```

The server automatically initializes database tables and indexes on launch:
- **Registration Portal:** [http://localhost:5000](http://localhost:5000)
- **Security Gateway (Login):** [http://localhost:5000/login](http://localhost:5000/login)
- **Admin Dashboard:** [http://localhost:5000/admin.html](http://localhost:5000/admin.html)
- **Verification Desk:** [http://localhost:5000/verify.html](http://localhost:5000/verify.html)
- **Mobile QR Scanner Endpoint:** `http://<YOUR_LAN_IP>:5000/verify?id=<REG_ID>`

---

## 🔐 Portal Security & Credentials

The Admin Dashboard and On-Desk Verification Desk are guarded by role-based authentication:

| Role | Target Portal | Default Username | Default Password | Clearance |
| :--- | :--- | :--- | :--- | :--- |
| **Administrator** | `admin.html` & `verify.html` | `admin` | `admin@qaura2026` | Full Access (Roster, CSV, Status, Analytics) |
| **Desk Agent** | `verify.html` | `desk` | `verify@qaura2026` | Pass Scanner & Attendance Desk |

*Credentials can be configured via environment variables: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DESK_USERNAME`, `DESK_PASSWORD`, `AUTH_SECRET`.*

---

## 📱 Google Form & Sheets Integration

1. Open [Google Apps Script](https://script.google.com) and create a new project.
2. Paste the contents of `google_form_setup.gs` to automatically generate the full Google Form with branching logic and a connected Google Sheet.
3. For direct Sheets webhook backup from the web portal, deploy `code.gs` as a Web App (Access: Anyone) and save the URL in the portal.

---

## 👥 Student Coordinators Helpline

| Name | Role | Contact Number |
|:---|:---|:---|
| **K. Ajithkumar** | Student Coordinator | `+91 63855 12473` |
| **A. Mukesh** | Student Coordinator | `+91 82708 66217` |
| **R. Jeyasimhaa** | Student Coordinator | `+91 99409 28677` |
| **S. S. Surya Prakash** | Student Coordinator | `+91 80565 57572` |
| **M. Dharun** | Student Coordinator | `+91 88703 11010` |

---

## 🏛️ Venue Directives
- **Date:** October 14, 2026 (Wednesday)
- **Reporting Time:** 09:00 AM IST
- **Venue:** Tower - C, Think Tank Theater, Rathinam Techzone Campus, Eachanari, Coimbatore, Tamil Nadu – 641021
- **Mandatory Requirements:** Digital Entry Pass & College ID Card

# RealEstate Flow CRM — Feature & Workflow Reference

This document covers every feature currently in the app, what is real (DB-backed) versus mock/static, and exact workflow for each role. Read it fully and list your changes.

---

## 1. Authentication

### How login works
- User enters username + password at `/login`
- Server verifies password hash, issues a **JWT token valid for 7 days**
- Token is stored in the browser (localStorage) and sent as `Authorization: Bearer <token>` on every API call
- Token encodes: `userId`, `username`, `name`, `role`, `isAdmin`, `agentId`

### Role is fixed after login
- Once signed in, a user cannot switch roles or profiles
- The role shown in the top-right avatar is always the one from their JWT
- There is no role-switcher dropdown

### Demo credentials (seeded automatically on first startup)

| Username | Password | Role | Admin? |
|---|---|---|---|
| admin | Admin@123 | Owner | Yes — can create users |
| harsh | Demo@123 | Owner | No |
| rakesh | Demo@123 | CFO | No |
| sneha | Demo@123 | Manager | No |
| riya | Demo@123 | Sales | No |
| vijay | Demo@123 | Broker | No |

---

## 2. User Management (Admin Only)

### Who can create users
- Only accounts with **isAdmin = true** see the "Admin" option in settings
- Currently only the `admin` account is isAdmin

### Workflow to add a new employee
1. Admin logs in → Settings → Users tab → "Add User" button
2. Fills in: Name, Username, Password, Role
3. If role is **manager / sales / broker**, an Email field also appears (required)
4. On save:
   - A `users` record is created (username + hashed password + role)
   - An `agents` record is **automatically created** and linked via `users.agentId`
   - This agent record is the person's operational profile — all their leads, deals, and site visits are tracked under it
5. The new person can immediately log in with the credentials set by admin

### What "agent record" means
- Agents are the operational staff whose performance is tracked (leads assigned, deals closed, viewings scheduled)
- Owner and CFO roles do NOT get agent records — they are management-only accounts
- Manager, Sales, and Broker get agent records automatically

### Roles that get agent records
- Manager, Sales, Broker → agent record auto-created on user creation
- Owner, CFO → no agent record

### Current limitation
- Admin cannot edit a user's password after creation (no edit-password UI yet)
- Admin cannot deactivate/disable a user (no soft-delete yet)

---

## 3. Role-Based Access Control

Each role sees only specific pages in the sidebar navigation.

| Page | Owner | CFO | Manager | Sales | Broker |
|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leads | ✓ | — | ✓ | ✓ | ✓ |
| Properties | ✓ | — | ✓ | ✓ | ✓ |
| Deals | ✓ | — | ✓ | ✓ | — |
| Agents (Team) | ✓ | — | ✓ | — | — |
| Viewings | ✓ | — | ✓ | — | — |
| WhatsApp | ✓ | — | ✓ | — | — |
| Analytics | ✓ | ✓ | ✓ | — | — |
| Commission | ✓ | ✓ | ✓ | — | ✓ |
| Integrations | ✓ | — | — | — | — |
| Settings | ✓ | ✓ | ✓ | — | — |
| Approvals | ✓ | — | ✓ | — | — |
| Activities | ✓ | — | ✓ | ✓ | ✓ |

### Role summaries
- **Owner**: Full access. Can see everything — financial data, all staff performance, approvals, integrations
- **CFO**: Finance-only view. Dashboard KPIs + Analytics + Commission + Settings. Cannot see leads, deals, or team activity
- **Manager**: Same as Owner except no Integrations page. Manages team, approves requests, sees all data
- **Sales**: Operational — leads (own only), properties, deals, activities. No management functions
- **Broker**: External partner — leads, properties, commission. No deals page, no team view

---

## 4. Leads

### Data source
**Fully DB-backed.** All leads are stored in Neon PostgreSQL, fetched live on page load.

### Lead fields
- Name, Email, Phone
- Source (99acres, MagicBricks, Housing, Facebook, Google, WhatsApp, Referral, Walk-in, Website, Phone, Email, IVR)
- Status (controls which tab the lead appears in)
- Score (0–100, manually set, drives Hot/Warm/Cold badge)
- Budget, Property Type, Notes
- Assigned To (agent ID)
- Created At (timestamp, used for SLA calculation)

### Lead statuses & tab mapping

| Tab | Statuses shown |
|---|---|
| New Leads | new |
| Upcoming | contacted, qualified |
| Site Visits | proposal |
| Expected | negotiation |
| Re-Engage | closed_lost |
| Closed Won | closed_won |

### Priority badges (Hot / Warm / Cold)
Based on the lead's **score** field:
- **Hot** (flame icon, red) — score ≥ 75
- **Warm** (thermometer, amber) — score 40–74
- **Cold** (snowflake, blue) — score < 40

### SLA freshness badges (Fresh / Pending / OVERDUE)
Only shown on leads in **"new"** status. Based on age since `createdAt`:
- **Fresh** (green) — less than 1 hour old
- **Pending** (amber) — 1–2 hours old
- **OVERDUE** (red, bold) — more than 2 hours old without any contact

The "New Leads" tab header shows a red badge count of overdue leads.

### Role-specific lead filtering
- **Sales users** see **only their own leads** — filtered by `assignedTo === their agentId`
- **Owner / Manager / Broker** see all leads

### Auto-assignment when salesperson adds a lead
When a Sales user creates a lead, the `assignedTo` field is automatically set to their own `agentId` from the JWT. They cannot assign to someone else. The lead immediately appears in their own "New Leads" tab.

### No approval required for salesperson leads
Sales users do not see the Approvals page, and lead creation does not trigger any approval flow. Lead is live immediately.

### Scheduling activities on a lead
From the lead card/row, clicking the activity button opens a dialog to schedule:
- Activity type: Phone, Site Visit Follow, Site Visit, Negotiation Followup, Negotiation, Sale
- Project, date, time, remark, employee
- **Current status: This is a local UI dialog only — activities scheduled here are NOT saved to the DB.** They show a toast confirmation but are not persisted.

---

## 5. Properties

### Data source
**Fully DB-backed.** Properties are stored in Neon PostgreSQL.

### Property fields
- Title, Type (Residential / Commercial / Villa / Plot)
- Price, Area (sqft)
- Location, City, State
- Status (available / sold / under_construction)
- Linked agent (optional)

### Unit Inventory (per property)
A `units` table exists in the DB with:
- Unit number, BHK type (1BHK/2BHK/3BHK/4BHK/Studio/Penthouse/Commercial)
- Floor, Facing (North/South/East/West/Corner/Garden)
- Carpet area, Saleable area (sqft)
- BSP (base selling price per sqft)
- PLC charges, Parking charges
- Status (available / blocked / booked / sold)
- Linked lead (if blocked/booked)
- Booked date, Is Premium flag, Notes

**Current state of the Properties page**: The page currently shows hardcoded project cards (Prestige Lakeside, Godrej Summit, DLF Cybercity, Sobha Royal Crest) with mock milestone trackers and financial data. The DB-backed properties and units are not yet displayed on this page. The units table/API is built but not yet wired into the frontend properties page.

---

## 6. Deals (Pipeline)

### Data source
**Fully DB-backed.**

### Deal stages (in order)
1. **Prospect** — Initial interest, not yet a serious buyer
2. **Viewing** — Site visit scheduled/done
3. **Offer** — Price discussion started
4. **Under Contract** — Booking amount / agreement signed
5. **Due Diligence** — Documentation, legal checks
6. **Closed Won** — Deal done, sale complete
7. **Closed Lost** — Deal fell through

### Deal fields
- Title, Value (INR)
- Linked lead (optional)
- Linked property (optional)
- Linked agent
- Stage, Closing date, Notes

### Activity logging
- Creating a deal → logs `deal_updated: "New deal created"` to the activity feed
- Moving a deal to `closed_won` → logs `deal_closed: "Deal closed successfully"`
- Any other stage change → logs `deal_updated: "Deal moved to <stage>"`

### Who can see deals
- Owner, Manager, Sales — all deals visible (no filtering by agent yet)
- Broker — does NOT have the Deals page in their nav

---

## 7. Viewings (Site Visits)

### Data source
**Fully DB-backed.**

### What a viewing record contains
- Linked lead, Property, Agent
- Date (YYYY-MM-DD), Time (HH:MM)
- Status: Confirmed / Pending / Completed / No Show / Cancelled
- Notes

### Workflow
1. Owner or Manager opens Viewings page → clicks "Schedule Visit"
2. Selects lead (from dropdown of all leads), property, agent, date, time
3. Status starts as **Pending**
4. Can be updated to Confirmed once client confirms
5. After the visit: mark as Completed or No Show
6. All viewings appear on the **dashboard Today's Focus widget** if they are scheduled for today

### Role access
- Sales and Broker do NOT see the Viewings page in their nav
- However, site visits scheduled by a manager appear on the sales agent's viewings (they are linked by agentId)

---

## 8. Dashboard

### Data source
**Mix of real DB data and hardcoded mock data** (clearly separated below).

### KPI stats strip (real DB data)
Shown at the top of the dashboard for all roles:
- Total Leads — count of all leads in DB
- Active Deals — count of deals in active stages (prospect through due_diligence)
- Pipeline Value — sum of values of all active deals
- Closed Revenue — sum of values of closed_won deals
- Bookings This Month — count of closed_won deals since the 1st of current month
- Available Units — count of units with status = available
- Overdue Leads — count of new leads older than 2 hours
- Today's Site Visits — count of viewings scheduled for today

### Today's Focus widget (real DB data)
Shown for all roles except CFO. Shows 3 live KPI chips + detailed lists:
- **Today's Site Visits** — list of all viewings scheduled for today, with lead name, property, agent, time, status
- **Overdue Leads (SLA Breach)** — new leads >2 hours old without contact; shows age in hours, "Follow Up" button linking to lead
- **Hot Leads** — leads with score ≥ 75 in active states (new/contacted/qualified)

Widget refreshes automatically every 60 seconds.

### Recent Activity feed (real DB data)
Shows last 20 events from the `activity` table: lead created, deal updated, deal closed, property added.

### Lead sources chart (real DB data)
Pie/bar chart of how many leads came from each source (99acres, Facebook, etc.).

### Sections that are currently MOCK / HARDCODED (not from DB)
- Project cards with milestones (Prestige Lakeside, Godrej Summit, DLF Cybercity, Sobha Royal Crest)
- Construction timeline progress bars
- Cash flow table (invested vs collected vs outstanding per project)
- Overdue collection tracking (buyer payment delays)
- Monthly cash flow bar chart
- Lost reasons breakdown (why deals were lost)
- Source CPL (cost per lead from ad platforms)
- Employee performance table on dashboard (separate from the DB-backed agent stats)
- Location ROI table

### CFO Dashboard
CFO only sees dashboard + analytics + commission + settings pages. On the dashboard, CFO does not see the Today's Focus widget.

---

## 9. Activities Page

### What it is
A sales-pipeline activity tracker — shows scheduled touchpoints with leads: phone calls, site visit follow-ups, negotiation meetings, etc.

### Data source
**MOCK DATA only.** The Activities page generates sample activities from a hardcoded list. Activities scheduled here are not saved to the DB.

The activity types tracked are:
- Fresh Lead, Phone, Site Visit Follow, Site Visit, Negotiation Followup, Negotiation, Sale, Sale Done

### Time filter tabs
- Overall activities / Today / Tomorrow / Pending / Future / Completed / Assigned by me

### Role access
- Owner, Manager, Sales, Broker all see the Activities page
- CFO does not

---

## 10. Approvals

### What it is
A workflow page where managers/owners review and approve requests from salespeople (lead conversions, unit blocking, payment collection approvals, etc.)

### Data source
**MOCK DATA only.** Currently shows 7 hardcoded sample approval items with fake names (Riya Sharma, Arjun Mehta as submitters). None of these are triggered by real actions in the app.

### Role access
- Owner and Manager can see Approvals
- Sales, Broker, CFO cannot (not in their nav)

### What's NOT implemented yet
- Real approval requests triggered by salesperson actions
- Approve / Reject flow that updates DB state
- Notification to salesperson when their request is approved/rejected

---

## 11. Agents (Team Management)

### Data source
**Fully DB-backed.**

### What you see
- List of all agents (operational staff with agent records)
- Per agent: name, email, role, active lead count, deals closed, total revenue
- Can add/edit/delete agent records

### Difference from User Management
- **User Management** (admin panel) creates login accounts
- **Agent Management** (this page) views operational profiles
- When you create a user with role manager/sales/broker, both records are automatically linked
- Adding an agent manually here (without a user account) creates an operational profile but that person cannot log in

### Role access
- Owner and Manager only

---

## 12. Commission Page

### Data source
**Not yet implemented.** The Commission page exists in the navigation and is accessible by Owner, Manager, CFO, and Broker, but the page content is either empty or mock.

---

## 13. Analytics

### Data source
**Part of the Dashboard** with some real DB charts (lead sources, pipeline) and some mock data (location ROI, source CPL). A separate Analytics page route exists but the content is integrated into the dashboard layout.

---

## 14. WhatsApp & Integrations

These pages are in the navigation for Owner (and WhatsApp for Manager) but are **not yet implemented**. They are placeholder routes.

---

## 15. Settings

Visible to Owner, Manager, and CFO. Currently used primarily to access User Management (admin-only section within settings).

---

## 16. Activity Feed (DB `activity` table)

This is a backend audit log, different from the Activities page. Events auto-logged:
- Lead created
- Property added
- Deal updated (stage change)
- Deal closed (closed_won)

Visible in the Recent Activity section of the dashboard.

---

## Summary: What is real vs mock

### Real (DB-backed, fully functional)
- Login / JWT auth
- User creation (admin panel)
- Agent profiles (auto-created on user creation)
- Leads — create, read, update, delete; SLA badges; priority badges; sales self-assignment
- Properties — create, read, update, delete
- Deals — create, read, update, delete; stage pipeline; activity logging
- Viewings — create, read, update, delete; today's visits on dashboard
- Dashboard KPI stats strip (all 8 numbers)
- Dashboard Today's Focus widget (visits, overdue leads, hot leads)
- Dashboard recent activity feed
- Dashboard lead sources chart

### Mock / Static (hardcoded, not saved to DB)
- Dashboard project cards (Prestige Lakeside etc.)
- Dashboard construction milestones
- Dashboard cash flow tables
- Dashboard employee performance table
- Dashboard overdue collections
- Dashboard monthly cash flow chart
- Dashboard lost reasons chart
- Dashboard source CPL table
- Dashboard location ROI
- Approvals page (all 7 items)
- Activities page (all scheduled activities)
- Commission page

### Built in DB but not yet wired to frontend
- Units inventory (table and API exist; Properties page doesn't show it yet)

---

## Current Known Issues

1. **Activities scheduling is not persisted** — clicking "Schedule Activity" on a lead shows a toast but doesn't save to DB
2. **Approvals are dummy data** — no real approval triggers exist
3. **Properties page shows mock project cards** — not the actual properties from DB
4. **Units page not built** — units table and API exist but no frontend UI yet
5. **Commission page not built**
6. **WhatsApp / Integrations pages not built**
7. **No password reset or user deactivation** in admin panel
8. **Deal assignment not filtered by role** — sales users can see all deals, not just their own

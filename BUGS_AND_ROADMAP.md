# EstateFlow CRM — Product Roadmap & Business Audit

> Written from first principles: what does a real estate sales team actually need to close deals, and what in this app is working against that?

---

## The Core Problem

This CRM has a strong technical foundation — auth, leads, deals, viewings, and properties are all DB-backed — but the **sales workflow is broken end to end**. An agent logs in today, sees a list of leads, schedules a follow-up activity, and absolutely nothing is saved. The next morning, they have no record of what they promised. That lead goes cold. In a business where a single conversion is worth ₹5–15 lakh in commission, one missed follow-up is not a minor UX bug — it is a revenue leak.

Everything in this roadmap is evaluated through one lens: **does this help close more deals, or does it help the owner make better decisions?** If it doesn't, it's deprioritised or cut.

---

## The 5 Things Costing You Deals Right Now

These are not bugs in the traditional sense. They are fundamental workflow gaps that make agents either not use the CRM, or use it and lose track of their pipeline.

### 1. Follow-ups are not tracked at all
When an agent schedules a follow-up call or a site visit re-confirmation, that action exists only in the schedule dialog and disappears on close. The `scheduled_activities` table exists in the DB and is never written to. The agent has no "what do I do today" list built from their own actions.
- **Business cost:** Leads go cold. 60–70% of conversions in Indian real estate require 5+ touchpoints. Without a follow-up log, agents lose track after touchpoint 2.
- **Fix:** Wire the schedule-activity dialog to `POST /api/activities`. Show a "My Tasks Today" list on the employee dashboard sorted by next-follow-up date.

### 2. There is no lead history / call log
When a client calls back after 2 weeks, the agent has no record of: what they discussed, what was promised, what property was pitched, what objection was raised. The lead detail page shows fields but no timeline.
- **Business cost:** Every call starts from scratch. Clients feel unrecognised. Senior agents who leave take their institutional knowledge with them.
- **Fix:** Add a chronological activity timeline on every lead detail page — status changes, scheduled activities, notes — all timestamped with who did it.

### 3. Approvals exist on screen but nowhere in the business
The Approvals page shows 7 sample items that are hardcoded. No real action in the app — blocking a unit, giving a special discount, converting a lead — ever triggers an approval. Managers believe they have oversight. They don't.
- **Business cost:** Unauthorised discounts get given. Units get promised to multiple clients. Disputes happen.
- **Fix:** Define 3 trigger events for approvals: (a) unit blocking by agent, (b) price below floor rate, (c) special payment plan request. Wire these to create real approval records that the manager sees and can approve or reject.

### 4. The Properties page is fake
The main page content — project cards, milestones, construction timelines — is all hardcoded mock data. The actual properties in the DB are shown in a small strip at the bottom that most users never reach.
- **Business cost:** Agents cannot see real inventory on this page. They cannot see which units are available in a project. The page actively misleads.
- **Fix:** Rebuild the Properties page around real DB data. Each property card should expand to show its units by status (available / blocked / booked / sold), price range, and configuration availability.

### 5. Commission is invisible to brokers
The Commission page — which is what external brokers care about most — is completely blank. Brokers see a sidebar entry and nothing behind it. The current broker commission estimate in the dashboard is a hardcoded ₹1.9L regardless of actual deal value.
- **Business cost:** Brokers don't trust the system, don't log their leads here, use their own spreadsheets. The entire broker channel is effectively unmanaged.
- **Fix:** Build a basic commission ledger. Per deal: agent/broker, deal value, commission rate (%), commission earned, status (pending / paid). Brokers see only their own rows. Owners see all.

---

## What's Broken by Role

### Owner / Promoter
| What they need | Current state |
|---|---|
| Real cash flow: invested vs collected vs outstanding per project | All hardcoded. Resets on refresh. |
| Which projects are selling well vs stalling | Properties page shows fake data |
| Approve discounts and unit releases before they happen | Approvals page is fake |
| Trust that the numbers on the dashboard are real | Cash flow, project milestones: all mock |

**Highest priority fix for this role:** Cash flow tab and Properties page need real data.

### CFO
| What they need | Current state |
|---|---|
| Actual collected revenue vs expected, per project | Hardcoded |
| Commission liability: what do we owe agents and brokers? | Commission page is blank |
| Monthly P&L trend | Monthly cash flow bar chart is mock |
| Data export for accounting | Export buttons show toasts, download nothing |

**Highest priority fix for this role:** Commission page (represents real liability) and working data exports.

### Manager
| What they need | Current state |
|---|---|
| See which agent hasn't followed up in 48+ hours | No follow-up tracking |
| Approve unit blocks and discounts | Approvals page is fake |
| See all viewings scheduled by their team | Viewings not filtered by role |
| Reassign leads from a departing agent to another | No bulk reassignment tool |

**Highest priority fix for this role:** Real approvals workflow and agent-level follow-up compliance tracking.

### Sales Agent
| What they need | Current state |
|---|---|
| Clear "what do I do today" task list | Dashboard has a follow-up section but no scheduled tasks feed |
| Log that I called a lead and what happened | Activity scheduling doesn't save |
| Know which units are available when a client asks about a project | Unit availability buried, not searchable by budget |
| See only their own leads and deals | Deals are not filtered by agent — they see everyone's |

**Highest priority fix for this role:** Activity persistence and a daily task view.

### Broker (External Channel Partner)
| What they need | Current state |
|---|---|
| See what commission they'll earn on each deal | Blank commission page + hardcoded estimate |
| Add a new lead quickly | Quick Add button works — this is good ✅ |
| See which properties they can pitch | Properties page shows fake data |
| Track which of their referrals converted | Broker leads filtered by source (referral/phone) — works but limited |

**Highest priority fix for this role:** Commission ledger and real Properties page.

---

## Build Priority: What to Do First

These are ordered by revenue impact, not technical complexity.

### Phase 1 — Make the core sales loop work (Ship in 2 weeks)

**1. Persist activity scheduling**
Every lead has a "Schedule Activity" button. Wire it to `POST /api/activities`. Show the list of scheduled activities on the Activities page. Add a "My Tasks Today" widget to the employee dashboard ordered by due date.
- Tables exist: `scheduled_activities` already in DB.
- Effort: 2–3 days.
- Impact: Agents actually use the CRM daily.

**2. Lead activity timeline**
On the lead detail page, below the info fields, add a reverse-chronological list of: status changes (with old → new), scheduled activities, and notes. All timestamped with who made the change.
- Effort: 1–2 days (reads from activity + scheduled_activities tables).
- Impact: Every call is informed. Manager can audit what happened to any lead.

**3. Real Properties page with unit inventory**
Replace the 4 hardcoded project cards with real properties from the DB. Each property card shows: name, city, type, price range. Clicking "View Units" expands a list of units grouped by status and BHK type.
- Tables exist: `properties` and `units` are fully built.
- Effort: 2–3 days.
- Impact: Agents can check unit availability without calling the admin.

**4. Commission page (basic)**
Build the Commission page with a table: Deal | Agent/Broker | Deal Value | Commission Rate | Earned | Status. Pre-fill commission rate to a default (e.g., 2%) that the owner can override per deal. Agents and brokers see only their rows.
- Effort: 2 days (new DB table: `commissions`).
- Impact: Broker channel becomes manageable. CFO can see total liability.

### Phase 2 — Give management real oversight (3–4 weeks)

**5. Real Approvals workflow**
Define 3 approval triggers:
- Agent blocks a unit → creates an approval request for manager
- Agent applies a discount below the floor price → approval required
- Special payment plan requested → approval required

Manager sees a live queue of pending requests with one-click approve/reject. The original action only executes after approval.
- Effort: 3–4 days (new `approvals` table, approval gates in unit-block and deal-create flows).

**6. Cash Flow tab — let the owner/CFO enter data manually**
The cash flow data cannot be auto-computed without an accounting integration. Instead, make the existing editable interface actually persist. When the CFO edits a project's invested/collected/outstanding, save it to a `project_financials` table. On next load, the real numbers appear.
- Effort: 2 days (new table, one API endpoint).
- Impact: CFO's edits survive page refresh. The financial view becomes trustworthy.

**7. Ad Spend entry for Source CPL**
Add a simple form: Owner enters monthly ad spend per channel (99acres, Facebook, Google, etc.). CRM divides this by actual leads generated from that channel to compute real CPL. No external API needed.
- Effort: 1 day (store ad_spend per source per month in a table).
- Impact: Owner knows exactly which marketing channel is profitable.

**8. Filters and scoping by role**
- Sales agents should see only their own deals (not all 300 in the system).
- Viewings page should show agents only their assigned visits.
- Both require a `?agentId=me` filter in the API based on the requester's JWT.
- Effort: 1 day.

### Phase 3 — Intelligence and automation (1–2 months)

**9. Smart Follow-up Queue**
Every morning, each agent's dashboard shows a prioritised follow-up queue:
- Leads sorted by: (days since last contact) × (lead score / 100)
- Labels: "Not contacted in 3 days", "Visited site — follow up now", "Hot lead going cold"
- One-click to log a call, reschedule, or mark as contacted

This is the feature that will determine whether agents use the CRM or go back to WhatsApp and notebooks.

**10. SLA Breach Escalation to Manager**
When a new lead is not contacted within 2 hours, the system currently shows a red badge on the dashboard. Nobody is notified. Add: if the breach reaches 4 hours, create a notification in the manager's notification center. If it reaches 8 hours, send a WhatsApp alert to the manager (once WhatsApp is integrated).

**11. Demand Intelligence Dashboard**
Aggregate from all lead enquiries:
- Most requested BHK type per project (2BHK, 3BHK, 4BHK)
- Most common budget range of active leads
- Most common objection reason (from lost reason data already being captured)

This tells the owner: "70% of your leads want 2BHKs but 60% of your inventory is 3BHK — you have a mismatch." That is a ₹5-crore insight, not a dashboard widget.

**12. Re-engagement Campaigns**
Leads in the "Re-Engage" tab (status: closed_lost) currently sit there forever. Add a campaign tool: owner selects a set of lost leads, types a WhatsApp message template, hits send. Track who responded and move them back into the pipeline.

**13. Site Visit → Booking Conversion Funnel**
The most important metric in Indian real estate: of all site visits completed, what % convert to a booking within 30 days? Show this per agent, per property, and overall. Below 15% is a problem; above 30% is excellent.

---

## What to Cut or Simplify

These exist in the app today but add complexity without value. Remove them to reduce confusion.

| Thing to cut | Why |
|---|---|
| D1/D2/D3/D4/D5 team filter buttons on employee dashboard | Completely non-functional. No concept of "teams" exists in the data model. Remove until a real team/pod structure is defined. |
| WhatsApp page (blank) | Shows a broken promise. Replace with a "Coming Soon — WhatsApp Integration" banner on the dashboard OR remove from nav entirely until the API is integrated. |
| Integrations page (blank) | Same. Nothing is integrated. Remove from nav. |
| "Analytics" nav item duplicating the dashboard | The Analytics nav item shows the exact same content as the Owner dashboard's Analysis tab. Confusing for users who open both. Remove the duplicate nav item and deepen the Analysis tab instead. |
| Hardcoded project milestones (Foundation, Slab Work, etc.) | These are construction management features that require a completely different data model (milestone definitions, expected dates, actuals). Remove from the Properties page entirely until that model exists. |
| Broker commission = bookingsThisMonth × ₹1.9L hardcoded multiplier | Actively misleading. Remove the number until a real commission table exists. Show "—" instead. |

---

## Technical Debt to Address Before Scaling

These are not visible features but will cause production incidents at volume.

| Issue | Risk |
|---|---|
| No pagination on Leads page | Page load becomes slow at 500+ leads. Fetch-all-in-memory pattern will fail. |
| Delete buttons allow double-fire | No loading/disabled state during API call. Fast clicking fires 2 delete requests. |
| Dashboard queries silently swallow errors | If `/dashboard/inventory` returns a 500, the user sees a blank section with no retry option. |
| No rate limiting on auth endpoints | The `/api/auth/login` endpoint has no rate limit. Vulnerable to brute force. |
| JWT stored in localStorage | Industry standard is httpOnly cookies. localStorage is accessible to any JS on the page (XSS risk). Low severity for internal tools but worth noting for a customer-facing portal. |
| Viewing unit status changes have no conflict detection | Two agents can simultaneously block the same unit. No optimistic lock or "already blocked" guard. |
| No admin ability to deactivate users | If a salesperson leaves the company, their login stays active forever. |

---

## Quick Wins (Under 1 day each, high visibility)

These are small fixes that make the app feel significantly more finished.

- **Search on Deals page** — Deals has no search. Add a text filter on title/lead/property name.
- **Date range filter on Viewings** — "Show me next week's visits" is impossible today.
- **Lead email made optional in all dialogs** — Prevents agents from being blocked when logging a phone enquiry with no email.
- **Notification bell in top nav** — The `notifications` table exists in the DB. Wire it to a bell icon. Even showing the last 5 DB events (lead created, deal updated) would make the system feel live.
- **Working CSV export for Leads and Deals** — Right now export buttons toast. A simple server-side CSV download from the existing query would take 1 hour and would immediately save CFO/managers from manual data dumps.
- **User password reset by admin** — "Forgot password" support calls are wasted time. Add one input field to the edit-user modal.
- **Logo upload in Settings** — Stored in localStorage as a data URL. Simple file input, no backend needed.
- **"Check In" button on today's visits** — Currently renders but does nothing. Wire to `PUT /api/viewings/:id` with `status: completed`. Takes 30 minutes.

---

## Metrics This CRM Should Be Able to Answer (Currently Cannot)

A mature real estate CRM should answer these questions in under 10 seconds. None of these are possible today.

1. Which agent has the highest site-visit-to-booking conversion rate?
2. Which property has the most uncontacted new leads right now?
3. How many leads came from Facebook ads this month vs last month? What was the cost per conversion?
4. Which lead that was marked "lost" 3 months ago is worth re-engaging?
5. If a salesperson leaves tomorrow, which of their leads are at highest risk of going cold?
6. What is the total commission liability outstanding to all brokers right now?
7. Which BHK configuration has the longest average time from enquiry to booking?
8. Of leads that visited the site in the last 30 days, how many have not been followed up?

---

## Already Done (This Sprint)

- ✅ Lost reason captured when lead marked closed_lost — modal + DB column
- ✅ Inventory tab synced with real property/unit data from DB
- ✅ Analysis tab Sales Team Performance uses real agent data
- ✅ Lost Lead Analysis chart uses real DB data (not hardcoded)
- ✅ Portfolio analysis added to Properties page (computed from real data)
- ✅ Employee dashboard today's visits filtered to logged-in agent's actual viewings
- ✅ Broker performance table uses real agents-performance endpoint
- ✅ Location ROI uses real deals-by-city computation
- ✅ Approve/Release unit buttons now call `PUT /api/units/:id` with real status changes
- ✅ Settings agency profile and notifications persist to localStorage across sessions

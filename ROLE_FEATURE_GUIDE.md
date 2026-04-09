# EcoRoute — Role Feature Matrix & Production Implementation Guide
# File: ROLE_FEATURE_GUIDE.md
# Generated for: echo-sort project, Davao Oriental

---

## 1. Role Hierarchy Overview

```
SUPER_ADMIN
    └── ADMIN
          ├── DRIVER
          └── LGU
                └── CITIZEN
```

| Role | Scope | Created By |
|---|---|---|
| `SUPER_ADMIN` | Entire system | Seeded / manual |
| `ADMIN` | Barangay operations | Super Admin |
| `DRIVER` | Assigned routes | Admin / Super Admin |
| `LGU` | One barangay | Super Admin |
| `CITIZEN` | Self-registered | Public registration |

---

## 2. Per-Role Feature Access

### SUPER_ADMIN — System Control Center
**Route:** `/super-admin/dashboard`

| Feature | Access |
|---|---|
| View all profiles (all roles) | ✅ Full |
| Archive / restore any account | ✅ Full |
| Change any user's role | ✅ Full |
| Assign LGU to barangay | ✅ Full |
| View all audit logs | ✅ Full |
| Read/write system_settings | ✅ Full |
| View all citizens + violations across all barangays | ✅ Full |
| View all broadcasts | ✅ Full |
| Create system-wide broadcasts (barangay = NULL) | ✅ Full |
| View all collection schedules | ✅ Full |
| View all citizen reports | ✅ Full |
| View all notifications (support/debug) | ✅ Full |
| View bin network (all barangays) | ✅ Full |
| Manage collection schedules | ✅ Full |
| **Does NOT do:** Route optimization, driver dispatch | ❌ |

**Suggested additional responsibilities:**
- Create Admin accounts and assign them to barangays
- Monitor system health (bin battery levels, last_seen gaps)
- Review cross-barangay violation trends
- Configure fill level thresholds in `system_settings`

---

### ADMIN — Barangay Operations Manager
**Route:** `/admin/dashboard`

| Feature | Access |
|---|---|
| View bins (all) | ✅ Full |
| Deploy / move / delete bins on map | ✅ Full |
| View + manage drivers | ✅ Read + duty status update |
| Create collection schedules | ✅ Own barangay |
| Assign drivers to schedules | ✅ Full |
| View collections log | ✅ Full |
| Create broadcasts for their barangay | ✅ Full |
| View violations in their barangay | ✅ Read only |
| View citizen reports (for overview) | ✅ Read only |
| View bins fill levels in real-time | ✅ Full |
| Trigger A* route simulation (BinSimulator) | ✅ Full |
| View citizen roster (read-only) | ✅ Read |
| **Does NOT do:** Archive citizens, issue warnings | ❌ |

**New DB interactions after migration:**
- `INSERT` into `collection_schedules`
- `INSERT/UPDATE` into `schedule_assignments`
- `INSERT` into `broadcasts` (type: SCHEDULE_CHANGE, NOTICE)
- `INSERT` into `notifications` when schedule changes affect drivers
- `SELECT` from `citizen_reports` for overview

---

### DRIVER — Route Executor
**Route:** `/driver/dashboard`

| Feature | Access |
|---|---|
| View assigned collection schedules | ✅ Own only |
| View active bins on MapLibre map | ✅ Full |
| View fill levels + battery of all bins | ✅ Full |
| Execute A* optimized route | ✅ Full |
| Log collection (INSERT into collections) | ✅ Own |
| Receive BIN_CRITICAL / BIN_HIGH notifications | ✅ Full |
| Receive COLLECTION_REMINDER notifications | ✅ Own schedules |
| Receive ROUTE_UPDATED notifications | ✅ Full |
| Toggle ON-DUTY / OFF-DUTY status | ✅ Own |
| **Does NOT do:** Manage citizens, create schedules, archive users | ❌ |

**New DB interactions after migration:**
- `SELECT` from `collection_schedules` (via `schedule_assignments`)
- `SELECT` from `notifications` (own only)
- `UPDATE` on `notifications` (mark as read)
- `INSERT` into `push_tokens` (register device on login)

**Suggested additional driver features:**
- Offline mode: cache route + bin data in service worker for areas with poor signal
- Missed collection flag: if a bin is skipped, driver can note reason
- End-of-route report: summary of bins collected, weight, time

---

### LGU — Barangay Governance Officer
**Route:** `/lgu/dashboard`

| Feature | Access |
|---|---|
| View citizens in assigned barangay | ✅ Own barangay |
| View violations in assigned barangay | ✅ Own barangay |
| Issue / revoke warnings | ✅ Own barangay citizens |
| Resolve violations | ✅ Own barangay |
| Archive / restore citizens | ✅ Own barangay |
| Create / send broadcasts | ✅ Own barangay |
| View citizen reports | ✅ Own barangay (with reporter_id) |
| Escalate report → violation | ✅ Own barangay |
| Dismiss reports | ✅ Own barangay |
| View citizen compliance scores | ✅ Own barangay |
| Receive NEW_CITIZEN / NEW_VIOLATION notifications | ✅ Realtime |
| View collection schedule (read-only) | ✅ Own barangay |
| Create household account relations | ✅ Own barangay |
| **Does NOT do:** Manage bins, drivers, or other barangays | ❌ |

**New DB interactions after migration:**
- `SELECT/UPDATE` on `citizen_reports`
- `INSERT` on `violations` (when escalating a report)
- `INSERT` on `notifications` (warning issued, violation filed)
- `SELECT/INSERT` on `broadcasts`
- `SELECT/INSERT` on `citizen_scores`
- `SELECT/INSERT` on `account_relations`
- `INSERT` on `audit_logs` for every modifying action

---

### CITIZEN — Community Member
**Route:** `/citizen/schedule`

| Feature | Access |
|---|---|
| View collection schedule for their barangay | ✅ Own barangay |
| View bin map (fill levels, locations) | ✅ All public bins |
| Report another citizen (with proof upload) | ✅ INSERT into citizen_reports |
| View their own report history (no reporter_id exposed) | ✅ Own reports only |
| View their own violations | ✅ Own |
| View their compliance score (current month + history) | ✅ Own |
| View broadcasts / news feed from their barangay | ✅ Own barangay |
| Mark broadcast as read | ✅ Own |
| Receive notifications (warnings, broadcasts, violations) | ✅ Own |
| Register push token for Web Push | ✅ Own |
| **Does NOT do:** View other citizens' data, manage anything | ❌ |

**New DB interactions after migration:**
- `SELECT` from `collection_schedules` (own barangay)
- `SELECT` from `broadcasts` (own barangay + global)
- `INSERT` into `broadcast_reads` (mark as read)
- `INSERT` into `citizen_reports` (file a report)
- `SELECT` from `citizen_reports_public` view (own reports)
- `SELECT` from `citizen_scores` (own only)
- `SELECT/UPDATE` from `notifications` (own)
- `INSERT` into `push_tokens` (register on login)

---

## 3. Notification Delivery Matrix

| Event | Who Sends | Recipients |
|---|---|---|
| New citizen registered in barangay | System (Realtime trigger) | LGU of that barangay |
| Violation filed against citizen | LGU (on escalate) | Citizen (type: VIOLATION_FILED) |
| Warning issued | LGU | Citizen (type: WARNING_ISSUED) |
| Warning revoked | LGU | Citizen (type: WARNING_REVOKED) |
| Violation resolved | LGU | Citizen (type: VIOLATION_RESOLVED) |
| Citizen report submitted | System | LGU of that barangay (type: REPORT_RECEIVED) |
| Report status changed | LGU | Reporter citizen (type: REPORT_STATUS) |
| Broadcast sent | LGU / Admin | All citizens in barangay (type: BROADCAST) |
| Collection schedule created/updated | Admin | Drivers assigned + Citizens in barangay |
| Bin fill ≥ 90% | System / ESP32 edge | Admin + assigned Driver |
| Bin fill ≥ 70% | System | Assigned Driver |
| Account archived | Admin / Super Admin | Affected user (type: ACCOUNT_ARCHIVED) |
| Role changed | Super Admin | Affected user (type: ROLE_CHANGED) |

---

## 4. Citizen Report → Violation Pipeline

```
CITIZEN files citizen_report
    → INSERT citizen_reports (status: 'Submitted')
    → INSERT notifications (LGU: type='REPORT_RECEIVED')
    → Realtime bell fires for LGU

LGU reviews
    → UPDATE citizen_reports (status: 'Under Review', lgu_notes)
    → INSERT notifications (reporter: type='REPORT_STATUS', body='Your report is under review')

LGU escalates (valid report)
    → INSERT violations (citizen_id = reported_id, type, description, barangay)
    → UPDATE citizen_reports (status: 'Escalated')
    → INSERT notifications (reported citizen: type='VIOLATION_FILED')
    → INSERT notifications (reporter: type='REPORT_STATUS', body='Your report was escalated')
    → INSERT audit_logs

LGU dismisses (invalid report)
    → UPDATE citizen_reports (status: 'Dismissed')
    → INSERT notifications (reporter: type='REPORT_STATUS', body='Your report was reviewed and dismissed')
```

---

## 5. Compliance Score Algorithm

```
Monthly score (recomputed every 1st of month, or on any event):

base_score = 100

deductions:
  - active warnings:           × (-10) each   [from system_settings.score_deduction_warning]
  - unresolved violations:     × (-15) each   [from system_settings.score_deduction_violation]

credits:
  - violations resolved this month: × (+5) each   [from system_settings.score_credit_resolved]

final_score = MAX(0, base_score + credits - deductions)
```

**Score tiers (suggested display):**
| Score | Label | Color |
|---|---|---|
| 90–100 | Excellent | Emerald |
| 70–89 | Good | Green |
| 50–69 | Fair | Yellow |
| 30–49 | Poor | Orange |
| 0–29 | Critical | Red |

**Implementation:** Run as a Supabase Edge Function on a cron schedule (e.g. every Sunday midnight) or trigger recompute after every `audit_logs` INSERT with action_type IN ('LGU_ISSUE_WARNING', 'LGU_REVOKE_WARNING', 'LGU_RESOLVE_VIOLATION').

---

## 6. Push Notification Production Setup

```
1. Add VAPID keys to Supabase project secrets:
   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

2. Service worker (public/sw.js) listens for 'push' events
   and shows browser notifications via showNotification().

3. On login: navigator.serviceWorker.ready
   → registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })
   → POST /api/push-token with { token, platform: 'web' }
   → INSERT into push_tokens

4. Supabase Edge Function: send-notification
   Input: { user_id, title, body, type, metadata }
   Steps:
     a. INSERT into notifications (in-app bell)
     b. SELECT push_tokens WHERE user_id = $1 AND is_active = true
     c. For each token: POST to FCM / Web Push API
     d. UPDATE push_tokens SET last_used_at = now()
     e. On 410 Gone: UPDATE push_tokens SET is_active = false

5. Call send-notification Edge Function from:
   - LGU dashboard actions (warning, violation, broadcast)
   - Supabase Database Trigger on violations INSERT
   - Supabase Database Trigger on citizen_reports INSERT
   - Admin collection schedule changes
   - ESP32 firmware bin fill threshold breach (PATCH bins → trigger)
```

---

## 7. Suggested Additional Role Features

### ADMIN — Suggested additions
- **Bin maintenance log**: track bin repairs, battery replacements, relocations
- **Driver performance report**: collections per day per driver, missed stops
- **Weekly collection summary**: auto-generated PDF via Edge Function + Resend

### DRIVER — Suggested additions
- **Offline mode**: Cache route + bin fill levels in service worker IndexedDB
- **End-of-route report**: total bins collected, estimated weight, distance
- **Incident report**: flag a bin as damaged, missing, or inaccessible

### LGU — Suggested additions
- **Citizen score leaderboard**: gamification — top 10 compliant citizens per month
- **Violation heatmap**: Supabase + MapLibre heatmap layer from violations.location_lat/lng
- **Monthly summary email**: auto-generated via Edge Function + Resend to LGU email

### CITIZEN — Suggested additions
- **Collection reminder push**: 30 min before their barangay's scheduled collection
- **Waste calendar**: visual monthly calendar with collection days highlighted
- **Eco points**: rename score to "Eco Points" for gamification — badges for streaks

---

## 8. Table Summary (new tables added)

| Table | Purpose | Key consumers |
|---|---|---|
| `notifications` | Per-user inbox, all roles | All roles |
| `broadcasts` | Barangay-wide announcements | LGU, Admin → Citizen |
| `broadcast_reads` | Read receipt tracking | Citizen, LGU analytics |
| `collection_schedules` | Recurring waste collection plans | Admin, Driver, Citizen |
| `schedule_assignments` | Driver ↔ schedule mapping | Admin, Driver |
| `citizen_reports` | Citizen-to-citizen reports with proof | Citizen, LGU |
| `push_tokens` | FCM/APNs tokens for Web Push | All roles, Edge Functions |
| `citizen_scores` | Monthly compliance score | Citizen, LGU |
| `account_relations` | Household grouping | LGU, Citizen |
| `system_settings` | Global config key/value store | Super Admin |

No existing tables (`profiles`, `bins`, `violations`, `collections`, `audit_logs`, `citizen_details`, `driver_details`, `lgu_details`, `super_admin_details`) were modified.

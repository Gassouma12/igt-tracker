"""
One-time ETL: iGT Master Sheet.xlsx  ->  normalized seed JSON for the platform.

Reads the 24 per-member "Tracking Sheets" (identical 24-col template, A-Y) and
normalizes the flat outreach rows into proper entities:

    Company -> Contact -> Opportunity -> (Activities | Meetings | Contract)

plus derived Users / Local Committees / Goals. Cleans the spreadsheet mess:
drops the 1899 epoch null-dates, trims/de-dupes company names, computes status
from the funnel state, and explodes the 6 channel counter columns into activity
events. Output: src/data/seed/*.json  (deterministic ids, safe to re-run).

Usage:  python scripts/etl/migrate_xlsx.py
"""

from __future__ import annotations
import json
import os
import re
from datetime import datetime, date

import openpyxl

# ---------------------------------------------------------------- paths
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(HERE, "..", ".."))
SRC_XLSX = os.environ.get(
    "IGT_XLSX", r"C:\Users\abena\Downloads\iGT Master Sheet.xlsx"
)
OUT_DIR = os.path.join(PROJECT, "src", "data", "seed")

# ---------------------------------------------------------------- config
# Each per-person tracking sheet -> canonical member name (merge duplicates).
PERSON_BY_SHEET = {
    "Pavlos Tracking Sheet": "Pavlos",
    "Nico Tracking Sheet": "Nico",
    "Roxy Tracking Sheet": "Roxy",
    "Marit Tracking Sheet": "Marit",
    "Tijs Tracking Sheet": "Tijs",
    "Alandra": "Alandra",
    "Mariia": "Mariia",
    "Delia": "Delia",
    "Daksh": "Daksh",
    "Felix": "Felix",
    "Dieter": "Dieter",
    "Rayhan": "Rayhan",
    "Adam Tracking Sheet": "Adam",
    "Ebrahim Tracking Sheet": "Ebrahim",
    "Rayhan Tracking Sheet": "Rayhan",
    "Pratyskshi Tracking Sheet": "Pratyksshi",
    "Linda Tracking Sheet": "Linda",
    "Kobe Tracking Sheet": "Kobe",
    "Dieter Tracking Sheet": "Dieter",
    "Nazar contact list": "Nazar",
    "Jeremy Tracking Sheet": "Jeremy",
    "Yodi contact list": "Yodi",
    "Carmela BD": "Carmela",
}

# Local Committees that the Master Track dashboard rolls up.
LCS = [
    {"id": "lc_ghent", "name": "LC Ghent", "country": "Belgium"},
    {"id": "lc_antwerp", "name": "LC Antwerp", "country": "Belgium"},
    {"id": "lc_leuven", "name": "LC Leuven", "country": "Belgium"},
]

# Member -> LC assignment. NOTE: the spreadsheet has no clean member->LC map,
# so this is a documented migration assumption, editable in the UI later.
LC_BY_PERSON = {
    "Pavlos": "lc_ghent", "Tijs": "lc_ghent", "Kobe": "lc_ghent",
    "Linda": "lc_ghent", "Carmela": "lc_ghent",
    "Roxy": "lc_antwerp", "Nico": "lc_antwerp", "Adam": "lc_antwerp",
    "Marit": "lc_antwerp", "Dieter": "lc_antwerp", "Nazar": "lc_antwerp",
    "Alandra": "lc_leuven", "Mariia": "lc_leuven", "Delia": "lc_leuven",
    "Daksh": "lc_leuven", "Felix": "lc_leuven", "Rayhan": "lc_leuven",
    "Ebrahim": "lc_leuven", "Pratyksshi": "lc_leuven", "Jeremy": "lc_leuven",
    "Yodi": "lc_leuven",
}

# Leadership per LC: (LCP, LCVP). Everyone else is a member.
LEADERSHIP = {
    "lc_ghent": {"lcp": "Pavlos", "lcvp": "Tijs"},
    "lc_antwerp": {"lcp": "Roxy", "lcvp": "Adam"},
    "lc_leuven": {"lcp": "Alandra", "lcvp": "Felix"},
}

# Channel columns (0-based index into the row) -> (type, phase)
CHANNELS = {
    9: ("LinkedIn", "first"),     # J  LinkedIn 1st Contact
    10: ("Email", "first"),       # K  Email First Contact
    11: ("Cold call", "first"),   # L  Cold Call First Contact
    12: ("LinkedIn", "follow-up"),  # M  LinkedIn Follow Up
    13: ("Email", "follow-up"),     # N  Email Followup
    14: ("Cold call", "follow-up"), # O  Cold Call Followups
}

STATUS = {
    "prospect": "Prospect",
    "contacted": "Contacted",
    "followup": "Follow-up",
    "meeting": "Meeting scheduled",
    "negotiation": "Negotiation",
    "sent": "Contract sent",
    "signed": "Contract signed",
    "lost": "Lost",
}

# ---------------------------------------------------------------- helpers
def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(s).strip().lower()).strip("-")


def norm_name(s) -> str:
    return re.sub(r"\s+", " ", str(s)).strip()


def company_key(s) -> str:
    k = norm_name(s).lower()
    k = re.sub(r"[\.,]+$", "", k)
    k = re.sub(r"\s*\(.*?\)\s*$", "", k)  # drop trailing parenthetical
    return k.strip()


def iso(v) -> str | None:
    """Excel cell -> ISO date string, or None for blanks / the 1899 epoch."""
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        if v.year < 2010:  # 1899/1900 epoch == "empty" in this sheet
            return None
        return v.date().isoformat() if isinstance(v, datetime) else v.isoformat()
    s = str(v).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            d = datetime.strptime(s, fmt)
            return None if d.year < 2010 else d.date().isoformat()
        except ValueError:
            pass
    return None


def num(v):
    if v is None:
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def cell(row, i):
    return row[i] if i < len(row) else None


def has(v) -> bool:
    n = num(v)
    if n is not None:
        return n > 0
    return v is not None and str(v).strip() != ""


# ---------------------------------------------------------------- load
print(f"Loading {SRC_XLSX} ...")
wb = openpyxl.load_workbook(SRC_XLSX, data_only=True, read_only=True)

# accumulators
companies: dict[str, dict] = {}     # company_key -> company
contacts: dict[str, dict] = {}      # contact_key -> contact (key: companyId|email-or-name)
opportunities: list[dict] = []
activities: list[dict] = []
meetings: list[dict] = []
contracts: list[dict] = []

oid = aid = mid = cid = 0


def get_company(name) -> str:
    global cid
    key = company_key(name)
    if key not in companies:
        cid += 1
        companies[key] = {
            "id": f"co_{cid}",
            "name": norm_name(name),
            "industry": None,
            "country": "Belgium",
            "website": None,
            "linkedin": None,
            "notes": None,
        }
    return companies[key]["id"]


def get_contact(company_id, full_name, role, email, phone, linkedin) -> str | None:
    if not has(full_name) and not has(email):
        return None
    email_n = norm_name(email).lower() if has(email) else ""
    key = f"{company_id}|{email_n or norm_name(full_name).lower()}"
    if key not in contacts:
        contacts[key] = {
            "id": f"ct_{len(contacts) + 1}",
            "companyId": company_id,
            "name": norm_name(full_name) if has(full_name) else "(unknown)",
            "role": norm_name(role) if has(role) else None,
            "email": norm_name(email) if has(email) else None,
            "phone": norm_name(phone) if has(phone) else None,
            "linkedin": norm_name(linkedin) if has(linkedin) else None,
        }
    return contacts[key]["id"]


def derive_status(row) -> str:
    contract_signed = has(cell(row, 21)) or iso(cell(row, 23))  # V signed / X date signed
    contract_sent = iso(cell(row, 22))                          # W date sent
    first_meeting = has(cell(row, 19)) or iso(cell(row, 16))    # T first meeting / Q date
    follow_meet = num(cell(row, 20)) or 0                       # U # follow-up meetings
    has_followup = any(has(cell(row, i)) for i in (12, 13, 14))
    has_first = any(has(cell(row, i)) for i in (9, 10, 11))
    if contract_signed:
        return STATUS["signed"]
    if contract_sent:
        return STATUS["sent"]
    if follow_meet and follow_meet > 0:
        return STATUS["negotiation"]
    if first_meeting:
        return STATUS["meeting"]
    if has_followup:
        return STATUS["followup"]
    if has_first:
        return STATUS["contacted"]
    return STATUS["prospect"]


# ---------------------------------------------------------------- parse rows
seen_persons: set[str] = set()
for ws in wb.worksheets:
    person = PERSON_BY_SHEET.get(ws.title)
    if not person:
        continue
    seen_persons.add(person)
    owner_id = f"usr_{slug(person)}"
    lc_id = LC_BY_PERSON.get(person, "lc_ghent")

    rows = ws.iter_rows(min_row=2, values_only=True)
    for row in rows:
        row = list(row)
        company = cell(row, 3)  # D
        if not has(company):
            continue
        out_date = iso(cell(row, 0))  # A Date of Outreach
        company_id = get_company(company)
        contact_id = get_contact(
            company_id, cell(row, 4), cell(row, 5), cell(row, 8), cell(row, 7), cell(row, 6)
        )

        oid += 1
        opp_id = f"opp_{oid}"
        status = derive_status(row)

        # ---- activities (explode the 6 channel counter columns) ----
        opp_acts: list[dict] = []
        for idx, (atype, phase) in CHANNELS.items():
            v = cell(row, idx)
            if not has(v):
                continue
            count = int(num(v) or 1)
            aid += 1
            act = {
                "id": f"act_{aid}",
                "opportunityId": opp_id,
                "ownerId": owner_id,
                "type": atype,
                "phase": phase,
                "count": max(count, 1),
                "outcome": "neutral",
                "date": out_date,
                "notes": None,
            }
            activities.append(act)
            opp_acts.append(act)

        # ---- meetings ----
        meet_date = iso(cell(row, 16))  # Q
        first_meeting = has(cell(row, 19))
        follow_meet = int(num(cell(row, 20)) or 0)  # U
        opp_meetings = []
        if first_meeting or meet_date:
            mid += 1
            m = {
                "id": f"mtg_{mid}",
                "opportunityId": opp_id,
                "ownerId": owner_id,
                "date": meet_date or out_date,
                "number": 1,
                "outcome": "Held",
                "nextAction": None,
            }
            meetings.append(m)
            opp_meetings.append(m)
            # a meeting also counts as an activity touch
            aid += 1
            activities.append({
                "id": f"act_{aid}", "opportunityId": opp_id, "ownerId": owner_id,
                "type": "Meeting", "phase": "meeting", "count": 1,
                "outcome": "positive", "date": meet_date or out_date, "notes": "First meeting",
            })
        for n in range(follow_meet):
            mid += 1
            meetings.append({
                "id": f"mtg_{mid}", "opportunityId": opp_id, "ownerId": owner_id,
                "date": None, "number": n + 2, "outcome": "Held", "nextAction": None,
            })

        # ---- contract ----
        sent = iso(cell(row, 22))    # W
        signed = iso(cell(row, 23))  # X
        if sent or signed or has(cell(row, 21)):
            days = num(cell(row, 24))  # Y Days till signed
            if days is None and sent and signed:
                days = (date.fromisoformat(signed) - date.fromisoformat(sent)).days
            cid_c = f"con_{len(contracts) + 1}"
            contracts.append({
                "id": cid_c,
                "opportunityId": opp_id,
                "dateSent": sent,
                "dateSigned": signed,
                "daysUntilSigned": int(days) if days is not None else None,
            })

        # ---- opportunity (with derived rollups) ----
        act_dates = [a["date"] for a in opp_acts if a["date"]]
        all_dates = [d for d in ([out_date, meet_date, sent, signed] + act_dates) if d]
        last_activity = max(all_dates) if all_dates else out_date
        created = min([d for d in ([out_date] + act_dates) if d], default=out_date)

        # synthesize a next-action for still-open opportunities so the
        # follow-up / overdue notifications have something to work with.
        next_action = None
        next_action_date = None
        if status in (STATUS["contacted"], STATUS["followup"],
                      STATUS["meeting"], STATUS["negotiation"], STATUS["sent"]) and last_activity:
            next_action_date = date.fromordinal(
                date.fromisoformat(last_activity).toordinal() + 7
            ).isoformat()
            next_action = {
                STATUS["contacted"]: "Send follow-up message",
                STATUS["followup"]: "Follow up again",
                STATUS["meeting"]: "Prepare / hold meeting",
                STATUS["negotiation"]: "Advance negotiation",
                STATUS["sent"]: "Chase signature",
            }[status]

        opportunities.append({
            "id": opp_id,
            "companyId": company_id,
            "contactId": contact_id,
            "ownerId": owner_id,
            "lcId": lc_id,
            "status": status,
            "nextAction": next_action,
            "nextActionDate": next_action_date,
            "lastActivityAt": last_activity,
            "createdAt": created,
            "updatedAt": last_activity,
        })

wb.close()

# ---------------------------------------------------------------- users / LCs / goals
users: list[dict] = []
users.append({
    "id": "usr_admin", "name": "Aboulkacem (MCVP iGT)", "email": "admin@aib.org",
    "role": "admin", "lcId": None, "position": "MCVP Sales", "teamLeadId": None, "active": True,
})

# ensure every assigned person exists even if their sheet had no rows
all_persons = set(LC_BY_PERSON) | seen_persons
for person in sorted(all_persons):
    pid = f"usr_{slug(person)}"
    lc_id = LC_BY_PERSON.get(person, "lc_ghent")
    lead = LEADERSHIP.get(lc_id, {})
    if person == lead.get("lcp"):
        role, pos = "lcp", "Local Committee President"
    elif person == lead.get("lcvp"):
        role, pos = "lcvp", "VP Sales"
    else:
        role, pos = "member", "Sales Member"
    # members report to their LC's LCVP
    lcvp_name = lead.get("lcvp")
    team_lead = f"usr_{slug(lcvp_name)}" if (role == "member" and lcvp_name) else None
    users.append({
        "id": pid, "name": person, "email": f"{slug(person)}@aiesec.be",
        "role": role, "lcId": lc_id, "position": pos,
        "teamLeadId": team_lead, "active": True,
    })

local_committees = []
for lc in LCS:
    lead = LEADERSHIP.get(lc["id"], {})
    local_committees.append({
        "id": lc["id"], "name": lc["name"], "country": lc["country"],
        "lcpId": f"usr_{slug(lead['lcp'])}" if lead.get("lcp") else None,
        "lcvpIds": [f"usr_{slug(lead['lcvp'])}"] if lead.get("lcvp") else [],
    })

# Goals: the sheet's Plan columns were mostly 0, so seed sensible semester
# targets (per member) and roll LC/global up from them. Editable in-app.
PERIOD = "2026-S1"
MEMBER_TARGET = {"outreaches": 200, "meetings": 10, "contracts": 2}
goals = []
gid = 0
members_by_lc: dict[str, int] = {}
for u in users:
    if u["role"] in ("member", "lcvp", "lcp") and u["lcId"]:
        members_by_lc[u["lcId"]] = members_by_lc.get(u["lcId"], 0) + 1
        for metric, planned in MEMBER_TARGET.items():
            gid += 1
            goals.append({
                "id": f"goal_{gid}", "scope": "member", "ownerId": u["id"],
                "lcId": u["lcId"], "period": PERIOD, "metric": metric, "planned": planned,
            })
for lc_id, n in members_by_lc.items():
    for metric, planned in MEMBER_TARGET.items():
        gid += 1
        goals.append({
            "id": f"goal_{gid}", "scope": "lc", "ownerId": None, "lcId": lc_id,
            "period": PERIOD, "metric": metric, "planned": planned * n,
        })
for metric, planned in MEMBER_TARGET.items():
    total = sum(planned * n for n in members_by_lc.values())
    gid += 1
    goals.append({
        "id": f"goal_{gid}", "scope": "global", "ownerId": None, "lcId": None,
        "period": PERIOD, "metric": metric, "planned": total,
    })

# ---------------------------------------------------------------- write
os.makedirs(OUT_DIR, exist_ok=True)
datasets = {
    "users": users,
    "localCommittees": local_committees,
    "companies": list(companies.values()),
    "contacts": list(contacts.values()),
    "opportunities": opportunities,
    "activities": activities,
    "meetings": meetings,
    "contracts": contracts,
    "goals": goals,
    "activityLog": [],
}
for name, data in datasets.items():
    path = os.path.join(OUT_DIR, f"{name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)

# ---------------------------------------------------------------- report
print("\n=== SEED SUMMARY ===")
for name, data in datasets.items():
    print(f"  {name:16} {len(data):>5}")
print("\nStatus distribution:")
dist: dict[str, int] = {}
for o in opportunities:
    dist[o["status"]] = dist.get(o["status"], 0) + 1
for k, v in sorted(dist.items(), key=lambda x: -x[1]):
    print(f"  {k:20} {v}")
print(f"\nUsers by role:")
roled: dict[str, int] = {}
for u in users:
    roled[u["role"]] = roled.get(u["role"], 0) + 1
print("  " + ", ".join(f"{k}={v}" for k, v in roled.items()))
print(f"\nWrote JSON to {OUT_DIR}")

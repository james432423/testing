#!/usr/bin/env python3
"""
Life Dashboard CLI — Personal command center.

Modules: travel, spots, projects, points, notes, briefing
Storage: SQLite (life.db, auto-created alongside this script)
Dependencies: None (stdlib only)
"""

import argparse
import datetime as dt
import json
import os
import sqlite3
import sys
import textwrap

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "life.db")

# ── Database ────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            start_date TEXT,
            end_date TEXT,
            days INTEGER,
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS trip_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER REFERENCES trips(id),
            day_num INTEGER NOT NULL,
            city TEXT,
            plan TEXT DEFAULT '',
            notes TEXT DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER REFERENCES trips(id),
            type TEXT NOT NULL,  -- flight, hotel, train, etc.
            description TEXT NOT NULL,
            confirmation TEXT DEFAULT '',
            card_used TEXT DEFAULT '',
            points_used INTEGER DEFAULT 0,
            cash_cost REAL DEFAULT 0,
            currency TEXT DEFAULT 'USD',
            cash_value REAL DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS spots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            city TEXT DEFAULT '',
            type TEXT DEFAULT 'restaurant',
            tags TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            rating INTEGER DEFAULT 0,
            visited INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER REFERENCES projects(id),
            content TEXT NOT NULL,
            status TEXT DEFAULT 'todo',
            created_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT
        );
        CREATE TABLE IF NOT EXISTS points_balances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            program TEXT NOT NULL UNIQUE,
            balance INTEGER DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS budget (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER REFERENCES trips(id),
            amount REAL NOT NULL,
            currency TEXT DEFAULT 'USD',
            category TEXT DEFAULT 'other',
            city TEXT DEFAULT '',
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            tags TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    conn.close()


# ── Helpers ─────────────────────────────────────────────────────────────────

CURRENCY_SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥"}


def fmt_money(amount, currency="USD"):
    sym = CURRENCY_SYMBOLS.get(currency, currency + " ")
    return f"{sym}{amount:,.2f}"


def parse_date(s):
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return dt.datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def print_table(rows, headers):
    if not rows:
        print("  (none)")
        return
    col_widths = [len(h) for h in headers]
    str_rows = []
    for row in rows:
        sr = [str(v) if v is not None else "" for v in row]
        str_rows.append(sr)
        for i, v in enumerate(sr):
            col_widths[i] = max(col_widths[i], len(v))
    header_line = "  ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    print(header_line)
    print("  ".join("-" * w for w in col_widths))
    for sr in str_rows:
        print("  ".join(sr[i].ljust(col_widths[i]) for i in range(len(headers))))


# ── Trip Commands ───────────────────────────────────────────────────────────

def cmd_trip(args):
    conn = get_db()
    sub = args.trip_action

    if sub == "add":
        start = args.start or ""
        days = args.days or 0
        end = ""
        if start and days:
            sd = parse_date(start)
            if sd:
                end = str(sd + dt.timedelta(days=days - 1))
        conn.execute(
            "INSERT INTO trips (name, start_date, end_date, days, notes) VALUES (?,?,?,?,?)",
            (args.name, start, end, days, args.note or ""),
        )
        conn.commit()
        print(f"Trip added: {args.name}")

    elif sub == "list":
        rows = conn.execute("SELECT id, name, start_date, days, notes FROM trips ORDER BY start_date").fetchall()
        print_table([list(r) for r in rows], ["ID", "Name", "Start", "Days", "Notes"])

    elif sub == "day":
        trip_id = args.trip_id
        if args.set:
            conn.execute(
                "INSERT OR REPLACE INTO trip_days (trip_id, day_num, city, plan, notes) "
                "VALUES (?,?,?,?,?)",
                (trip_id, args.day_num, args.city or "", args.set, args.note or ""),
            )
            conn.commit()
            print(f"Day {args.day_num} updated.")
        else:
            if args.day_num:
                rows = conn.execute(
                    "SELECT day_num, city, plan, notes FROM trip_days WHERE trip_id=? AND day_num=?",
                    (trip_id, args.day_num),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT day_num, city, plan, notes FROM trip_days WHERE trip_id=? ORDER BY day_num",
                    (trip_id,),
                ).fetchall()
            print_table([list(r) for r in rows], ["Day", "City", "Plan", "Notes"])

    elif sub == "book":
        conn.execute(
            "INSERT INTO bookings (trip_id, type, description, confirmation, card_used, points_used, cash_cost, currency, cash_value, notes) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (
                args.trip_id, args.type, args.description,
                args.confirmation or "", args.card or "", args.points or 0,
                args.cost or 0, args.currency or "USD", args.value or 0, args.note or "",
            ),
        )
        conn.commit()
        print(f"Booking added: {args.description}")

    elif sub == "bookings":
        rows = conn.execute(
            "SELECT id, type, description, confirmation, card_used, points_used, cash_cost, currency "
            "FROM bookings WHERE trip_id=? ORDER BY id",
            (args.trip_id,),
        ).fetchall()
        print_table([list(r) for r in rows], ["ID", "Type", "Description", "Conf#", "Card", "Points", "Cost", "Curr"])

    elif sub == "budget-add":
        conn.execute(
            "INSERT INTO budget (trip_id, amount, currency, category, city, note) VALUES (?,?,?,?,?,?)",
            (args.trip_id, args.amount, args.currency or "USD", args.category or "other", args.city or "", args.note or ""),
        )
        conn.commit()
        print(f"Expense logged: {fmt_money(args.amount, args.currency or 'USD')} ({args.category or 'other'})")

    elif sub == "budget":
        rows = conn.execute(
            "SELECT category, currency, SUM(amount) FROM budget WHERE trip_id=? GROUP BY category, currency",
            (args.trip_id,),
        ).fetchall()
        print(f"\nBudget summary for trip {args.trip_id}:")
        total_by_curr = {}
        for cat, curr, total in rows:
            print(f"  {cat:15s}  {fmt_money(total, curr)}")
            total_by_curr[curr] = total_by_curr.get(curr, 0) + total
        print("  " + "-" * 30)
        for curr, total in total_by_curr.items():
            print(f"  {'TOTAL':15s}  {fmt_money(total, curr)}")

    conn.close()


# ── Spot Commands ───────────────────────────────────────────────────────────

def cmd_spot(args):
    conn = get_db()
    sub = args.spot_action

    if sub == "add":
        conn.execute(
            "INSERT INTO spots (name, city, type, tags, notes) VALUES (?,?,?,?,?)",
            (args.name, args.city or "", args.type or "restaurant", args.tags or "", args.note or ""),
        )
        conn.commit()
        print(f"Spot saved: {args.name}")

    elif sub == "list":
        query = "SELECT id, name, city, type, tags, rating, CASE WHEN visited THEN '✓' ELSE '' END FROM spots WHERE 1=1"
        params = []
        if args.city:
            query += " AND LOWER(city) LIKE ?"
            params.append(f"%{args.city.lower()}%")
        if args.tags:
            for tag in args.tags.split(","):
                query += " AND LOWER(tags) LIKE ?"
                params.append(f"%{tag.strip().lower()}%")
        query += " ORDER BY city, name"
        rows = conn.execute(query, params).fetchall()
        print_table([list(r) for r in rows], ["ID", "Name", "City", "Type", "Tags", "Rating", "Visited"])

    elif sub == "rate":
        conn.execute("UPDATE spots SET rating=?, visited=1 WHERE id=?", (args.rating, args.id))
        conn.commit()
        print(f"Spot {args.id} rated {args.rating}/5.")

    elif sub == "visit":
        conn.execute("UPDATE spots SET visited=1 WHERE id=?", (args.id,))
        conn.commit()
        print(f"Spot {args.id} marked visited.")

    conn.close()


# ── Project Commands ────────────────────────────────────────────────────────

def cmd_project(args):
    conn = get_db()
    sub = args.project_action

    if sub == "add":
        conn.execute(
            "INSERT INTO projects (name, description) VALUES (?,?)",
            (args.name, args.description or ""),
        )
        conn.commit()
        print(f"Project created: {args.name}")

    elif sub == "list":
        rows = conn.execute(
            "SELECT p.id, p.name, p.status, "
            "(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='todo') AS todo, "
            "(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='in-progress') AS wip, "
            "(SELECT COUNT(*) FROM tasks t WHERE t.project_id=p.id AND t.status='done') AS done "
            "FROM projects p WHERE p.status='active' ORDER BY p.name",
        ).fetchall()
        print_table([list(r) for r in rows], ["ID", "Name", "Status", "Todo", "WIP", "Done"])

    elif sub == "task-add":
        conn.execute(
            "INSERT INTO tasks (project_id, content) VALUES (?,?)",
            (args.project_id, args.content),
        )
        conn.commit()
        print(f"Task added to project {args.project_id}.")

    elif sub == "tasks":
        status_filter = ""
        params = [args.project_id]
        if args.status:
            status_filter = " AND status=?"
            params.append(args.status)
        rows = conn.execute(
            f"SELECT id, content, status, created_at FROM tasks WHERE project_id=?{status_filter} ORDER BY "
            "CASE status WHEN 'in-progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END, id",
            params,
        ).fetchall()
        print_table([list(r) for r in rows], ["ID", "Task", "Status", "Created"])

    elif sub == "task-update":
        new_status = args.status
        conn.execute(
            "UPDATE tasks SET status=?, completed_at=CASE WHEN ?='done' THEN datetime('now') ELSE NULL END WHERE id=?",
            (new_status, new_status, args.task_id),
        )
        conn.commit()
        print(f"Task {args.task_id} → {new_status}")

    conn.close()


# ── Points Commands ─────────────────────────────────────────────────────────

def cmd_points(args):
    conn = get_db()
    sub = args.points_action

    if sub == "set":
        conn.execute(
            "INSERT INTO points_balances (program, balance, updated_at) VALUES (?,?, datetime('now')) "
            "ON CONFLICT(program) DO UPDATE SET balance=excluded.balance, updated_at=datetime('now')",
            (args.program.lower(), args.balance),
        )
        conn.commit()
        print(f"{args.program}: {args.balance:,} points")

    elif sub == "add":
        conn.execute(
            "UPDATE points_balances SET balance=balance+?, updated_at=datetime('now') WHERE program=?",
            (args.amount, args.program.lower()),
        )
        conn.commit()
        print(f"Added {args.amount:,} to {args.program}.")

    elif sub == "list":
        rows = conn.execute(
            "SELECT program, balance, updated_at FROM points_balances ORDER BY program"
        ).fetchall()
        print("\nPoints Balances:")
        for prog, bal, updated in rows:
            print(f"  {prog:20s}  {bal:>10,}    (updated {updated})")
        if not rows:
            print("  (none tracked yet)")

    conn.close()


# ── Notes Commands ──────────────────────────────────────────────────────────

def cmd_note(args):
    conn = get_db()
    sub = args.note_action

    if sub == "add":
        conn.execute(
            "INSERT INTO notes (content, tags) VALUES (?,?)",
            (args.content, args.tags or ""),
        )
        conn.commit()
        print("Note saved.")

    elif sub == "list":
        query = "SELECT id, content, tags, created_at FROM notes WHERE 1=1"
        params = []
        if args.search:
            query += " AND (LOWER(content) LIKE ? OR LOWER(tags) LIKE ?)"
            params.extend([f"%{args.search.lower()}%"] * 2)
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(args.limit or 10)
        rows = conn.execute(query, params).fetchall()
        for row in rows:
            print(f"  [{row['id']}] ({row['created_at'][:10]}) {row['content']}")
            if row["tags"]:
                print(f"       tags: {row['tags']}")
        if not rows:
            print("  (no notes)")

    elif sub == "delete":
        conn.execute("DELETE FROM notes WHERE id=?", (args.id,))
        conn.commit()
        print(f"Note {args.id} deleted.")

    conn.close()


# ── Briefing ────────────────────────────────────────────────────────────────

def cmd_briefing(args):
    conn = get_db()
    today = dt.date.today()

    print(f"\n{'=' * 50}")
    print(f"  LIFE DASHBOARD — {today.strftime('%A, %B %d %Y')}")
    print(f"{'=' * 50}")

    # Upcoming trips
    trips = conn.execute(
        "SELECT name, start_date, days FROM trips WHERE start_date >= ? ORDER BY start_date LIMIT 3",
        (str(today),),
    ).fetchall()
    print(f"\n📍 UPCOMING TRIPS")
    if trips:
        for t in trips:
            sd = parse_date(t["start_date"])
            if sd:
                delta = (sd - today).days
                print(f"  {t['name']} — {t['start_date']} ({delta} days away, {t['days']} days)")
            else:
                print(f"  {t['name']} — {t['start_date']} ({t['days']} days)")
    else:
        print("  No upcoming trips.")

    # Active project tasks
    print(f"\n🔧 ACTIVE TASKS")
    wip = conn.execute(
        "SELECT t.content, p.name FROM tasks t JOIN projects p ON t.project_id=p.id "
        "WHERE t.status IN ('in-progress','todo') ORDER BY t.status, t.id LIMIT 10"
    ).fetchall()
    if wip:
        for t in wip:
            print(f"  • {t['content']} [{t['name']}]")
    else:
        print("  All clear.")

    # Points
    print(f"\n💳 POINTS")
    pts = conn.execute("SELECT program, balance FROM points_balances ORDER BY program").fetchall()
    if pts:
        for p in pts:
            print(f"  {p['program']:20s} {p['balance']:>10,}")
    else:
        print("  No points tracked.")

    # Recent notes
    print(f"\n📝 RECENT NOTES")
    notes = conn.execute("SELECT content, created_at FROM notes ORDER BY created_at DESC LIMIT 5").fetchall()
    if notes:
        for n in notes:
            print(f"  [{n['created_at'][:10]}] {n['content'][:80]}")
    else:
        print("  No notes.")

    print(f"\n{'=' * 50}\n")
    conn.close()


# ── CLI Parser ──────────────────────────────────────────────────────────────

def build_parser():
    p = argparse.ArgumentParser(prog="life", description="Life Dashboard CLI")
    sub = p.add_subparsers(dest="command")

    # ── trip ──
    tp = sub.add_parser("trip", help="Travel planner")
    tsub = tp.add_subparsers(dest="trip_action")

    ta = tsub.add_parser("add", help="Add a trip")
    ta.add_argument("name")
    ta.add_argument("--start", help="Start date (YYYY-MM-DD)")
    ta.add_argument("--days", type=int)
    ta.add_argument("--note")

    tsub.add_parser("list", help="List trips")

    td = tsub.add_parser("day", help="View/set day plans")
    td.add_argument("trip_id", type=int)
    td.add_argument("day_num", type=int, nargs="?")
    td.add_argument("--set", help="Set the plan for this day")
    td.add_argument("--city")
    td.add_argument("--note")

    tb = tsub.add_parser("book", help="Add a booking")
    tb.add_argument("trip_id", type=int)
    tb.add_argument("type", help="flight/hotel/train/etc")
    tb.add_argument("description")
    tb.add_argument("--confirmation")
    tb.add_argument("--card")
    tb.add_argument("--points", type=int)
    tb.add_argument("--cost", type=float)
    tb.add_argument("--currency", default="USD")
    tb.add_argument("--value", type=float, help="Cash value of points redemption")
    tb.add_argument("--note")

    tbl = tsub.add_parser("bookings", help="List bookings for a trip")
    tbl.add_argument("trip_id", type=int)

    tba = tsub.add_parser("budget-add", help="Log an expense")
    tba.add_argument("trip_id", type=int)
    tba.add_argument("amount", type=float)
    tba.add_argument("--currency", default="USD")
    tba.add_argument("--category", default="other")
    tba.add_argument("--city")
    tba.add_argument("--note")

    tbs = tsub.add_parser("budget", help="Budget summary")
    tbs.add_argument("trip_id", type=int)

    # ── spot ──
    sp = sub.add_parser("spot", help="Save places/restaurants")
    ssub = sp.add_subparsers(dest="spot_action")

    sa = ssub.add_parser("add", help="Add a spot")
    sa.add_argument("name")
    sa.add_argument("--city")
    sa.add_argument("--type", default="restaurant")
    sa.add_argument("--tags")
    sa.add_argument("--note")

    sl = ssub.add_parser("list", help="List spots")
    sl.add_argument("--city")
    sl.add_argument("--tags")

    sr = ssub.add_parser("rate", help="Rate a spot")
    sr.add_argument("id", type=int)
    sr.add_argument("rating", type=int, choices=[1, 2, 3, 4, 5])

    sv = ssub.add_parser("visit", help="Mark a spot visited")
    sv.add_argument("id", type=int)

    # ── project ──
    pp = sub.add_parser("project", help="Side project tracker")
    psub = pp.add_subparsers(dest="project_action")

    pa = psub.add_parser("add", help="Add a project")
    pa.add_argument("name")
    pa.add_argument("--description")

    psub.add_parser("list", help="List active projects")

    pta = psub.add_parser("task-add", help="Add task to project")
    pta.add_argument("project_id", type=int)
    pta.add_argument("content")

    ptl = psub.add_parser("tasks", help="List tasks for project")
    ptl.add_argument("project_id", type=int)
    ptl.add_argument("--status", choices=["todo", "in-progress", "done"])

    ptu = psub.add_parser("task-update", help="Update task status")
    ptu.add_argument("task_id", type=int)
    ptu.add_argument("status", choices=["todo", "in-progress", "done"])

    # ── points ──
    xp = sub.add_parser("points", help="Points/miles balances")
    xsub = xp.add_subparsers(dest="points_action")

    xs = xsub.add_parser("set", help="Set balance")
    xs.add_argument("program")
    xs.add_argument("balance", type=int)

    xa = xsub.add_parser("add", help="Add to balance")
    xa.add_argument("program")
    xa.add_argument("amount", type=int)

    xsub.add_parser("list", help="Show all balances")

    # ── note ──
    np = sub.add_parser("note", help="Quick notes & references")
    nsub = np.add_subparsers(dest="note_action")

    na = nsub.add_parser("add", help="Save a note")
    na.add_argument("content")
    na.add_argument("--tags")

    nl = nsub.add_parser("list", help="Search/list notes")
    nl.add_argument("--search")
    nl.add_argument("--limit", type=int, default=10)

    nd = nsub.add_parser("delete", help="Delete a note")
    nd.add_argument("id", type=int)

    # ── briefing ──
    sub.add_parser("briefing", help="Daily dashboard overview")

    return p


def main():
    init_db()
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    dispatch = {
        "trip": cmd_trip,
        "spot": cmd_spot,
        "project": cmd_project,
        "points": cmd_points,
        "note": cmd_note,
        "briefing": cmd_briefing,
    }
    fn = dispatch.get(args.command)
    if fn:
        fn(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

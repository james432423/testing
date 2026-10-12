# HomeScreen

The owner's day as one sheet of notebook paper on a desk, with a pale green margin line. Open items are numbered in the margin, finished work is ticked, and days sit in the margin of the schedule.

- Shell: sidebar on the desk (`paper-sunk`) with the wordmark, nav and Today count; a top bar with a small "Tell Ida something" field; the sheet; a right rail. The shell is fixed; only the contents change each day.
- Sheet order: date, "N things need you" with a time estimate and the split (fixes and decisions) → problems as numbered one-line rows (naming what they block) → the decision card pile (see DecisionCard) → Worth a look → Done since yesterday → Coming up.
- Your work panel ends with a one-line workflow status ("Running · 6 workflows", "Paused · Showing scheduler, until the calendar is reconnected").
- On phone the wordmark appears in the top bar.
- One solid primary button per screen: the approve action of the expanded decision.
- The sidebar shows the wordmark only; the square app icon is for app stores, browser tabs and avatars (see Logo).
- Worth a look is an insight grounded in the owner's own data, on `paper-sunk`, with a small chart (only the latest bar in `brand`) and one action.
- Right rail: the Your work panel (Plate).
- Phone (below 760px): sidebar becomes a bottom tab bar; decisions stay first; a "9 of 14 tasks off your plate" link under the heading jumps to Your work below the sheet; primary buttons go full width; controls are at least 48px tall.
- The preview uses invented example data and is labeled as such.

## Trust signals on Home
- A decision raised by a rule exception says so in its context line ("The HOA isn't on this deal yet, so Ida asks first (your rule)").
- Done since yesterday links to the full sent log ("See all 12 messages Ida sent").
- Your work shows the decision trend ("6 decisions for you this week, down from 11"): fewer decisions over time is the value signal.
- Counts match the Tasks page (same task list, same "N of M").
- A highlighted fact must not say more than its source: "recommends repair", not "needs repair".

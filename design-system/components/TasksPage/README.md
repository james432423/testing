The Tasks screen: every task in the owner's week, split by who does it. The split is the point of the page: it should be obvious at a glance what Ida owns and what is still the owner's.

- Page head: title, one muted line, "Add a task" (secondary).
- `ida-platebar`: one row of squares (same three states as Plate) and "9 of 14 off your plate". This is the only summary on the page.
- `ida-board`: three columns, always in this order: **Ida does it** (solid square), **You approve** (40% square), **Still yours** (outline square). Each column head has its square, name and count over a 2px `ink` rule, then one muted line saying what the column means ("Runs on its own; you see every run", "Ida drafts, you tap Approve", "Ida could take 3 of these").
- `ida-board__item`: task name, then one `small` line of area and one fact ("Leads · Since Sep 2 · 63 replies"). No per-row owner label: the column says it.
- A paused or broken task stays in its column and says why in `ida-problem-text` ("Paused · calendar disconnected").
- In Still yours, tasks Ida could take sort first and get an `ida-handoff` text link ("Hand to Ida") in `brand`. No shaded boxes, no extra button styles, and no separate suggestions list.
- Under 900px the columns stack in the same order.
- No cards, no percentages.

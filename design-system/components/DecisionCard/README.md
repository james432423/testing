# DecisionCard

Open decisions as a card pile on the notebook sheet: the current decision is a full card, and the next one peeks out underneath as a tab. Chosen by the founder over the one-line list (`home-list` pattern); independent reviewers preferred the list, so keep the pile's weaknesses in check with the rules below.

**The card (`ida-pile__card`):**
1. Header: hand-circled number, the action and time ("Approve · 1 min"), and "Decision 1 of 2". Show a time only when Ida can back it from this owner's history.
2. Meta line: deal, client or listing. Then the question, phrased as what will happen.
3. The draft as the real message (`ida-letter` on `paper-well`). A `marker` swipe marks the fact Ida pulled from a source.
4. **The cited source, always shown in the card when there is one** (`ida-source ida-source--card`): document name, who and when, page, the exact passage with the matching words underlined in highlighter yellow, and a link that opens the document at that page. Separated from the draft by a hairline, no extra box.
5. Actions: one solid primary ("Approve and send"), "Edit first", quiet "Not now". "Not now" confirms on screen: "Moved to the end · Undo".
6. Fine print: "Nothing goes out until you approve, and you can undo for 10 seconds after."

**The tab (`ida-pile__tab`):** the next decision, labelled "Up next" with its action and time, its title and one detail line, its status chip, and a quick action right on the tab when that action is low-risk and takes seconds ("Ask the HOA"). The chevron opens it as the front card. No arrows, dots or required swipes.

**What stays out of the pile:** problems (a one-line row above the pile, numbered first, with the fix button) and anything blocked by a problem (named on the problem row: "Opens after you reconnect: …"). Blocked items return to the pile on their own once unblocked.

**Counts:** the heading, the Today badge and the pile agree ("3 things need you" = 1 fix + 2 decisions; "Decision 1 of 2").
- 1 decision: a plain card, no tab, no "1 of 1".
- 3 to 5 decisions: the card plus up to two tabs, then "+N more".
- More than 5: default to the list layout (one expanded item, the rest as one-line rows) and offer batch approval for similar low-risk items with Undo.

**Done:** approving sends the card away with "Sent to Jen and Tom Park · Undo" for 10 seconds and brings the tab forward.

Don't: nest more boxes inside the card, use the hand font for the question or buttons, or let the pile hide a problem.

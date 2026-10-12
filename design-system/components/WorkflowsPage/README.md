The Workflows screen: each thing Ida runs, what starts it, what Ida does, how much the owner trusts it and how it has gone.

- Each workflow is an `ida-wf` row: name, status chip (Running = `done`; Practicing = neutral; Paused = `problem` with the reason on the track-record line), then a two-column grid with labels "When" and "Ida" in `label` style.
- `ida-trust` shows the three trust steps as a bar: Practice (drafts, nothing sent), You approve, On its own. The current step is filled `brand`; later steps are outline. Moving a step up is a button the owner presses, never automatic; Ida may suggest it with the track record ("You approved 11 of 11").
- The "Ida" line is one plain sentence of what it does, in order. Details of each step open from the row, not on the list.
- Track record is a count, not a rate, plus the last run: "63 runs · 0 mistakes reached a client · Ran 9:05 am", "11 drafts · you approved 11, edited 2".
- Rail: "How trust works", one line per step, ending with: a workflow moves up only after a visible track record, and drops back if a mistake gets through.
- The word "workflow" is allowed as the nav label and page title only.
- **Rule exceptions** (`ida-wf__exc`): an "Except" line under the Ida line names the rule that still makes Ida ask, even at On its own ("Asks you first before contacting anyone not already on the deal · your rule"). This is how routine work runs by itself while unusual cases come to Home as a quick decision.
- **Promotion is suggested, never automatic** (`ida-nudge`, `brand-soft`): when the record earns it, Ida offers one step up with the record and the scope ("You approved 11 of 11 buyer summaries. Let it send those on its own · Repair requests still come to you."). A workflow can be promoted in part.
- Every On its own workflow links "See what it sent" from its last-run line.

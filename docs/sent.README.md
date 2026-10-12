# Sent by Ida (`sent.html`)

The log of every message Ida sent for the owner, on its own or after the owner approved it. It is where trust is checked after the fact: what went out, to whom, why, and from which document.

- One `ida-page` sheet in the standard shell (Workflows is current; "See what it sent" on a workflow lands here filtered to it). No cards.
- Filters: two plain selects, **Workflow** and **Deal**, plus a live tally ("12 sent · 9 on their own · 3 you approved"). No search, no date picker.
- Day groups, newest first: **Not sent yet** (scheduled, still stoppable) on top, then Today, Yesterday, then the weekday.
- Each row: time, recipient (bold), subject, then one muted line: workflow · deal · how it went out · the cited source. How it went out uses the Plate squares: solid = **On its own**, 40% = **You approved at 6:31 pm**. No chips for this; chip words stay reserved for task states.
- The row opens to the full message (`ida-letter`, To/Cc/Subject/Sent) with the cited fact in `marker`, and the source (`ida-source--card`) underneath with the exact passage and a link to the page.
- **Undo** appears only while it still works: a scheduled message, or a calendar invite. Delivered email shows its state ("Delivered · Kim replied") and the fine print says it can't be pulled back.
- **This was wrong** asks to confirm, names the level it drops to (On its own → You approve, You approve → Practice), offers optional reasons, and confirms with the trust bar and "Draft a correction to …" plus Undo.
- No primary button: nothing on this screen sends anything.

States: default, filtered, filtered to nothing (`note-lg` "nothing sent here yet" + "Show everything"), row open, undone (struck through, "Undone · it won't go out"), wrong-confirm, moved back.

Don't: show Undo on delivered email, use red for "This was wrong" (it isn't broken), or drop a workflow without saying which level it lands on.

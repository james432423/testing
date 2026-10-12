# Approve from your phone (`phone-approve.html`)

One decision handled on a phone, in three frames: the notification, the approve sheet it opens, and the sent state with undo. Frames sit side by side at desktop widths and stack (edge to edge, no bezel) on a phone.

**1 · Notification.** App line "Ida · now", then the question exactly as on Today ("Send the inspection summary to the Parks?"), one line naming the deal and what Ida did, and the fine print "Nothing goes out until you approve · about 1 min". Done notices are separate and quiet. No actions on the notification itself; tapping it opens the sheet.

**2 · Approve sheet.** A bottom sheet over Today: header ("Approve · 1 min · Decision 1 of 2") with a close button, meta line, the question, the draft as the real message with the cited fact in `marker`. The source is one tap away: the highlighted fact and the "Source: inspection report, page 4" line both open the passage in place, with a link to the page. Footer pinned in thumb reach: **Approve and send** (the only primary, full width), **Edit** and **Not now** side by side, and the fine print about the 10-second undo.

**3 · Sent.** Today shows the sent row in `done-soft` with a tick, the count drops ("2 things need you") and the next decision comes up. A toast in ink says who it went to, with **Undo · 8** and a bar draining over 10 seconds. After 10 seconds the toast leaves and the message is in Sent by Ida.

States: source collapsed / open; approved with live countdown (tap Approve in frame 2); undone ("Nothing reached the Parks"); Not now ("Moved to the end of today · Undo").

Don't: put Approve on the lock screen notification, hide the undo time, or use the hand font in any of these frames.

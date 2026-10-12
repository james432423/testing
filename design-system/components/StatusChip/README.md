# StatusChip

The state of one task or run, as a word in a small square-cornered label. The word carries the meaning; color repeats it for a quick scan.

| Class | Word | Meaning |
|---|---|---|
| `ida-chip--attention` | Needs you | Waiting on the owner's decision. `attention` on `attention-soft`. |
| `ida-chip--running` | Working on it | Ida is mid-task. `ink` on `paper-sunk`; kept neutral so it never reads as a warning. |
| `ida-chip--done` | Done | Finished and checked. `done` (the brand green) on `done-soft`. |
| `ida-chip--problem` | Problem | Blocked or failed; the card says why and what fixes it. `problem` on `problem-soft`. |
| `ida-chip` | Paused | Owner turned it off. |

Use the exact words above so owners learn them. One chip per card, top right.

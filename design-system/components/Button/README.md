# Button

Three weights for the three things an owner does with a decision: approve it, change it, or let it go.

- `ida-btn ida-btn--primary`: one per card, for the action that sends, books or files something. Label says exactly what happens ("Approve and send", "Book 2:30 pm"), never "OK" or "Submit".
- `ida-btn`: the safe alternative, usually "Edit first".
- `ida-btn ida-btn--quiet`: dismiss or defer ("Skip this one", "Remind me tomorrow").
- The hand-drawn tick icon goes only on the primary approve action.
- Consumer provides: a `<button type="button">` or `<a>`, the label, and the click handler. Focus uses `focus-ring`.

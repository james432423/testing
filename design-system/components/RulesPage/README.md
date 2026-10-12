The Your rules screen: plain-language rules Ida follows, and where each one came from.

- `ida-addrule`: one text field and an "Add rule" button. No syntax, no conditions builder. Before a rule takes effect, Ida shows how it understood it.
- Rules are grouped by `ida-rulegroup`: "Always ask me first", "Never", "How you write". Each `ida-rule` is the sentence, its source on one `small` muted line ("You added this · Sep 2", "Learned from your edit · Oct 4", "Learned from 3 of your edits", "Ida's default · always on"), an `ida-switch` toggle (on = `brand-fill`) and a quiet Edit button.
- `ida-learn` is the one place Ida proposes a rule: it quotes the edits it noticed and offers "Make it a rule" / "Not now". One suggestion at a time.
- Rules never disappear silently. Turning one off keeps it in the list, muted.

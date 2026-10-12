Ida runs the back-office work of a small business, starting with real estate agents, and asks the owner only for decisions. The identity should feel like a tidy desk and a capable assistant's handwriting: clean, calm and human, never like an AI product.

## Voice and content

- Write the way a good assistant talks to a busy owner: short, specific, plain. "The inspection is back. Send the summary to the Parks?"
- Name real things: the client, the address, the deadline, the source document. Never "your task" or "an item".
- Say what will happen on approve: "Approve and send", "Book 2:30 pm". Nothing goes out without the owner's tap, and the screen says so.
- Address the owner as "you". Ida speaks of itself in the third person in UI copy ("Ida drafted…"), never "I" and never "AI".
- Don't use the words AI, agent, model, prompt, automation or workflow engine in owner-facing copy. "Workflows" is fine as a nav label.
- No emoji, no exclamation marks, no hype. Sentence case everywhere except the `label` style.

## Color

Forest green on white, with warm oat neutrals. Five hues in total, each with one job.

- Ground: the sheet is `paper` (white); the desk behind it, the sidebar area and the insight panel are `paper-sunk` (oat); drafts inside the sheet are `paper-well`, a lighter oat so the highlighter stands out. Separate rows with `rule` hairlines and whitespace, not extra boxes.
- Text is `ink`; metadata is `ink-muted`. Both read on every paper surface in both themes.
- `brand` (forest green) is the only brand color. Fill the one primary button per screen and the Today count with `brand-fill` (label in `on-brand`); use `brand` for the wordmark tick, filled squares in Your work, finished-task ticks and the latest bar in a chart. Secondary links and buttons stay `ink`.
- In Ida, green means done: `done` is the same green as `brand`, and Done chips use `done-soft`.
- `marker` (yellow highlighter) appears only on a fact Ida pulled from a source. Tapping it opens the source.
- `problem` (wine red) is the only red, used for broken or blocked things, always with the word "Problem". `attention` (amber) marks a deadline risk, always with a word.
- `margin-rule` is a pale green notebook margin line. Decorative only.
- Circled numbers, headings and labels are `ink`, never brand.
- Input and secondary-button borders use `line-strong` (3:1). Keyboard focus is `focus-ring`.

## Type

- Set everything the owner reads or acts on in Schibsted Grotesk (`--font-sans`) using `display`, `title`, `heading`, `body`, `small` and `label`.
- Kalam (`--font-hand`) is an accent: the circled numbers in the sheet's margin, one source note per item naming where a fact came from (`note`, in `brand`, lowercase, no period, never an instruction) and the calm empty state (`note-lg`). Never use it for questions, amounts or times the owner acts on, buttons, chips, errors, drafts or anything legal.
- Use `font-variant-numeric: tabular-nums` where times and amounts line up.

## Layout, shape and depth

- 4px spacing base. Card padding `space-6`, gap between cards `space-4`, between sections `space-8`. Desktop gutter `space-12`, mobile gutter `space-4`.
- Corners: `radius-sm` for controls and panels inside the sheet, `radius-md` for the sheet and the Your work panel, 4px for chips.
- Two elevations: `shadow-lift` for the sheet, `shadow-paper` for small panels and the selected nav item. No gradients, no glows, no glass, no colored side borders.
- The home screen is a notebook sheet on a desk. Open decisions are the one place cards appear, as a pile (see DecisionCard): one lifted sheet (`shadow-lift`) with a `margin-rule` line, markers in the margin (circled numbers, ticks, days) and content to the right. Group with whitespace and hairlines; add a container only where something must stand apart (the draft letter, the Your work panel).
- One focal point per screen: the first open decision. Its approve button is the largest, most saturated control on the page.
- Blocking decisions always come first; the shell stays fixed while the contents change.
- Every other screen (Tasks, Workflows, Your rules, Connected apps) is one `ida-page` sheet with a 40px margin: page head, then groups separated by hairlines, then a rail of short explainers. No cards on these screens. Onboarding hides the sidebar, tab bar and ask field.

## Hand-drawn marks

- The tick, arrow and underline are SVG strokes 2.4 wide with round caps and joins, colored by `currentColor`. Copy the paths from the HandNote preview; don't draw new ones per screen.
- Ticks are `done` (green); arrows and hand notes are `brand`.
- Highlighter swipes only on cited facts; at most one hand note per item.

## Logo

Two marks. The wordmark is type: "ida" in Schibsted Grotesk Bold in `ink`, with the dot of the i drawn as a hand-drawn tick in `brand` (see Wordmark); use it in headers and the sidebar. The app icon is not decided yet (the tick-over-the-i icon in Logo was rejected); use the wordmark until a replacement is approved. Write the name as "Ida" in text.

## Fonts

Both faces load from Google Fonts: `https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap` (already imported by `components/bundle.css`).

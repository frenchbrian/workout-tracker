# Spreadsheet import: exercise mapping

Source: `Workout Plan 202306.xlsx`, dated Sessions from 2025-04-14 onward. Reviewed and agreed 2026-10-03.

## Load Type inference

Each Set's Load Type is inferred from the value in the Weight column:

- blank or 0 → **Body**
- 195–235 on the back exercises → **Bands** (combined lbs)
- small whole number (1–13) → **Machine** level, with or without a Position
- 25–80 lbs on pushups, Lunges and Calf Raises → **Weight Vest**
- pounds such as 12.5, 13.75, 15, 17.5, 25, 35, 37.5, 52.5 → **Free Weight**

Exceptions:

- **Situps:** the 26 is a 26 lb kettlebell held during the situp, so it's Free Weight 26.
- **Ab Rolls:** the 26 in the Weight column was entered by mistake. These are Body.
- **"PB" and "Bar w/Strap"** in the Weight column become Set notes, and the Set has no Load value.

## Chest n Back + Upper Body: chest exercises (two Forms)

Form is inferred per Set: Machine gives Press; Body or Weight Vest gives Pushup.

| Spreadsheet name(s) | Pushup Form | Press Form |
|---|---|---|
| Pushups, Pushups w/bar | Pushup | Bench Press |
| Military Pushup | Military Pushup | Military Press |
| Bench Press (Wide) | Wide Pushup | Bench Press (Wide) |
| Diamond Pushup | Diamond Pushup | Close-Grip Press |
| Decline Press | Decline Pushup | Decline Press |
| Incline Pushup | Incline Pushup | Incline Press |
| Side to Side Pushup | Side to Side Pushup | none (Body only) |
| Under the Rope Pushup | Under the Rope Pushup | none (Body only) |

## Chest n Back + Upper Body: back exercises (Bands)

| Spreadsheet name | Exercise |
|---|---|
| Wide Pull Up | Wide Pull Up |
| Reverse Grip Pull Down | Reverse Grip Pull Down |
| Narrow Pull Down | Narrow Pull Down |
| Seated Lat Row | Seated Lat Row |

## Shoulders n Arms + Upper Body

| Spreadsheet name | Exercise | Load Type(s) seen |
|---|---|---|
| Shoulder Press | Shoulder Press | Free Weight 30–35 |
| Lateral Shoulder Raise | Lateral Shoulder Raise | Free Weight 15–16.25; Machine 2 (2026-10-02) |
| Standing Biceps Curl | Standing Biceps Curl | Free Weight 22.5–25; Machine 3 (2026-10-02) |
| In and Out Curls | In and Out Curls | Free Weight 22.5–27.5 |
| Forearm Curl | Forearm Curl | Free Weight 30–37.5 |
| Reverse Forearm Curl | Reverse Forearm Curl | Free Weight 13.75 |
| Shoulder Shrug | Shoulder Shrug | Free Weight 52.5; Machine 9 (Dec 2025) |
| Shoulder Shrug w/bar | Shoulder Shrug (Bar) | Machine 7–13 + Position |
| Triceps Extension | Triceps Extension | Free Weight 17.5; Machine 6–8 from Dec 2025 |
| Overhead Triceps Extension | Overhead Triceps Extension | Machine 5–6 + Position |
| Triceps Pushdown | Triceps Pushdown | Machine 8 |

## Legs

| Spreadsheet name(s) | Exercise | Load Type(s) seen |
|---|---|---|
| Squat | Squat | Machine 3–7 + Position |
| Leg Extension | Leg Extension | Machine 5–8 |
| Leg Curl | Leg Curl | Machine 1–3 |
| Leg Pull Back | Leg Pull Back | Machine 1 |
| Intermnal Leg | Internal Leg | Machine 1 |
| External Leg | External Leg | Machine 1 |
| Lunges (Weight = "Warmup") | Lunges, Warmup entry | Body |
| Lunges, Lunge with Weight Vest | Lunges | Weight Vest 30–80 |
| Calf Raises | Calf Raises | Weight Vest 50–80 |
| Situps, Situp | Situps | Free Weight 26 (kettlebell) |
| Ab Rolls, abroller | Ab Roller | Body |
| Jumps | Jumps | Body |

## Kettlebell (all Free Weight, 40 s Duration)

| Spreadsheet name | Exercise | Side |
|---|---|---|
| Swing | Kettlebell Swing | |
| Squat | Kettlebell Squat (separate from the Legs machine Squat) | |
| Single Leg RDL L / R | Single Leg RDL | L / R |
| Shoulder Press L / R | Kettlebell Shoulder Press (separate from the dumbbell one) | L / R |
| Ballistic Rows L / R | Ballistic Row | L / R |
| Pushups | Pushup (Pushup Form) | |
| Curls | Kettlebell Curl | |
| Triceps Extension | Kettlebell Triceps Extension | |

## Session-level fixes

1. **Wrong years, fixed automatically:** Chest n Back "2026-11-02" becomes 2025-11-02. Shoulders n Arms 2026-09-26, 11-04 (×2), 11-18, 11-26, 12-09 and 12-23 become 2025, matching their position in the sheet. "Dec 2025" in the tables above already uses the corrected year.
2. **Chest n Back vs. Chest n Back (2):** identical through 2026-08-27. After that, "Chest n Back" has 08-30 and "(2)" has 09-16, 09-21 and 09-30. All four are imported. The empty 10-04 block is skipped.
3. **Chest n Back 2** has a 2026-07-06 session that conflicts with the one in "(2)". The "(2)" version is kept. Its 07-13, 07-17 and 07-21 sessions are imported.
4. **Two blocks on one date:** 2025-11-20's two blocks are near-identical, so only one is imported. 2025-12-21 and 2026-07-21 each have two blocks with different numbers, and both are imported as separate Sessions on that date.
5. Each block is imported as written, with every row its own list entry (repeats included). Rows without reps aren't imported. "Old Reps" isn't imported because the app works out Previous Reps itself. Text in the Notes/New Weight column becomes a Set note.

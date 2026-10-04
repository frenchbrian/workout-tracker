# Workout Tracker

Logs strength workouts set by set so each session can be compared against the last time the same workout was done.

## Language

### Plans

**Workout**:
A named, ordered list of exercises done together on one day, e.g. Chest n Back, Upper Body, Legs, Shoulders n Arms, Kettlebell. Repeats are written out in full (Chest n Back lists its 12 exercises twice), and any part of the list may be skipped on the day. Changes made during a Session apply to that Session only; the Workout itself changes only when edited directly.
_Avoid_: Routine, tab, program

**Exercise**:
A single named movement from the shared catalog, e.g. Seated Lat Row. The same Exercise can appear more than once in a Workout's list.
_Avoid_: Lift, move

**Form**:
One of two interchangeable versions of a chest Exercise: the Press form (Machine Load) or the Pushup form (Body or Weight Vest Load), e.g. Bench Press (Wide) / Wide Pushup. The Form is chosen per Exercise in each Session and defaults to the last one used.
_Avoid_: Variant, mode, version

**Side**:
Which limb (L or R) a one-sided Exercise is done with. A one-sided Exercise appears in the list once per Side, but it is still one Exercise.
_Avoid_: Splitting into "Exercise L" / "Exercise R"

**Warmup**:
An entry in a Workout's list marked as preparation. It is logged like any other entry but left out of progress tracking.
_Avoid_: Warm-up set as a Load value

**Duration**:
A fixed time limit for an Exercise, e.g. 40 seconds for the Kettlebell exercises. Only Exercises with a Duration are timed.
_Avoid_: Time, interval

### Logging

**Session**:
One dated performance of a Workout.
_Avoid_: Workout (when meaning a dated instance), day, log

**Set**:
One entry of a Workout's list done in a Session, recorded as Load and Reps. Skipped entries have no Set.
_Avoid_: Row, round

**Previous Reps**:
The Reps from the same list entry (it follows the entry if reordered) and same Form in the most recent Session of the same Workout in which that entry was done. It is the number to beat.
_Avoid_: Old Reps, last reps

**Next Load**:
A note made during a Set saying what Load to use next time. It applies to every later occurrence of that Exercise, including later in the same Session, and is cleared once used.
_Avoid_: New Weight, target

### Load

**Load**:
The resistance used for a Set: a Load Type plus a value.
_Avoid_: Weight (on its own)

**Load Type**:
The kind of resistance: Bands (combined pounds of the bands), Free Weight (pounds), Machine (level on the machine), Weight Vest (pounds worn on top of body weight), or Body (no added weight).
_Avoid_: Weight type, equipment

**Position**:
The setting a machine's parts are moved to for an Exercise, e.g. pin or seat position. Only Machine Loads have a Position.
_Avoid_: Setting, slot

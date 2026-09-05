# production-manager
visual dashboard and data entry of the production data
Now the important part — Getting Delayed vs Delayed

This is where I would make the logic very explicit.

There are three different concepts:

A. Expected completion

When should this process finish according to the planned process duration?

B. Projected completion

When will it actually finish if the current production rate continues?

C. Order due date

When does the whole order have to be finished?

These should not be mixed together.

5. Process Expected Days

Suppose an order requires:

Quantity = 100

and Frame has master capacity:

Frame = 25 units/day

Then:

Expected days
= 100 / 25
= 4 days

So if Frame starts on:

1 Sep

its expected completion is approximately:

4 Sep

depending on your date-counting convention.

6. Process Expected End

For every process:

Expected End
=
Process Start
+
Expected Process Duration

For a sequential order:

Frame
↓
Repressing
↓
Hot Press
↓
Rough Cutting
↓
Beat

the expected schedule becomes something like:

Frame
1 Sep → 4 Sep

Repressing
5 Sep → 6 Sep

Hot Press
7 Sep → 8 Sep

Rough Cutting
9 Sep → 10 Sep

Beat
11 Sep → 12 Sep

So we have a planned production schedule.

7. Then calculate Projected Completion

Now suppose Frame is expected to produce:

100 units

But after 2 days we have:

40 units completed

Actual rate:

40 / 2
= 20 units/day

Remaining:

100 - 40
= 60

Projected remaining duration:

60 / 20
= 3 days

Therefore:

Projected completion
= today + 3 days

This is much more useful than simply asking whether today's date has passed the expected end.

8. Getting Delayed

This should mean:

The process is currently still within its expected window, but based on the current production rate, it is projected to finish after its expected completion date.

Example:

Expected End:       10 Sep
Today:               7 Sep

Progress:           60 / 100
Actual rate:        15/day
Remaining:          40
Projected finish:   10 Sep

Then:

Projected finish <= Expected End
→ ON TRACK

But:

Expected End:       10 Sep
Today:               7 Sep

Projected finish:   13 Sep

Then:

Projected finish > Expected End
AND
today <= Expected End

→ GETTING DELAYED

Meaning:

"Not late yet, but at the current rate we are going to miss the planned process completion."

That's the early warning.

9. Delayed

Now suppose:

Expected End: 10 Sep
Today:        12 Sep
Completed:    70/100

The process was supposed to finish by the 10th but hasn't.

Therefore:

Today > Expected End
AND remaining > 0
→ DELAYED

This is actual lateness.

So the simplest distinction is:

Condition	Status
Projected finish ≤ Expected End	On Track
Projected finish > Expected End, but Expected End hasn't passed	Getting Delayed
Today > Expected End and process incomplete	Delayed
Required quantity completed	Completed
10. But we also have the Order Due Date

This is the part I think we should add/strengthen.

A process can individually look okay but the overall order can still miss its due date.

Example:

Order Due Date = 15 Sep

Frame
Expected: 1–3 Sep
Projected: 3 Sep       ✓

Repressing
Expected: 4–6 Sep
Projected: 7 Sep       ⚠

Hot Press
Expected: 7–9 Sep
Projected: 10 Sep      ⚠

Beat
Expected: 10–12 Sep
Projected: 14 Sep      ✓

Final projected completion = 14 Sep
Order due = 15 Sep

Order is still okay.

But if Beat projects to:

18 Sep

then:

Projected order completion = 18 Sep
Order due date             = 15 Sep

Therefore:

Order = Getting Delayed / At Risk

even if today is only:

10 Sep

because we're not late yet, but we're projected to miss the customer's due date.

11. Order-level Delayed

Then:

Today > Order Due Date
AND
Order remaining quantity > 0

means:

DELAYED

Example:

Due date:        15 Sep
Today:           17 Sep
Completed:       80/100
Remaining:       20

→ Delayed

12. Recommended complete logic

I'd make the system work in this hierarchy.

Process level
IF process completed
    → COMPLETED

ELSE IF today > process expected end
    → DELAYED

ELSE IF projected process completion > process expected end
    → GETTING DELAYED

ELSE
    → ON TRACK
Order level

Calculate:

Projected Order Completion
=
projected completion of the final applicable process

Then:

IF all processes complete
    → COMPLETED

ELSE IF today > order due date
    → DELAYED

ELSE IF projected order completion > order due date
    → AT RISK / GETTING DELAYED

ELSE IF any process is GETTING DELAYED
    → AT RISK

ELSE
    → IN PRODUCTION

And:

No production started
→ NOT STARTED
13. One more important improvement: due date should influence the process schedule

This is the part I'd add, because otherwise you're only comparing processes against their own expected dates.

For an order:

Order Due Date = 20 Sep

Frame       3 days
Repressing  2 days
Hot Press   2 days
Rough Cut   2 days
Beat        1 day

Total planned process duration:

3 + 2 + 2 + 2 + 1 = 10 days

Therefore the order needs roughly 10 production days.

The system should know the expected schedule and ultimately verify:

Expected final completion <= Order Due Date

If:

Expected final completion = 18 Sep
Due date = 20 Sep

→ healthy buffer.

If:

Expected final completion = 20 Sep
Due date = 20 Sep

→ no buffer.

If:

Expected final completion = 23 Sep
Due date = 20 Sep

→ already scheduled to miss the customer commitment, even before production actually becomes late.

That's a very valuable Control Tower signal.

So the dashboard should ultimately tell 3 different stories
🟢 On Track

"At the current production rate, we'll finish within the planned process/order deadline."

🟡 Getting Delayed / At Risk

"We haven't missed the deadline yet, but current production performance projects that we will."

🔴 Delayed

"The deadline has already passed and the required quantity isn't complete."

That distinction is much more meaningful for a production manager than simply comparing today's date with the expected end.

And yes — if your current implementation only checks the expected end date / due date and doesn't properly calculate projected completion from the actual production rate, I'd add this logic. That's what turns the dashboard from a reporting screen into an actual early-warning control tower.
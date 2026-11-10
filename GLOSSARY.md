# Course Platform

A course marketplace where learners buy courses, alone or through a team's licence, and can ask for their money back.

## Language

### Refunds

**Refund**:
A learner asking to get their money back for a Purchase. Its status is Requested, Approved or Declined.
_Avoid_: Chargeback, Reversal, Cancellation

**Refund Request**:
A Refund that is still Requested, waiting for an admin to Resolve it.

**Resolve**:
An admin deciding a Refund Request, by either **Approve** or **Decline**.

**Approved**:
The Refund Amount is paid back and the learner loses access to the course. Their Progress is kept.

**Declined**:
Nothing is paid back and the learner keeps access.

**Refund Eligibility**:
The rules a Purchase must meet before a Refund can be requested: inside the Refund Window, under the watch-time limit and under the completion limit. A claimed Seat is never eligible.

**Refund Window**:
The 14 days after a Purchase during which a Refund can be requested.

**Refund Amount**:
The amount the learner paid, given back on an Approved Refund. Stored as `amountRefunded`.

### Learning

**Progress**:
A learner's learning record in a course: lesson completions, course completion, watch history and quiz attempts. Comments and ratings are not Progress.

### Team seats

**Seat**:
One place in a team's licence for a course. Stored as a row in `coupons`.

**Claim**:
A learner taking a Seat. Stored as `redeemedAt` being set.

**Cancel**:
Giving a claimed Seat back to the team's pool. No money moves; Cancel applies to a Seat, Refund applies to a Purchase.

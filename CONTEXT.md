# Context

The shared vocabulary for this codebase. Use these terms in code, UI copy, emails, issues and conversation. When a term here and a word in the code disagree, the term here wins and the code is due for a rename.

## Refunds

**Refund**
A learner asks to get their money back for a Purchase. A Refund has one of three statuses: Requested, Approved or Declined. The learner "requests a refund"; there is no separate "Refund Request" object.
_Avoid:_ Chargeback, Reversal, Cancellation, Refund Request.

**Resolve**
An admin decides a Requested Refund. There are two outcomes: **Approve** or **Decline**.

**Approved**
The Refund Amount is paid back and the learner loses access to the course.

**Declined**
Nothing is paid back. The learner keeps access.

**Refund Eligibility**
The rules a Purchase must meet before a Refund can be requested: inside the Refund Window, under the watch-time limit, and under the completion limit. A claimed Seat is never eligible.

**Refund Window**
14 days from the Purchase.

**Refund Amount**
What the learner gets back: the amount they paid. Stored as `amountRefunded` once the Refund is Approved; empty before that.

## Team seats

**Seat**
One place in a team's licence for a course. Stored as a row in `coupons`.

**Claim**
A learner takes a Seat. Stored as `redeemedAt` being set.

**Cancel**
Give a claimed Seat back to the team's pool. No money moves. Cancel applies to a Seat; Refund applies to a Purchase.

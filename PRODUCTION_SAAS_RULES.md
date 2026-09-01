# Production Management SaaS --- Non-Negotiable Rules

This document contains the business, architecture, data, security, and
implementation rules for the Production Management SaaS.

These rules take precedence over assumptions made by the AI app builder.

Do not silently change these rules.

------------------------------------------------------------------------

# 1. Product Definition

The application is a multi-tenant production management SaaS.

Its primary purpose is to:

1.  Record production orders/projects.
2.  Define plant/product production processes.
3.  Record incremental daily production.
4.  Calculate current production status.
5.  Calculate expected completion and delay status.
6.  Provide management dashboards.

The source of truth is the production transaction history.

------------------------------------------------------------------------

# 2. Multi-Tenancy Is Mandatory

The system must support multiple companies/organizations.

Every tenant-owned record must be associated with an
Organization/Tenant.

A user from Organization A must never be able to access:

-   orders
-   production entries
-   clients
-   plants
-   products
-   processes
-   dashboard metrics
-   audit logs

belonging to Organization B.

Tenant isolation must be enforced server-side.

Frontend filtering is NOT a security mechanism.

Never trust organization IDs supplied by the browser.

Always derive the organization context from authenticated server-side
identity.

------------------------------------------------------------------------

# 3. One Organization Can Have Multiple Plants

Plant belongs to Organization.

User does NOT own a plant.

Relationship:

Organization → Plants

User → UserPlantAccess → Plants

One user can have access to multiple plants.

A user may switch plants from the UI.

The active plant selection must be checked server-side.

------------------------------------------------------------------------

# 4. Plant Access

A user can only view or modify data for plants they are authorized to
access.

Organization-level users may have an All Plants view.

All Plants is a reporting/filtering scope, not a replacement for actual
plant relationships.

Never allow a user to submit an unauthorized plant ID and gain access
through an API.

------------------------------------------------------------------------

# 5. Production Start Date

Production Start Date is OPTIONAL.

Most customers may start production immediately, so the field should not
be mandatory.

If a Production Start Date is supplied:

`Effective Start Date = supplied Production Start Date`

If no Production Start Date is supplied:

`Effective Start Date = Order Date`

The system must use Effective Start Date for not-started/start-delay
calculations.

------------------------------------------------------------------------

# 6. Future Production Start

If an order has a future Effective Start Date, it must NOT be considered
delayed before that date.

Example:

Order Date = 30 Aug Production Start = 5 Sep

The order is not delayed on:

30 Aug 31 Aug 1 Sep 2 Sep 3 Sep 4 Sep

The start-delay clock begins according to the Effective Start Date.

------------------------------------------------------------------------

# 7. Start Delay Defaults

Default organization-level thresholds:

-   0--2 elapsed days: normal not-started state

-   2 days: warning/attention

-   5 days: critical/delayed start

These thresholds must be configurable.

Do not hard-code the thresholds in multiple UI components or API routes.

Keep them in organization settings and/or a dedicated business-logic
service.

------------------------------------------------------------------------

# 8. Due Date

Due date must support two input methods:

### Fixed Date

User directly selects the due date.

### Days From Order Date

User enters a number of days.

The system calculates:

`Due Date = Order Date + Due Days`

The system should preserve the input method.

Recommended data:

-   dueDateType
-   dueDate
-   dueDays

Do not require the user to manually calculate a date when they choose
the days-based method.

------------------------------------------------------------------------

# 9. Production Entry Is Incremental

This is one of the most important rules.

Every ProductionEntry quantity represents:

> additional quantity completed on that date.

It is NOT the cumulative quantity.

Example:

30 Aug: Cutting = 200

31 Aug: Cutting = 300

Cumulative Cutting:

`200 + 300 = 500`

Never interpret the second entry as "total Cutting is now 300."

------------------------------------------------------------------------

# 10. Production History Is the Source of Truth

ProductionEntry records are authoritative.

Do not manually store user-editable values for:

-   current stage
-   completion percentage
-   pending quantity
-   expected completion
-   delay status

These values must be derived from production transactions and order
configuration.

Derived values may be cached or materialized later, but the raw
transaction history remains authoritative.

------------------------------------------------------------------------

# 11. Production Processes Are Configurable

Never hard-code:

-   Cutting
-   Framing
-   Assembly
-   Glass
-   Finishing

or any other process into application logic.

Processes are master data.

Different plants/products may have different process sequences.

------------------------------------------------------------------------

# 12. Plant/Product Process Mapping

Production flow is determined by:

Organization + Plant + Product + Process + Sequence

Example:

Plant A + Door:

1.  Cutting
2.  Framing
3.  Assembly
4.  Glass
5.  Finishing

Plant B + Door may have a different sequence.

Do not assume all plants manufacture products the same way.

------------------------------------------------------------------------

# 13. Order Process Snapshot

When a production order is created, copy the applicable process mapping
into an order-specific snapshot.

Historical orders must not change because a master process mapping is
edited later.

Example:

Order created in August with:

1.  Cutting
2.  Framing
3.  Assembly

If the master changes in September to:

1.  Cutting
2.  CNC
3.  Framing
4.  Assembly

the August order must retain its original process snapshot unless an
explicit migration/edit workflow is later introduced.

------------------------------------------------------------------------

# 14. Process Sequence

For standard sequential production:

Cumulative quantity at Stage N must not exceed cumulative quantity at
Stage N-1.

Example:

Cutting = 100 Framing = 200

is invalid.

Example:

Cutting = 500 Framing = 150 Assembly = 50

is valid.

The server must validate this.

------------------------------------------------------------------------

# 15. Production Quantity Validation

Reject:

-   zero quantity
-   negative quantity
-   invalid stage
-   invalid order
-   inactive/cancelled order where production is not allowed
-   unauthorized organization
-   unauthorized plant
-   invalid process for the order
-   downstream quantity exceeding upstream quantity
-   inappropriate quantity exceeding order requirements

Do not depend on frontend validation.

------------------------------------------------------------------------

# 16. Current Stage

Current Stage must be calculated from:

-   order process sequence
-   planned quantity
-   cumulative stage production

Do not determine Current Stage simply from:

-   latest entry
-   latest date
-   latest selected form value

Example:

500 total:

Cutting = 500 Framing = 150 Assembly = 0

Current Stage = Framing.

------------------------------------------------------------------------

# 17. Overall Progress

Overall order progress is a derived metric.

Do not automatically calculate it as an average of all stage percentages
unless that method is explicitly validated for the business.

Keep the formula isolated and documented so it can be changed without
redesigning the database.

------------------------------------------------------------------------

# 18. Order Status

The system should support at least:

-   NOT_STARTED
-   IN_PRODUCTION
-   COMPLETED
-   CANCELLED
-   ON_HOLD

Production timing status separately supports:

-   ON_TIME
-   GETTING_DELAYED
-   DELAYED

Do not collapse these concepts into one uncontrolled status field.

------------------------------------------------------------------------

# 19. Start Delay vs Production Delay

These are different conditions.

### Start Delay

No production has started relative to Effective Start Date.

### Production Delay

Production has started but the production trend indicates risk of
missing the Due Date, or the Due Date has already passed.

Do not label an order "production delayed" simply because it has not
started if its planned start date has not arrived.

------------------------------------------------------------------------

# 20. Production Timing

Expected completion must use production information such as:

-   completed quantity
-   remaining quantity
-   historical production rate
-   current date
-   due date

Keep timing calculations in a dedicated service.

Do not duplicate formulas across dashboard cards.

------------------------------------------------------------------------

# 21. "Getting Delayed"

Getting Delayed must be calculated.

It must NOT be a manually selected value in the production entry form.

The threshold between:

ON_TIME and GETTING_DELAYED

must be clearly documented and configurable where practical.

------------------------------------------------------------------------

# 22. "Delayed"

An order should be considered Delayed when it has passed the relevant
due date and remains incomplete, subject to the finalized business rule.

Do not mark an order delayed merely because production is slow before
the due date.

------------------------------------------------------------------------

# 23. Special Activities

Special activities are separate from the normal main process unless
explicitly mapped into the main process.

Examples:

-   Glass Mating
-   Separate Framing
-   Special Polish
-   Rework
-   Custom Processing

Do not automatically insert every special activity into the normal
five-stage production sequence.

Use a dedicated SpecialActivity model and activity-entry model.

------------------------------------------------------------------------

# 24. Rework

Rework must not corrupt the original production history.

If rework is recorded, preserve:

-   original production
-   rework quantity
-   date
-   activity
-   user
-   order
-   relevant stage

Do not silently subtract historical production entries to represent
rework.

If the exact rework accounting formula is not yet finalized, implement
the data model so the rule can be added later.

------------------------------------------------------------------------

# 25. Audit Trail

Important production changes must be traceable.

Track:

-   user
-   timestamp
-   action
-   entity
-   previous value
-   new value
-   reason where applicable

Do not silently overwrite critical production history.

------------------------------------------------------------------------

# 26. Security

Never trust the following values from the client:

-   organizationId
-   userId
-   plantId
-   role
-   permissions

Derive sensitive authorization context server-side.

Every protected mutation must verify:

1.  authenticated user
2.  organization membership
3.  role permission
4.  plant permission
5.  record ownership/tenant relationship

------------------------------------------------------------------------

# 27. Database

Use PostgreSQL.

Use Prisma ORM.

Do not switch to MongoDB or another database simply because data is
expected to grow.

The application is relational and PostgreSQL is the intended database.

Use:

-   foreign keys
-   unique constraints
-   appropriate indexes
-   composite indexes
-   tenant-scoped indexes
-   date indexes
-   production-entry query indexes

------------------------------------------------------------------------

# 28. Long-Term Data

The system must be designed for users who retain data for 5+ years.

Do not assume old production data should automatically be deleted.

Historical data must remain queryable.

Performance should be maintained through:

-   indexes
-   database aggregation
-   pagination
-   selective queries
-   date filtering
-   summary tables where needed
-   caching where justified

------------------------------------------------------------------------

# 29. Dashboard Data Loading

Never load all historical production entries into the browser.

Bad:

`Download 5 years of ProductionEntry → calculate everything in browser`

Good:

`Dashboard filter → server query → database aggregation → return required result`

The browser should receive only the data required for the current view.

------------------------------------------------------------------------

# 30. Caching

Caching is allowed and encouraged when useful, but PostgreSQL remains
the source of truth.

Potential architecture:

ProductionEntry → aggregation → summary → cache → dashboard

Do not introduce Redis or complicated cache invalidation before the core
transaction model is correct.

If a cache is introduced, define invalidation/update behavior
explicitly.

------------------------------------------------------------------------

# 31. Images

For the separate showroom/product website:

Do not store large image binaries inside PostgreSQL unless there is a
specific reason.

Prefer:

PostgreSQL: - product data - metadata - image URLs/references

Object/image storage: - actual image files

The infrastructure should support hosting this second application
alongside the production SaaS.

------------------------------------------------------------------------

# 32. Hosting Portability

The application must not depend on Hostinger-specific APIs or behavior.

It must be deployable to:

-   Hostinger VPS
-   AWS
-   other Linux VPS/cloud environments

Use:

-   Docker
-   PostgreSQL
-   environment variables
-   standard Node.js runtime
-   standard reverse proxy configuration

The application should be portable without major code changes.

------------------------------------------------------------------------

# 33. Business Logic Location

Do not put important business rules inside:

-   React components
-   page files
-   form event handlers
-   duplicated API routes

Use reusable services/modules for:

-   production validation
-   cumulative production
-   current stage
-   progress
-   expected completion
-   start-delay calculation
-   production-delay calculation
-   dashboard aggregation

------------------------------------------------------------------------

# 34. UI Is Not the Source of Truth

The UI should display calculated state.

Never make the user manually enter:

-   Current Stage
-   Completion %
-   Pending Quantity
-   Expected Completion
-   Delay Status

unless a future explicitly defined business workflow requires it.

------------------------------------------------------------------------

# 35. Master Changes Must Be Safe

Editing a master must not unexpectedly corrupt historical orders.

Especially:

-   process mapping
-   process sequence
-   product
-   plant
-   client

Use snapshots or historical references where necessary.

------------------------------------------------------------------------

# 36. Multi-Plant Dashboard

Users with access to multiple plants can switch plants.

Authorized management users may view:

`All Plants`

Dashboard aggregations must correctly respect:

-   selected plant
-   user's permitted plants
-   organization boundary

------------------------------------------------------------------------

# 37. Dashboard Requirements

The dashboard must contain:

## Live Tracking

-   On Time
-   Getting Delayed
-   Delayed
-   Not Started / Start Warning / Start Delayed where applicable

## Weekly Production Graph

Production quantity by day.

## Pending Orders --- Client Wise

Pending quantity and order counts grouped by client.

## Monthly Production --- Client Wise

Production grouped by client and month.

------------------------------------------------------------------------

# 38. Required Dashboard Filters

Where relevant, support:

-   Plant
-   Client
-   Product
-   Project/Order
-   Stage
-   Date range
-   Status

Never show data outside the user's organization or plant permissions.

------------------------------------------------------------------------

# 39. Example That Must Work

Order:

Client A Project ABC-001 Product Door Quantity 500

Processes:

1.  Cutting
2.  Framing
3.  Assembly
4.  Glass
5.  Finishing

Entries:

30 Aug: Cutting = 200

31 Aug: Cutting = 300 Framing = 150

Expected calculated state:

Cutting = 500 / 500 Framing = 150 / 500 Assembly = 0 / 500 Glass = 0 /
500 Finishing = 0 / 500

Current Stage:

Framing

The raw entries remain:

30 Aug \| Cutting \| 200 31 Aug \| Cutting \| 300 31 Aug \| Framing \|
150

------------------------------------------------------------------------

# 40. Do Not Over-Engineer the MVP

Do not introduce:

-   microservices
-   Kubernetes
-   distributed databases
-   event streaming
-   complicated infrastructure

unless a real requirement appears.

A modular monolithic Next.js application with PostgreSQL is the
preferred starting architecture.

It should be designed so components can later be separated if scale
requires it.

------------------------------------------------------------------------

# 41. Do Not Under-Engineer Security

Even though this is an MVP:

-   tenant isolation is not optional
-   server-side authorization is not optional
-   plant access control is not optional
-   auditability of production changes is not optional
-   database constraints/validation are not optional

------------------------------------------------------------------------

# 42. Coding Quality

Use:

-   TypeScript types
-   reusable components
-   reusable services
-   schema validation
-   meaningful error messages
-   database transactions where required
-   clean naming
-   migrations
-   automated tests

Avoid:

-   giant components
-   duplicated calculations
-   magic numbers
-   hard-coded production stages
-   hard-coded tenant IDs
-   hard-coded plant IDs
-   client-only authorization

------------------------------------------------------------------------

# 43. AI Builder Behavior

The AI builder must:

1.  Read both markdown files before implementation.
2.  Treat `PRODUCTION_SAAS_RULES.md` as non-negotiable rules.
3.  Treat `PRODUCTION_SAAS_BUILD_PLAN.md` as the implementation
    sequence.
4.  Work phase-by-phase.
5.  Explain what it changed after each phase.
6.  Show important schema decisions.
7.  Run/build/test after meaningful changes.
8.  Fix errors before moving forward.
9.  Avoid replacing existing working code unnecessarily.
10. Ask only when a genuine business ambiguity blocks implementation.
11. Never silently simplify the requirements.
12. Never remove multi-tenancy, plant access, incremental production,
    process snapshots, or server-side authorization.

------------------------------------------------------------------------

# 44. Definition of Done

A feature is not complete merely because the page renders.

A feature is complete only when:

-   UI works
-   server-side logic works
-   authorization works
-   database behavior works
-   validation works
-   relevant tests pass
-   errors are handled
-   the feature respects organization and plant boundaries

The final application must behave like a real production management
system, not a static prototype.

# Production Management SaaS --- Step-by-Step Build Plan

## Purpose

Build a production management SaaS for manufacturing companies.

The product manages: - Organizations/companies - Multiple production
plants per organization - Users and plant-level access - Clients -
Products - Production processes/stages - Plant/product process
mappings - Special/auxiliary production activities - Production
orders/projects - Incremental daily production entries - Production
calculations - Production dashboards

The application must be built in phases. Do not jump directly to the
complete dashboard or generate the entire application in one
uncontrolled step.

------------------------------------------------------------------------

# Phase 0 --- Confirm the Architecture Before Coding

Before writing substantial code:

1.  Read this file completely.
2.  Read `PRODUCTION_SAAS_RULES.md` completely.
3.  Produce a short implementation plan based on both files.
4.  Identify any genuine ambiguity that prevents correct implementation.
5.  Do not invent business rules where these files already define them.
6.  Do not replace PostgreSQL with another database.
7.  Do not remove multi-tenancy or plant-level access control.
8.  Start implementation only after the schema and architecture are
    internally consistent.

Preferred stack:

-   Next.js App Router
-   TypeScript
-   PostgreSQL
-   Prisma ORM
-   Secure authentication
-   Server-side authorization
-   Responsive web UI
-   Docker-compatible deployment
-   Environment variables for secrets

The application must remain portable between a VPS such as Hostinger and
future cloud infrastructure such as AWS.

------------------------------------------------------------------------

# Phase 1 --- Project Foundation

Create the base application.

## 1.1 Application

Set up:

-   Next.js
-   TypeScript
-   App Router
-   UI/component system
-   Form handling
-   Server-side validation
-   Error handling
-   Logging
-   Environment configuration

Keep business logic outside UI components.

## 1.2 Database

Set up:

-   PostgreSQL
-   Prisma
-   migrations
-   seed structure
-   development database configuration

## 1.3 Authentication

Implement secure authentication.

Create:

-   User
-   Organization
-   Role

The authentication system must establish the current user's organization
and permissions server-side.

## 1.4 Multi-Tenancy

Implement organization isolation before building business features.

Every tenant-owned record must belong to an organization.

Never rely only on frontend filters for tenant isolation.

## 1.5 Roles

Initial roles:

-   SUPER_ADMIN
-   ORGANIZATION_ADMIN
-   PRODUCTION_MANAGER
-   PRODUCTION_OPERATOR
-   VIEWER

Implement server-side role checks.

------------------------------------------------------------------------

# Phase 2 --- Organization and Plant Management

Build the organization structure.

## 2.1 Organization

Create:

-   Organization name
-   Organization settings
-   Default configuration values

## 2.2 Plant Master

Create CRUD for:

-   Plant name
-   Location
-   Active/inactive

One organization may have multiple plants.

Example:

Organization A: - Mumbai Plant - Pune Plant - Ahmedabad Plant

## 2.3 User Plant Access

Create a many-to-many relationship:

User ↔ Plant

A user may have access to:

-   one plant
-   several plants
-   all plants, depending on role/permission

Do not model Plant as belonging directly to only one User.

## 2.4 Plant Switching

After login, users with access to multiple plants must be able to switch
the active plant from the UI.

Example:

`Current Plant: Mumbai ▼`

Options:

-   Mumbai
-   Pune
-   Ahmedabad

The selected plant must affect server-side data queries.

An organization-level user may have an `All Plants` view.

------------------------------------------------------------------------

# Phase 3 --- Master Data

Build the following masters.

## 3.1 Client Master

Fields:

-   Client ID
-   Organization ID
-   Client name
-   Contact information
-   Active/inactive
-   timestamps

## 3.2 Product Master

Fields:

-   Product ID
-   Organization ID
-   Product name
-   Product code
-   Active/inactive
-   timestamps

Examples:

-   Door
-   Window
-   Cabinet

## 3.3 Process/Stage Master

Create reusable production stages.

Fields:

-   Process ID
-   Organization ID
-   Process name
-   Process code
-   Description
-   Active/inactive
-   timestamps

Example:

1.  Cutting
2.  Framing
3.  Assembly
4.  Glass
5.  Finishing

Do not hard-code these stages into the application.

## 3.4 Plant/Product Process Mapping

Create a configurable mapping between:

-   Organization
-   Plant
-   Product
-   Process
-   Sequence

Example:

Plant A + Door:

1.  Cutting
2.  Framing
3.  Assembly
4.  Glass
5.  Finishing

Plant B + Door:

1.  Cutting
2.  CNC
3.  Framing
4.  Assembly
5.  Finishing

The sequence defines the normal production flow.

## 3.5 Special Activity Master

Create a separate master for auxiliary activities.

Examples:

-   Glass Mating
-   Separate Framing
-   Special Polish
-   Rework
-   Custom Processing

Include:

-   Activity name
-   Activity code
-   Activity type
-   Active/inactive

Initial activity types:

-   SPECIAL_PROCESS
-   REWORK
-   OTHER

------------------------------------------------------------------------

# Phase 4 --- Production Order / Project

Build the first major data-entry form.

## 4.1 Order Form

Fields:

-   Client
-   Project/Order Number
-   Plant
-   Product
-   Quantity
-   Order Date
-   Production Start Date
-   Due Date
-   Priority
-   Remarks

Required:

-   Client
-   Project/Order Number
-   Plant
-   Product
-   Quantity
-   Order Date
-   Due Date

Production Start Date is optional.

## 4.2 Production Start Date

Support:

-   Specific date
-   Number of days from order date
-   No explicit start date / start immediately

If no production start date is provided:

`Production Start Date = Order Date`

If a start date is provided, use it for start-delay calculations.

## 4.3 Due Date

Support:

-   Specific due date
-   Number of days from order date

Store enough information to preserve how the date was entered.

Recommended fields:

-   dueDateType
-   dueDate
-   dueDays

Similarly preserve the start-date input method where appropriate.

## 4.4 Create Order Process Snapshot

When an order is created:

1.  Find the active Plant + Product process mapping.
2.  Copy the applicable stages into order-specific process records.
3.  Preserve their sequence.
4.  Store planned quantity for each stage.
5.  Do not rely on the master mapping for historical orders after
    creation.

Example:

Order:

500 Doors

Snapshot:

1.  Cutting --- 500
2.  Framing --- 500
3.  Assembly --- 500
4.  Glass --- 500
5.  Finishing --- 500

If the master mapping changes next month, this existing order must not
silently change.

------------------------------------------------------------------------

# Phase 5 --- Daily Production Entry

Build the second major data-entry form.

## 5.1 Production Entry

Fields:

-   Date
-   Plant
-   Production Order
-   Stage
-   Quantity Completed
-   Remarks

The entry represents incremental production completed on that date.

Example:

30 Aug: - ABC-001 - Cutting - 200

31 Aug: - ABC-001 - Cutting - 300

31 Aug: - ABC-001 - Framing - 150

## 5.2 Incremental Data Rule

Never interpret the entered quantity as the cumulative total.

The entered value means:

`additional quantity completed on that date`

Cumulative values are calculated from production history.

## 5.3 Server-Side Validation

Validate:

-   quantity \> 0
-   valid organization
-   valid plant access
-   valid production order
-   active order
-   valid stage for that order
-   quantity does not exceed appropriate limits
-   downstream cumulative production cannot exceed upstream cumulative
    production for standard sequential production

Example invalid state:

Cutting = 100 Framing = 200

Reject the entry.

------------------------------------------------------------------------

# Phase 6 --- Production Calculation Engine

Create a dedicated service layer.

Do not duplicate calculations in pages/components.

The calculation engine must calculate:

-   Daily production
-   Cumulative stage production
-   Stage completion percentage
-   Remaining quantity
-   Current stage
-   Overall order progress
-   Production rate
-   Estimated completion date
-   Start status
-   Production status

## 6.1 Cumulative Production

For each order/stage:

`Cumulative = SUM(all incremental entries for that order/stage)`

## 6.2 Current Stage

Determine current stage using the order's process sequence and
cumulative production.

Example:

Cutting = 500/500 Framing = 150/500 Assembly = 0/500 Glass = 0/500
Finishing = 0/500

Current Stage = Framing

Do not simply use the latest transaction.

## 6.3 Overall Progress

Implement a documented calculation method.

Do not automatically average stage percentages unless the business logic
justifies it.

Keep this calculation isolated so it can be changed later.

------------------------------------------------------------------------

# Phase 7 --- Not Started / Start Delay Logic

An order can exist before production actually begins.

Order lifecycle should support:

-   NOT_STARTED
-   IN_PRODUCTION
-   COMPLETED
-   CANCELLED
-   ON_HOLD

Start-delay calculation:

If Production Start Date was provided: - use that date

If Production Start Date was not provided: - use Order Date

Default thresholds:

-   0--2 elapsed days: normal not-started state

-   2 elapsed days: warning / attention

-   5 elapsed days: critical / delayed start

The exact thresholds must be configurable per organization.

Important:

If a future Production Start Date exists, do not flag the order before
that date.

Example:

Order Date = 30 Aug Production Start Date = 5 Sep

Do not treat 30 Aug--4 Sep as delayed.

------------------------------------------------------------------------

# Phase 8 --- Production Delay Logic

Create a separate service for production timing.

Required statuses:

-   ON_TIME
-   GETTING_DELAYED
-   DELAYED

The status should be calculated, not manually entered.

Use:

-   due date
-   current date
-   completed quantity
-   remaining quantity
-   historical production rate
-   estimated remaining production time
-   estimated completion date

The threshold between `ON_TIME` and `GETTING_DELAYED` must be
configurable/documented.

Do not mix "not started" delay with normal production delay.

------------------------------------------------------------------------

# Phase 9 --- Dashboard

Build the dashboard only after the underlying calculations are tested.

## 9.1 Global Filters

Support:

-   Plant
-   Client
-   Product
-   Project/Order
-   Date range
-   Status

Users must only see data belonging to their organization and permitted
plants.

## 9.2 Live Tracking

Show:

-   Project/Order
-   Client
-   Product
-   Plant
-   Order Quantity
-   Completed Quantity
-   Remaining Quantity
-   Current Stage
-   Progress %
-   Due Date
-   Expected Completion
-   Status

Statuses:

-   On Time
-   Getting Delayed
-   Delayed
-   Not Started / Start Warning / Start Delayed where applicable

## 9.3 Order Detail

Clicking an order should show:

-   order information
-   process stages
-   planned quantity
-   cumulative quantity
-   percentage complete
-   current stage
-   expected completion
-   status
-   production history

Example:

Cutting: 500 / 500 Framing: 150 / 500 Assembly: 0 / 500 Glass: 0 / 500
Finishing: 0 / 500

History:

Date \| Stage \| Quantity \| User

## 9.4 Weekly Production Graph

Display production quantity by day.

Filters:

-   Plant
-   Client
-   Product
-   Stage
-   Project
-   Date range

Use ProductionEntry as the source.

## 9.5 Pending Orders --- Client Wise

Show:

-   Client
-   Total orders
-   Total ordered quantity
-   Completed quantity
-   Pending quantity

Allow drill-down to individual orders.

## 9.6 Monthly Production --- Client Wise

Show:

-   Month
-   Client
-   Production quantity

Filters:

-   Month
-   Year
-   Plant
-   Client
-   Product

Allow drill-down where useful.

------------------------------------------------------------------------

# Phase 10 --- Audit Trail

Implement audit logging for important changes.

Track:

-   who created an entry
-   who modified an entry
-   when
-   previous value
-   new value
-   reason where applicable

Do not silently destroy important production history.

------------------------------------------------------------------------
Phase 4A — Excel / Bulk Data Import

Add a robust Excel import system so an organization can migrate its existing operational data into the SaaS.

The import system must support importing existing:

Clients

Plants

Products

Processes/stages

Process mappings

Special activities

Production orders/projects

Historical production entries

Special activity entries where applicable

The import system must be a controlled migration workflow, not a direct upload-and-insert action.

4A.1 Import Center

Create an Import Center under Administration/Data Management.

Provide:

Download import templates

Upload Excel file

Select import type

Validate file

Preview records

Show validation errors/warnings

Confirm import

Import progress/status

Import history

4A.2 Workbook Structure

Prefer one Excel workbook with separate sheets for related data, while also allowing individual templates where useful.

Example sheets:

Plants

Clients

Products

Processes

ProcessMappings

SpecialActivities

Projects

ProductionEntries

SpecialActivityEntries

Provide downloadable templates with correct column names, example rows, required/optional indicators, date-format guidance, and reference-code guidance.

4A.3 Import Dependency Order

Recommended order:

Plants

Clients

Products

Processes

Process Mappings

Special Activities

Projects / Production Orders

Production Entries

Special Activity Entries

The importer must enforce or safely resolve dependencies.

4A.4 Stable External IDs

Excel relationships must use human-readable stable reference codes, not database UUIDs or row numbers.

Examples:

PlantCode

ClientCode

ProductCode

ProcessCode

ProjectCode

ActivityCode

Example:

Projects:
ProjectCode = ABC-001
ClientCode = CLIENT-01
PlantCode = PLANT-MUM
ProductCode = DOOR-01

ProductionEntries:
ProjectCode = ABC-001
ProcessCode = CUTTING

The importer resolves these to internal database IDs.

4A.5 Duplicate Handling

Before importing, detect:

New records

Existing/matching records

Invalid records

Warnings

Duplicate reference codes

Provide explicit strategies such as:

Create new

Update existing

Skip existing

Fail on duplicate

Never silently create duplicate records.

Historical production transactions require stricter protection and must not be silently overwritten.

4A.6 Validate Before Commit

Parse and validate the complete upload before committing dependent production data.

Validate:

required fields

dates

numeric quantities

duplicate reference codes

client references

plant references

product references

process references

project references

process mappings

production quantities

organization boundaries

plant permissions

sequential production rules

Every error should identify:

sheet

Excel row

column

submitted value

error message

Example:

ProductionEntries, Row 27, ProcessCode: CUTTING does not exist.

4A.7 Preview

Before confirmation, show a summary such as:

Clients — New: 42, Update: 4, Errors: 2
Projects — New: 185, Update: 0, Errors: 3
Production Entries — New: 4,820, Errors: 17

Allow the user to correct the Excel file and re-upload.

4A.8 Transaction Safety

Use database transactions for logically dependent batches.

Do not leave the database in an inconsistent state.

For very large imports, process in controlled batches while maintaining an import-job record and clear status.

4A.9 Import Job History

Create an ImportJob record/log containing:

Organization

Uploaded by

File name

Import type

Started at

Completed at

Status

Total rows

Successful rows

Failed rows

Warning count

Error report/reference

4A.10 Error Report

After validation/import, provide a downloadable Excel/CSV error report containing:

Sheet

Row

Column

Value

Error

Suggested correction where possible

4A.11 Historical Production

Historical production entries must be imported as incremental transactions.

Example:

30 Aug | ABC-001 | Cutting | 200
31 Aug | ABC-001 | Cutting | 300

These remain two transactions and calculate to 500 cumulative.

Do not convert historical incremental entries into cumulative values.

4A.12 Historical Process Snapshot

Historical orders must preserve their applicable process structure.

If the current master mapping differs from the historical order's process structure, do not silently replace the historical structure.

4A.13 Security

Imports are tenant-scoped.

A user can import only into their organization and plants they are authorized to manage.

Never allow an Excel column to override the authenticated organization context.

4A.14 Import UX

The workflow should be:

Import Center
→ Download Template (optional)
→ Upload File
→ Parse
→ Validate
→ Preview
→ Fix Errors if needed
→ Confirm Import
→ Process
→ Import Summary

Do not write uploaded rows directly to production tables before validation and confirmation.
------------------------

# Phase 11 --- Performance and Data Growth

PostgreSQL remains the source of truth.

Do not load all historical production records into the browser.

Dashboard queries must:

-   filter by organization
-   filter by plant where applicable
-   use date ranges
-   aggregate in the database
-   select only required fields
-   use appropriate indexes
-   paginate large tables

Design for multi-year historical data.

The application should be able to grow from thousands to millions of
production transactions without requiring a database technology change.

Potential future architecture:

ProductionEntry → aggregation service → daily/weekly/monthly summaries →
cache

Do not prematurely implement complex caching before correctness is
established.

------------------------------------------------------------------------

# Phase 12 --- Image/Data Website Compatibility

A second existing application will also be hosted alongside this SaaS.

That application is a showroom/product website where product data is
stored in a database and images are displayed.

Keep the infrastructure capable of hosting multiple Node.js
applications.

Do not store large image binaries directly inside PostgreSQL unless
there is a specific justified reason.

Prefer:

Database: - product metadata - image URLs/references

Object/image storage: - actual image files

------------------------------------------------------------------------

# Phase 13 --- Deployment Compatibility

The application must be Docker-compatible and portable.

It should be deployable on:

-   Hostinger VPS
-   AWS
-   other Linux VPS/cloud infrastructure

Do not introduce hosting-provider-specific application logic.

Required deployment considerations:

-   environment variables
-   PostgreSQL connection string
-   migrations
-   production build
-   secure secrets
-   backups
-   logging
-   health checks
-   reverse proxy compatibility
-   HTTPS
-   database backup strategy

------------------------------------------------------------------------

# Phase 14 --- Testing

Create automated tests for business logic.

At minimum test:

## Multi-tenancy

-   organization A cannot access organization B

## Plant Access

-   user can access permitted plants
-   user cannot access unauthorized plants

## Process Logic

-   correct process mapping loads
-   process snapshot remains unchanged after master mapping changes

## Incremental Production

500-door order:

30 Aug: Cutting = 200

31 Aug: Cutting = 300 Framing = 150

Expected:

Cutting = 500/500 Framing = 150/500 Current Stage = Framing

## Validation

Cutting = 100 Framing = 200

Must fail.

## Start Date

No start date: - effective start date = order date

Future start date: - no delayed-start alert before start date

## Start Delay

Test: - 2 days - 3 days - 5 days - 6 days

## Completion

Test: - partially complete - fully complete - overdue - on time

## Dashboard

Test: - plant filters - client filters - date filters - multi-plant
users - organization isolation

------------------------------------------------------------------------

# Phase 15 --- Final Production Readiness

Before declaring the MVP complete, verify:

-   authentication works
-   authorization works
-   tenant isolation works
-   plant switching works
-   masters work
-   process mappings work
-   order creation works
-   process snapshots work
-   daily production works
-   validation works
-   calculation engine works
-   start-delay logic works
-   production-delay logic works
-   dashboards work
-   audit trail works
-   database indexes exist
-   backups are configured
-   error handling exists
-   production build succeeds
-   deployment is documented

Do not mark a phase complete merely because the UI renders.

Each phase is complete only when the underlying business logic and
database behavior are tested.

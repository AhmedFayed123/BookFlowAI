# InstaPay manual payments

Set `InstaPay__Recipient` to the actual business IPA or phone number (for example `bookflow@instapay`). Checkout is disabled until this is configured. Amounts are EGP and use the server-owned service price; no frontend-only tax or fee estimate is charged.

Apply the `AddInstaPayVerification` EF migration before serving requests (normal startup migration applies it too). Existing bookings keep a null payment status. The nullable payment status distinguishes legacy bookings from InstaPay bookings.

`POST /api/bookings/instapay` accepts multipart form fields `staffId`, `serviceId`, `dateTime`, `instaPayRefNumber`, and optional `receipt` (PNG/JPEG, maximum 5 MB). Reference numbers must contain exactly 12 ASCII digits and are unique across all submissions, including rejected ones. Duplicate references must be resolved with support rather than submitted again.

Customers fetch `/api/bookings/instapay-settings`. Admins review `/admin/instapay`, backed by `GET /api/admin/instapay-pending`, and submit `{ "approved": true, "note": "Matched transaction" }` to `POST /api/admin/bookings/{id}/verify-instapay`. Match reference, recipient, and amount against the business account history; a screenshot alone does not prove payment.

A submitted booking holds overlapping provider slots for 30 minutes using UTC expiry timestamps. Unreviewed holds expire, become cancelled/rejected, and release availability; rejection releases immediately. Approval is conditional on an active, unexpired hold and is safe against repeated or competing review requests. SQL Server transaction-owned application locks serialize booking creation, rescheduling, and approval for each provider. Legacy confirmation/completion and overrides cannot bypass pending verification.

Receipts are stored outside the public web root. Set `InstaPay__ReceiptStoragePath` to an absolute persistent shared volume for multiple API instances. Mount this storage in deployments; do not rely on ephemeral container files. Receipt endpoints require the owning customer or an admin. The admin panel fetches receipts with its bearer token.

Approval/rejection updates reach customers through their authenticated SignalR group. Notification polling also detects final payment outcomes after reconnecting or returning offline, creates a persisted in-app notification, displays a toast, and refreshes booking reminders. This uses the existing in-app system; no email transport is configured.

Rejected or expired transfers require manual support/refund handling. Never ask customers to pay twice automatically.

SQL locking behavior: https://learn.microsoft.com/en-us/sql/relational-databases/system-stored-procedures/sp-getapplock-transact-sql

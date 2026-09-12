# Frontend API integration audit

Inspected `BookFlowAI.Api/Controllers`, backend DTOs, `Program.cs` Swagger/CORS setup, the running `/swagger/v1/swagger.json`, and `frontend/src/lib/api.ts` plus page/component call sites. The backend is in `BookFlowAI.Api`, not `src/BookFlowAI.API`.

Swagger exposes **62 HTTP operations**. Baseline below describes the state before this integration pass; every row that is not “Integrated” identifies a missing, partial, broken, or compatibility-only integration.

## Main gaps implemented

- Editable profile and correct boolean response handling.
- Booking details, live-availability rescheduling, completed-booking reviews, and administrative override.
- Service/category management; public service and provider detail pages with reviews.
- Business information, business AI context form, and a no-show forecast form.
- Real server-calculated daily summary/live-booking snapshot.
- Server-side logout instead of local storage cleanup alone.
- Correct prediction URL, review creation response, typed live bookings, and offset-less slot serialization.
- Fixed a live backend EF exception in staff details; public staff DTOs now include active service assignments.

## Complete endpoint inventory

| Method | Endpoint | Baseline | Integration now |
| --- | --- | --- | --- |
| GET | `/api/account/me` | Integrated | /account |
| PUT | `/api/account/me` | Client only; boolean response mismatch | /account — editable profile |
| PUT | `/api/account/change-password` | Integrated | /account |
| GET | `/api/admin/dashboard/summary` | Client only | OperationsSnapshot on /admin/dashboard |
| GET | `/api/admin/bookings/live` | Client only; untyped response | OperationsSnapshot on /admin/dashboard |
| GET | `/api/admin/bookings` | Integrated | Admin booking table; typed query helper |
| PUT | `/api/admin/bookings/{id}/override` | Client only | /bookings/[id] — Admin override |
| POST | `/api/admin/ai/business-data` | Client only | /admin/business — context form |
| GET | `/api/admin/knowledge` | Integrated | /admin/knowledge |
| POST | `/api/admin/knowledge/upload` | Integrated | /admin/knowledge |
| DELETE | `/api/admin/knowledge/{id}` | Integrated | /admin/knowledge |
| GET | `/api/admin/staff` | Integrated | /admin/staff |
| POST | `/api/admin/staff` | Integrated | /admin/staff |
| GET | `/api/admin/staff/{id}` | Missing client/UI | /admin/staff — fresh details before edit |
| PUT | `/api/admin/staff/{id}` | Integrated | /admin/staff |
| DELETE | `/api/admin/staff/{id}` | Integrated | /admin/staff |
| PATCH | `/api/admin/staff/{id}/availability` | Integrated | /admin/staff |
| GET | `/api/admin/staff/time-off-requests` | Integrated | /admin/staff |
| PATCH | `/api/admin/staff/time-off-requests/{requestId}` | Integrated | /admin/staff |
| POST | `/api/ai/chat` | Integrated | Inline booking assistant |
| POST | `/api/ai/chat/predict-no-show` | Broken route (/ai/predict-no-show) | /admin/business — forecast form |
| GET | `/api/analytics/summary` | Integrated | AnalyticsPanel on /admin/dashboard |
| GET | `/api/analytics/services-performance` | Integrated | AnalyticsPanel on /admin/dashboard |
| GET | `/api/analytics/peak-hours` | Integrated | AnalyticsPanel on /admin/dashboard |
| GET | `/api/analytics/no-show-rate` | Integrated | AnalyticsPanel on /admin/dashboard |
| POST | `/api/auth/register` | Integrated | /register |
| POST | `/api/auth/login` | Integrated | /login |
| POST | `/api/auth/refresh-token` | Integrated | Shared 401 retry/refresh queue |
| POST | `/api/auth/revoke-token` | Client only | Typed JSON-string compatibility helper; logout covers same operation |
| POST | `/api/auth/logout` | Client only; UI cleared storage only | Home/workspace sign-out now revokes server session |
| POST | `/api/bookings` | Integrated; slot shifted to UTC | BookingModal — corrected wall-clock payload |
| GET | `/api/bookings/my-bookings` | Integrated | /protected |
| GET | `/api/bookings/{id}` | Client only | /bookings/[id] |
| PUT | `/api/bookings/{id}/reschedule` | Client only | /bookings/[id] — live slot selector |
| PUT | `/api/bookings/{id}/cancel` | Integrated | Customer/Admin booking management |
| PUT | `/api/bookings/{id}/confirm` | Integrated | Staff/Admin tables and booking details |
| PUT | `/api/bookings/{id}/complete` | Integrated | Staff/Admin tables and booking details |
| PUT | `/api/bookings/{id}/mark-no-show` | Integrated | Staff/Admin tables and booking details |
| GET | `/api/business-categories` | Client only | /admin/catalog (includeInactive=true) |
| POST | `/api/business-categories` | Missing client/UI | /admin/catalog |
| PUT | `/api/business-categories/{id}` | Missing client/UI | /admin/catalog |
| DELETE | `/api/business-categories/{id}` | Missing client/UI | /admin/catalog |
| GET | `/api/business/info` | Client only | Home business info; /admin/business context loading |
| POST | `/api/reviews` | Client only; response incorrectly typed as ReviewDto | /bookings/[id] — completed customer booking |
| GET | `/api/reviews/staff/{staffId}` | Client only | /providers/[id] and booking details |
| GET | `/api/services` | Integrated | ServiceList; /admin/catalog |
| POST | `/api/services` | Client only | /admin/catalog |
| GET | `/api/services/{id}` | Client only | /services/[id] |
| PUT | `/api/services/{id}` | Client only | /admin/catalog |
| DELETE | `/api/services/{id}` | Client only | /admin/catalog |
| GET | `/api/staff` | Integrated | BookingModal; service details; Admin override provider choices |
| POST | `/api/staff` | Missing client; modern equivalent integrated | legacyStaffApi.create; /admin/staff uses atomic modern endpoint |
| GET | `/api/staff/{id}` | Client only; backend EF error | /providers/[id]; fixed backend average and service projection |
| PUT | `/api/staff/{id}` | Missing client; modern equivalent integrated | legacyStaffApi; UI uses modern /admin/staff/{id} |
| DELETE | `/api/staff/{id}` | Missing client; modern equivalent integrated | legacyStaffApi; UI uses modern /admin/staff/{id} |
| GET | `/api/staff/{id}/availability` | Integrated | BookingModal and reschedule selector |
| GET | `/api/staff/my-schedule` | Integrated | /staff |
| GET | `/api/staff/my-bookings/today` | Missing client; date-filter route already used | staffApi.getTodayBookings; no duplicate UI (see compatibility notes) |
| GET | `/api/staff/my-bookings` | Integrated | /staff — explicit date selection |
| PUT | `/api/staff/schedule/day-off` | Integrated | /staff time-off request |
| POST | `/api/staff/{id}/schedule` | Missing client; modern equivalent integrated | legacyStaffApi.addShift; UI saves modern staff shift collection |
| PUT | `/api/staff/{id}/approve-day-off` | Missing client; modern equivalent integrated | legacyStaffApi.approveDayOff; UI reviews request by requestId |

## Deliberate compatibility-only operations

These endpoints remain callable with typed helpers, but do not get redundant or less-safe screens:

- `POST/PUT/DELETE /api/staff[/{id}]`: modern `/api/admin/staff` performs account creation, service assignments, and shift changes together; its deletion also protects booking history.
- `POST /api/staff/{id}/schedule`: modern provider editing manages the shift collection.
- `PUT /api/staff/{id}/approve-day-off`: modern moderation identifies a particular request instead of a provider/date pair.
- `GET /api/staff/my-bookings/today`: the Staff workspace uses an explicit selected date via `my-bookings?date=`; no duplicate Today screen.
- `POST /api/auth/revoke-token`: logout already revokes the current refresh token. This is not a revoke-all-sessions endpoint.

No payment, notification CRUD, or admin “create user” HTTP endpoint exists in Swagger. Frontend types or backend service methods alone are not evidence of available endpoints.

## Contract and backend limitations

- `PUT /api/account/me` returns a JSON boolean, not an envelope.
- `POST /api/reviews` returns `{ message }`, not a created review DTO.
- Logout/revoke accept a JSON **string**, not `{ refreshToken }`.
- Prediction is `POST /api/ai/chat/predict-no-show`; all production UI requests go through .NET, not directly to Python.
- `TimeSpan` values arrive as `HH:mm:ss`; day-of-week values are numeric (Sunday = 0).
- Current booking dates and shifts have no business timezone metadata. Create/reschedule preserve the selected offset-less schedule time (`yyyy-MM-ddTHH:mm:ss`). A business timezone/DST model still needs a backend/domain decision.
- `GET /api/services` lists active services in active categories only. There is no admin inactive-service listing endpoint, so archived services cannot be rediscovered/reactivated in this UI. Categories support `includeInactive=true` for Admins.
- Business AI config is persisted as text in business info, not as a readable structured DTO; the form loads the known text fields. The backend indexes SQL services and ignores the legacy `servicesSummary` field.
- The public business-info endpoint exposes all rows, including AI configuration. The public widget deliberately excludes that row; server-side filtering/authorization is required if that context is confidential.
- Normal rescheduling revalidates availability on the server. Administrative override intentionally bypasses it and requires an explicit confirmation in the UI.

## Environment and request routing

Set `NEXT_PUBLIC_API_URL=http://localhost:5000/api` for browser requests. The fallback is the same. The URL includes `/api`; browser JavaScript cannot resolve Compose service names such as `webapi`.

Docker maps `5000:8080`. CORS in `Program.cs` permits `http://localhost:3000` with credentials, methods, and request headers. The shared Axios client attaches Bearer tokens, uses a 30-second request limit, normalizes validation/network/server errors, and coordinates a single refresh attempt on 401.

## Verification

```powershell
docker exec bookflow_frontend npx tsc --noEmit
docker exec bookflow_frontend npm test
docker exec bookflow_frontend npx eslint src/app src/components src/lib
./scripts/verify-frontend-api.ps1
```

The development-only PowerShell smoke test creates temporary category/service/provider/customer/bookings, exercises profile updates, slots, rescheduling, statuses, reviews, overrides, prediction, CORS, and server logout, then permanently removes only those exact temporary records. It resolves SQL cleanup credentials from the running SQL container without printing them. Set `BOOKFLOW_TEST_ADMIN_PASSWORD` if the seeded development Admin password has changed. Never run it against production.

The AI business-context write is **not** submitted automatically during verification: it would replace real indexed context. Its client request is typed and the form handles successful responses, timeouts, and service failures; actual indexing depends on the AI provider and model availability.

Full-repository lint still has pre-existing issues in `src/hooks/useSignalR.ts`; lint for pages/components/API helpers is checked separately.


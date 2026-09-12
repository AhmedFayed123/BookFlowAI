# In-app notifications

The header bell appears for signed-in users on the homepage and all workspace screens. Notifications use the same glass/slate design as the application. Sonner powers instant action toasts, while the existing `useToast()` interface remains compatible with current screens.

## Data sources

- Customers: `GET /api/bookings/my-bookings`.
- Staff: `GET /api/staff/my-bookings` for today and tomorrow.
- Administrators: `GET /api/admin/bookings`.
- Booking creation: the booking form publishes a confirmation with its actual service, booking ID, and appointment time. Pending requests are explicitly labeled as awaiting provider confirmation.
- System notices: existing warning/error action toasts also appear in the notification center.

The backend does not expose a persisted notification inbox endpoint. The provider derives reminders for Pending/Confirmed appointments within the next 48 hours, refreshes every minute and on window focus, and refreshes after booking mutations. Cancelled/completed appointments are removed from the reminder list on refresh. Staff reminders cover the current and next calendar day available through the schedule endpoint.

Read/dismissed state and recent notices are stored in `localStorage`, scoped to the signed-in email (maximum 200 items). This state is browser-local, not synchronized between devices. Storage restrictions do not prevent use. API errors retain cached notifications and display a retry action; production failures never substitute mock appointments.

These are **in-app reminders while BookFlow is open**, not background browser push, email, or SMS. Offset-less .NET appointment times are interpreted as local schedule times, matching the current booking contract.

## Extending and testing

Use `useNotifications()` inside `NotificationsProvider` for the inbox, unread count, refresh, mark-read, mark-all-read, and dismiss operations. Use `publishNotification()` from `src/lib/notifications.ts` for a typed system or booking notice. Dispatch `BOOKINGS_CHANGED_EVENT` after an external booking mutation to refresh derived reminders. API client create/reschedule/cancel/status methods already do this.

For isolated tests or component previews, explicitly pass `mockNotifications: AppNotification[]` to `NotificationsProvider`. That mode skips API calls and uses the dedicated mock storage key. No production environment flag enables fake notifications.

Run `npm test` and `npx tsc --noEmit` from `frontend`, or through `docker exec bookflow_frontend`. The notification tests cover reminder eligibility, actions/persistence, categories, keyboard dismissal, API retry, account isolation, and staff endpoint selection.

Sonner setup follows the [official documentation](https://sonner.emilkowal.ski/).

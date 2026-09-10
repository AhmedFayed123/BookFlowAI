using BookFlowAI.Api.Hubs;
using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BookFlowAI.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/bookings")]
    public class BookingsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IAiServiceClient _aiServiceClient;
        private readonly IHubContext<BookingHub> _hubContext;

        public BookingsController(
            IApplicationDbContext context,
            IAiServiceClient aiServiceClient,
            IHubContext<BookingHub> hubContext)
        {
            _context = context;
            _aiServiceClient = aiServiceClient;
            _hubContext = hubContext;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("sub")?.Value;

            return int.Parse(userIdClaim!);
        }

        // POST /api/bookings
        [Authorize(Roles = "Customer")]
        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto request)
        {
            var service = await _context.Services.FindAsync(request.ServiceId);
            if (service == null) return BadRequest("الخدمة المحددة غير موجودة.");

            var staff = await _context.StaffMembers.FindAsync(request.StaffId);
            if (staff == null) return BadRequest("الموظف المحدد غير موجود.");

            var customerId = GetCurrentUserId();
            var bookingEnd = request.DateTime.AddMinutes(service.DurationInMinutes);

            // 1. التحقق من وجود تعارض في المواعيد
            var hasConflict = await _context.Bookings.AnyAsync(b =>
                b.StaffId == request.StaffId &&
                b.Status != "Cancelled" &&
                b.DateTime < bookingEnd &&
                b.DateTime.AddMinutes(b.Service.DurationInMinutes) > request.DateTime);

            if (hasConflict) return BadRequest("الموعد المطلوب يتعارض مع حجز آخر للموظف.");

            // 2. حساب تفاصيل سجل الحجوزات السابقة للعميل
            var pastBookings = await _context.Bookings
                .Where(b => b.CustomerId == customerId)
                .ToListAsync();

            var pastNoShows = pastBookings.Where(b => b.Status == "NoShow").ToList();
            var lastNoShow = pastNoShows.OrderByDescending(b => b.DateTime).FirstOrDefault();

            int? daysSinceLastNoShow = lastNoShow != null
                ? (int?)(request.DateTime.Date - lastNoShow.DateTime.Date).Days
                : null;

            // 3. حساب احتمالية عدم الحضور عبر AI Engine (إرسال الـ 10 المعاملات المطلوبة بالكامل)
            var aiPrediction = await _aiServiceClient.PredictNoShowAsync(new AiPredictRequest(
                CustomerId: customerId,
                TotalPastBookings: pastBookings.Count,
                PastNoShowsCount: pastNoShows.Count,
                PastCancellationsCount: pastBookings.Count(b => b.Status == "Cancelled"),
                LeadTimeDays: Math.Max(0, (request.DateTime.Date - DateTime.Today).Days),
                BookingHour: request.DateTime.Hour,
                BookingDayOfWeek: (int)request.DateTime.DayOfWeek,
                IsWeekend: request.DateTime.DayOfWeek == DayOfWeek.Friday || request.DateTime.DayOfWeek == DayOfWeek.Saturday,
                IsHoliday: false,
                DaysSinceLastNoShow: daysSinceLastNoShow
            ));

            var booking = new Booking
            {
                CustomerId = customerId,
                StaffId = request.StaffId,
                ServiceId = request.ServiceId,
                DateTime = request.DateTime,
                Status = "Pending",
                NoShowProbability = aiPrediction?.Probability ?? 0.15
            };

            _context.Bookings.Add(booking);
            await _context.SaveChangesAsync();

            // 4. بث إشعار لحظي عبر SignalR لشاشة الأدمن والموظف
            var notificationData = new
            {
                BookingId = booking.Id,
                CustomerId = customerId,
                StaffId = request.StaffId,
                ServiceName = service.Name,
                DateTime = booking.DateTime,
                Status = booking.Status,
                NoShowProbability = booking.NoShowProbability,
                Message = "تم إضافة حجز جديد بنجاح"
            };

            await _hubContext.Clients.Group("Admins").SendAsync("ReceiveNewBooking", notificationData);
            await _hubContext.Clients.Group($"Staff_{request.StaffId}").SendAsync("ReceiveNewBooking", notificationData);

            return Ok(new { message = "تم إنشاء الحجز بنجاح.", bookingId = booking.Id });
        }

        // GET /api/bookings/my-bookings
        [Authorize(Roles = "Customer")]
        [HttpGet("my-bookings")]
        public async Task<ActionResult<IEnumerable<BookingDetailDto>>> GetMyBookings()
        {
            var customerId = GetCurrentUserId();

            var bookings = await _context.Bookings
                .Include(b => b.Service)
                .Include(b => b.Staff).ThenInclude(s => s.User)
                .Where(b => b.CustomerId == customerId)
                .OrderByDescending(b => b.DateTime)
                .Select(b => new BookingDetailDto(
                    b.Id,
                    b.ServiceId,
                    b.Service.Name,
                    b.StaffId,
                    b.Staff.User.Name,
                    b.DateTime,
                    b.Service.DurationInMinutes,
                    b.Service.Price,
                    b.Status,
                    b.NoShowProbability))
                .ToListAsync();

            return Ok(bookings);
        }

        // GET /api/bookings/{id}
        [Authorize(Roles = "Customer,Staff,Admin")]
        [HttpGet("{id:int}")]
        public async Task<ActionResult<BookingDetailDto>> GetBookingById(int id)
        {
            var customerId = GetCurrentUserId();
            var isStaffOrAdmin = User.IsInRole("Staff") || User.IsInRole("Admin");

            var query = _context.Bookings
                .Include(b => b.Service)
                .Include(b => b.Staff).ThenInclude(s => s.User)
                .Where(b => b.Id == id);

            if (!isStaffOrAdmin)
            {
                query = query.Where(b => b.CustomerId == customerId);
            }

            var booking = await query
                .Select(b => new BookingDetailDto(
                    b.Id,
                    b.ServiceId,
                    b.Service.Name,
                    b.StaffId,
                    b.Staff.User.Name,
                    b.DateTime,
                    b.Service.DurationInMinutes,
                    b.Service.Price,
                    b.Status,
                    b.NoShowProbability))
                .FirstOrDefaultAsync();

            if (booking == null) return NotFound("الحجز غير موجود.");
            return Ok(booking);
        }

        // PUT /api/bookings/{id}/reschedule
        [Authorize(Roles = "Customer,Admin")]
        [HttpPut("{id:int}/reschedule")]
        public async Task<IActionResult> RescheduleBooking(int id, [FromBody] RescheduleBookingDto request)
        {
            var customerId = GetCurrentUserId();
            var isAdmin = User.IsInRole("Admin");

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id && (isAdmin || b.CustomerId == customerId));
            if (booking == null) return NotFound("الحجز غير موجود.");
            if (booking.Status == "Cancelled") return BadRequest("لا يمكن إعادة جدولة حجز ملغى.");

            booking.DateTime = request.NewDateTime;
            booking.Status = "Pending";

            await _context.SaveChangesAsync();

            await NotifyBookingStatusChange(booking.Id, booking.StaffId, "Pending", "تم تعديل موعد الحجز.");

            return Ok(new { message = "تم تعديل موعد الحجز بنجاح." });
        }

        // PUT /api/bookings/{id}/cancel
        [Authorize(Roles = "Customer,Admin")]
        [HttpPut("{id:int}/cancel")]
        public async Task<IActionResult> CancelBooking(int id)
        {
            var customerId = GetCurrentUserId();
            var isAdmin = User.IsInRole("Admin");

            var booking = await _context.Bookings.FirstOrDefaultAsync(b => b.Id == id && (isAdmin || b.CustomerId == customerId));
            if (booking == null) return NotFound("الحجز غير موجود.");
            if (booking.Status == "Cancelled") return BadRequest("الحجز ملغى بالفعل.");

            booking.Status = "Cancelled";

            await _context.SaveChangesAsync();

            await NotifyBookingStatusChange(booking.Id, booking.StaffId, "Cancelled", "تم إلغاء الحجز.");

            return Ok(new { message = "تم إلغاء الحجز بنجاح." });
        }

        // PUT /api/bookings/{id}/confirm
        [Authorize(Roles = "Staff,Admin")]
        [HttpPut("{id:int}/confirm")]
        public async Task<IActionResult> ConfirmBooking(int id)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound("الحجز غير موجود.");

            if (booking.Status == "Cancelled")
                return BadRequest("لا يمكن تأكيد حجز تم إلغاؤه.");

            booking.Status = "Confirmed";
            await _context.SaveChangesAsync();

            await NotifyBookingStatusChange(booking.Id, booking.StaffId, "Confirmed", "تم تأكيد الحجز.");

            return Ok(new { message = "تم تأكيد الحجز بنجاح." });
        }

        // PUT /api/bookings/{id}/complete
        [Authorize(Roles = "Staff,Admin")]
        [HttpPut("{id:int}/complete")]
        public async Task<IActionResult> CompleteBooking(int id)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound("الحجز غير موجود.");

            booking.Status = "Completed";
            await _context.SaveChangesAsync();

            await NotifyBookingStatusChange(booking.Id, booking.StaffId, "Completed", "تم تسجيل إكمال الحجز.");

            return Ok(new { message = "تم تسجيل إكمال الحجز بنجاح." });
        }

        // PUT /api/bookings/{id}/mark-no-show
        [Authorize(Roles = "Staff,Admin")]
        [HttpPut("{id:int}/mark-no-show")]
        public async Task<IActionResult> MarkNoShow(int id)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound("الحجز غير موجود.");

            booking.Status = "NoShow";
            booking.NoShowProbability = 1.0;

            await _context.SaveChangesAsync();

            await NotifyBookingStatusChange(booking.Id, booking.StaffId, "NoShow", "تم تسجيل عدم حضور العميل (No-Show).");

            return Ok(new { message = "تم تسجيل عدم حضور العميل (No-Show)." });
        }

        // ميثود مساعدة لإرسال إشعارات التعديل عبر SignalR
        private async Task NotifyBookingStatusChange(int bookingId, int staffId, string newStatus, string message)
        {
            var data = new
            {
                BookingId = bookingId,
                StaffId = staffId,
                Status = newStatus,
                Message = message,
                Timestamp = DateTime.UtcNow
            };

            await _hubContext.Clients.Group("Admins").SendAsync("ReceiveBookingUpdate", data);
            await _hubContext.Clients.Group($"Staff_{staffId}").SendAsync("ReceiveBookingUpdate", data);
        }
    }
}
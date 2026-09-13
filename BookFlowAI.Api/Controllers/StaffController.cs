using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace BookFlowAI.Api.Controllers
{
    [ApiController]
    [Route("api/staff")]
    public class StaffController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public StaffController(IApplicationDbContext context)
        {
            _context = context;
        }

        // ==========================================
        // 1. PUBLIC / CUSTOMER ENDPOINTS (استعراض)
        // ==========================================

        // GET /api/staff
        [HttpGet]
        public async Task<ActionResult<IEnumerable<StaffProfileDto>>> GetAll([FromQuery] int? serviceId = null)
        {
            var query = _context.StaffMembers
                .AsNoTracking()
                .Where(s => s.IsAvailable)
                .AsQueryable();
            if (serviceId.HasValue)
                query = query.Where(staff => staff.StaffServices.Any(item => item.ServiceId == serviceId.Value));

            var staffList = await query
                .Select(s => new StaffProfileDto(
                    s.Id,
                    s.UserId,
                    s.User.Name,
                    s.User.Email,
                    s.User.PhoneNumber,
                    s.Specialties ?? string.Empty,
                    s.WorkingHours ?? string.Empty,
                    s.Bookings
                        .Where(b => b.Review != null)
                        .Select(b => (double?)b.Review!.Rating)
                        .Average() ?? 0,
                    s.IsAvailable,
                    s.StaffServices
                        .Where(assignment => assignment.Service.IsActive && assignment.Service.BusinessCategory.IsActive)
                        .Select(assignment => new AdminStaffServiceDto(assignment.ServiceId, assignment.Service.Name))
                        .ToArray()
                ))
                .ToListAsync();

            return Ok(staffList);
        }

        // GET /api/staff/5
        [HttpGet("{id:int}")]
        public async Task<ActionResult<StaffProfileDto>> GetById(int id)
        {
            var staff = await _context.StaffMembers
                .AsNoTracking()
                .Where(s => s.Id == id)
                .Where(s => s.IsAvailable)
                .Select(s => new StaffProfileDto(
                    s.Id,
                    s.UserId,
                    s.User.Name,
                    s.User.Email,
                    s.User.PhoneNumber,
                    s.Specialties ?? string.Empty,
                    s.WorkingHours ?? string.Empty,
                    s.Bookings.Where(b => b.Review != null).Select(b => (double?)b.Review!.Rating).Average() ?? 0,
                    s.IsAvailable,
                    s.StaffServices
                        .Where(assignment => assignment.Service.IsActive && assignment.Service.BusinessCategory.IsActive)
                        .Select(assignment => new AdminStaffServiceDto(assignment.ServiceId, assignment.Service.Name))
                        .ToArray()
                ))
                .FirstOrDefaultAsync();

            if (staff == null) return NotFound("الموظف غير موجود.");
            return Ok(staff);
        }

        // GET /api/staff/5/availability?date=2026-09-10
        [HttpGet("{id:int}/availability")]
        public async Task<ActionResult<IEnumerable<AvailabilitySlotDto>>> GetAvailability(int id, [FromQuery] DateTime date, [FromQuery] int? serviceId = null)
        {
            if (date == default) return BadRequest(new { message = "A valid date is required." });
            if (!await _context.StaffMembers.AnyAsync(staff => staff.Id == id && staff.IsAvailable))
                return Ok(Array.Empty<AvailabilitySlotDto>());
            if (await _context.StaffTimeOffRequests.AnyAsync(request => request.StaffId == id
                && request.Date == date.Date && request.Status == "Approved"))
                return Ok(Array.Empty<AvailabilitySlotDto>());

            var slotDuration = 30;
            if (serviceId.HasValue)
            {
                var assignedService = await _context.StaffServices
                    .Where(assignment => assignment.StaffId == id && assignment.ServiceId == serviceId.Value
                        && assignment.Service.IsActive)
                    .Select(assignment => assignment.Service.DurationInMinutes)
                    .FirstOrDefaultAsync();
                if (assignedService <= 0) return BadRequest(new { message = "This provider is not assigned to the selected service." });
                slotDuration = assignedService;
            }

            var dayOfWeek = date.DayOfWeek;

            // 1. جلب فترات العمل المسجلة لهذا اليوم
            var schedules = await _context.StaffSchedules
                .Where(s => s.StaffId == id && s.DayOfWeek == dayOfWeek)
                .ToListAsync();

            if (!schedules.Any()) return Ok(new List<AvailabilitySlotDto>());

            // 2. جلب الحجوزات غير الملغاة لهذا اليوم
            var existingBookings = await _context.Bookings
                .Include(b => b.Service)
                .Where(b => b.StaffId == id && b.DateTime.Date == date.Date && b.Status != "Cancelled" && (b.PaymentStatus != PaymentStatus.PendingInstaPay || b.LockExpiresAt > DateTime.UtcNow))
                .ToListAsync();

            var slots = new List<AvailabilitySlotDto>();

            foreach (var schedule in schedules)
            {
                var current = schedule.StartTime;
                while (current < schedule.EndTime)
                {
                    var slotEnd = current.Add(TimeSpan.FromMinutes(slotDuration));
                    if (slotEnd > schedule.EndTime) break;
                    var slotStartDateTime = date.Date.Add(current);

                    bool isBooked = existingBookings.Any(b =>
                        b.DateTime < slotStartDateTime.AddMinutes(slotDuration) &&
                        b.DateTime.AddMinutes(b.Service.DurationInMinutes) > slotStartDateTime);

                    slots.Add(new AvailabilitySlotDto(current, slotEnd, !isBooked));
                    current = current.Add(TimeSpan.FromMinutes(30));
                }
            }

            return Ok(slots);
        }

        // ==========================================
        // 2. STAFF PORTAL ENDPOINTS (حساب الموظف)
        // ==========================================

        private async Task<StaffMember?> GetCurrentStaffMemberAsync()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("sub")?.Value;

            if (userIdClaim == null) return null;

            int userId = int.Parse(userIdClaim);
            return await _context.StaffMembers
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.UserId == userId);
        }

        // GET /api/staff/my-schedule
        [Authorize(Roles = "Staff")]
        [HttpGet("my-schedule")]
        public async Task<ActionResult<IEnumerable<StaffScheduleDto>>> GetMySchedule()
        {
            var staff = await GetCurrentStaffMemberAsync();
            if (staff == null) return NotFound("حساب الموظف غير موجود.");

            var schedules = await _context.StaffSchedules
                .Where(s => s.StaffId == staff.Id)
                .OrderBy(s => s.DayOfWeek)
                .Select(s => new StaffScheduleDto(s.Id, s.DayOfWeek, s.StartTime, s.EndTime))
                .ToListAsync();

            return Ok(schedules);
        }

        // GET /api/staff/my-bookings/today
        [Authorize(Roles = "Staff")]
        [HttpGet("my-bookings/today")]
        public async Task<ActionResult<IEnumerable<StaffBookingItemDto>>> GetTodayBookings()
        {
            var staff = await GetCurrentStaffMemberAsync();
            if (staff == null) return NotFound("حساب الموظف غير موجود.");

            var today = DateTime.Today;

            var bookings = await _context.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Service)
                .Where(b => b.StaffId == staff.Id && b.DateTime.Date == today)
                .OrderBy(b => b.DateTime)
                .Select(b => new StaffBookingItemDto(
                    b.Id,
                    b.CustomerId,
                    b.Customer.Name,
                    b.Customer.PhoneNumber ?? "غير مسجل",
                    b.ServiceId,
                    b.Service.Name,
                    b.Service.DurationInMinutes,
                    b.Service.Price,
                    b.DateTime,
                    b.Status,
                    b.NoShowProbability))
                .ToListAsync();

            return Ok(bookings);
        }

        // GET /api/staff/my-bookings?date=2026-09-10
        [Authorize(Roles = "Staff")]
        [HttpGet("my-bookings")]
        public async Task<ActionResult<IEnumerable<StaffBookingItemDto>>> GetBookingsByDate([FromQuery] DateTime? date)
        {
            var staff = await GetCurrentStaffMemberAsync();
            if (staff == null) return NotFound("حساب الموظف غير موجود.");

            var targetDate = date?.Date ?? DateTime.Today;

            var bookings = await _context.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Service)
                .Where(b => b.StaffId == staff.Id && b.DateTime.Date == targetDate)
                .OrderBy(b => b.DateTime)
                .Select(b => new StaffBookingItemDto(
                    b.Id,
                    b.CustomerId,
                    b.Customer.Name,
                    b.Customer.PhoneNumber ?? "غير مسجل",
                    b.ServiceId,
                    b.Service.Name,
                    b.Service.DurationInMinutes,
                    b.Service.Price,
                    b.DateTime,
                    b.Status,
                    b.NoShowProbability))
                .ToListAsync();

            return Ok(bookings);
        }

        // PUT /api/staff/schedule/day-off
        [Authorize(Roles = "Staff")]
        [HttpPut("schedule/day-off")]
        public async Task<IActionResult> RequestDayOff([FromBody] RequestDayOffDto request)
        {
            var staff = await GetCurrentStaffMemberAsync();
            if (staff == null) return NotFound("حساب الموظف غير موجود.");

            var requestedDate = request.Date.Date;
            if (requestedDate < DateTime.Today)
                return BadRequest(new { message = "Time off cannot be requested for a past date." });
            if (await _context.StaffTimeOffRequests.AnyAsync(item => item.StaffId == staff.Id
                && item.Date == requestedDate && (item.Status == "Pending" || item.Status == "Approved")))
                return Conflict(new { message = "A time-off request already exists for this date." });

            _context.StaffTimeOffRequests.Add(new StaffTimeOffRequest
            {
                StaffId = staff.Id,
                Date = requestedDate,
                Reason = request.Reason?.Trim()
            });

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"تم إرسال طلب الإجازة ليوم {requestedDate:yyyy-MM-dd} للمراجعة.",
                affectedBookings = 0
            });
        }

        // POST /api/staff (إضافة موظف جديد)
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<IActionResult> CreateStaff([FromBody] CreateStaffDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound("حساب المستخدم المرتبط بالموظف غير موجود.");

            var staff = new StaffMember
            {
                UserId = dto.UserId,
                Specialties = dto.Specialties,
                WorkingHours = dto.WorkingHours,
                IsAvailable = true
            };

            if (await _context.StaffMembers.AnyAsync(item => item.UserId == dto.UserId))
                return Conflict(new { message = "This user already has a staff profile." });
            user.Role = "Staff";

            _context.StaffMembers.Add(staff);
            await _context.SaveChangesAsync();

            return Ok(new { message = "تم إضافة الموظف بنجاح.", staffId = staff.Id });
        }

        // PUT /api/staff/{id} (تعديل بيانات موظف)
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateStaff(int id, [FromBody] UpdateStaffDto dto)
        {
            var staff = await _context.StaffMembers.FindAsync(id);
            if (staff == null) return NotFound("الموظف غير موجود.");

            staff.Specialties = dto.Specialties;
            staff.WorkingHours = dto.WorkingHours;

            await _context.SaveChangesAsync();
            return Ok(new { message = "تم تحديث بيانات الموظف بنجاح." });
        }

        // DELETE /api/staff/{id} (إزالة موظف)
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteStaff(int id)
        {
            var staff = await _context.StaffMembers.FindAsync(id);
            if (staff == null) return NotFound("الموظف غير موجود.");

            _context.StaffMembers.Remove(staff);
            await _context.SaveChangesAsync();

            return Ok(new { message = "تم إزالة الموظف بنجاح." });
        }

        // POST /api/staff/{id}/schedule (تحديد جدول عمل الموظف)
        [Authorize(Roles = "Admin")]
        [HttpPost("{id:int}/schedule")]
        public async Task<IActionResult> SetStaffSchedule(int id, [FromBody] SetStaffScheduleDto dto)
        {
            var staff = await _context.StaffMembers.FindAsync(id);
            if (staff == null) return NotFound("الموظف غير موجود.");

            if (dto.StartTime >= dto.EndTime)
                return BadRequest(new { message = "Shift end time must be after its start time." });
            if (await _context.StaffSchedules.AnyAsync(schedule => schedule.StaffId == id
                && schedule.DayOfWeek == dto.DayOfWeek
                && schedule.StartTime < dto.EndTime
                && schedule.EndTime > dto.StartTime))
                return Conflict(new { message = "This shift overlaps an existing shift." });

            var schedule = new StaffSchedule
            {
                StaffId = id,
                DayOfWeek = dto.DayOfWeek,
                StartTime = dto.StartTime,
                EndTime = dto.EndTime
            };

            _context.StaffSchedules.Add(schedule);
            await _context.SaveChangesAsync();

            return Ok(new { message = "تم إضافة فترة العمل للموظف بنجاح.", scheduleId = schedule.Id });
        }

        // PUT /api/staff/{id}/approve-day-off (الموافقة/الرفض على طلب إجازة)
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/approve-day-off")]
        public async Task<IActionResult> ApproveDayOff(int id, [FromBody] ApproveDayOffDto dto)
        {
            var staff = await _context.StaffMembers.FindAsync(id);
            if (staff == null) return NotFound("الموظف غير موجود.");

            var request = await _context.StaffTimeOffRequests
                .FirstOrDefaultAsync(item => item.StaffId == id && item.Date == dto.Date.Date && item.Status == "Pending");
            if (request == null) return NotFound(new { message = "No pending time-off request exists for this date." });

            request.Status = dto.IsApproved ? "Approved" : "Rejected";
            request.AdminComment = dto.AdminComment?.Trim();
            request.ReviewedAt = DateTime.UtcNow;

            if (dto.IsApproved)
            {
                var affectedBookings = await _context.Bookings
                    .Where(b => b.StaffId == id && b.DateTime.Date == dto.Date.Date && b.Status != "Cancelled" && (b.PaymentStatus != PaymentStatus.PendingInstaPay || b.LockExpiresAt > DateTime.UtcNow))
                    .ToListAsync();

                foreach (var booking in affectedBookings)
                {
                    booking.Status = "Cancelled";
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = $"تمت الموافقة على الإجازة وإلغاء {affectedBookings.Count} حجز مرتبطة بيوم الإجازة." });
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "تم رفض طلب الإجازة." });
        }
    }
}

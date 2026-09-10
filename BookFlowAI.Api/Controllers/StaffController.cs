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
        public async Task<ActionResult<IEnumerable<StaffProfileDto>>> GetAll()
        {
            var staffList = await _context.StaffMembers
                .Select(s => new StaffProfileDto(
                    s.Id,
                    s.UserId,
                    s.User.Name,
                    s.User.Email,
                    s.User.PhoneNumber,
                    s.Specialties,
                    s.WorkingHours,
                    s.Bookings
                        .Where(b => b.Review != null)
                        .Select(b => (double?)b.Review!.Rating)
                        .Average() ?? 0
                ))
                .ToListAsync();

            return Ok(staffList);
        }

        // GET /api/staff/5
        [HttpGet("{id:int}")]
        public async Task<ActionResult<StaffProfileDto>> GetById(int id)
        {
            var staff = await _context.StaffMembers
                .Include(s => s.User)
                .Include(s => s.Bookings).ThenInclude(b => b.Review)
                .Where(s => s.Id == id)
                .Select(s => new StaffProfileDto(
                    s.Id,
                    s.UserId,
                    s.User.Name,
                    s.User.Email,
                    s.User.PhoneNumber,
                    s.Specialties,
                    s.WorkingHours,
                    s.Bookings.Where(b => b.Review != null).Select(b => b.Review!.Rating).DefaultIfEmpty(0).Average()
                ))
                .FirstOrDefaultAsync();

            if (staff == null) return NotFound("الموظف غير موجود.");
            return Ok(staff);
        }

        // GET /api/staff/5/availability?date=2026-09-10
        [HttpGet("{id:int}/availability")]
        public async Task<ActionResult<IEnumerable<AvailabilitySlotDto>>> GetAvailability(int id, [FromQuery] DateTime date)
        {
            var dayOfWeek = date.DayOfWeek;

            // 1. جلب فترات العمل المسجلة لهذا اليوم
            var schedules = await _context.StaffSchedules
                .Where(s => s.StaffId == id && s.DayOfWeek == dayOfWeek)
                .ToListAsync();

            if (!schedules.Any()) return Ok(new List<AvailabilitySlotDto>());

            // 2. جلب الحجوزات غير الملغاة لهذا اليوم
            var existingBookings = await _context.Bookings
                .Include(b => b.Service)
                .Where(b => b.StaffId == id && b.DateTime.Date == date.Date && b.Status != "Cancelled")
                .ToListAsync();

            var slots = new List<AvailabilitySlotDto>();

            foreach (var schedule in schedules)
            {
                var current = schedule.StartTime;
                while (current < schedule.EndTime)
                {
                    var slotEnd = current.Add(TimeSpan.FromMinutes(30));
                    var slotStartDateTime = date.Date.Add(current);

                    bool isBooked = existingBookings.Any(b =>
                        b.DateTime < slotStartDateTime.AddMinutes(30) &&
                        b.DateTime.AddMinutes(b.Service.DurationInMinutes) > slotStartDateTime);

                    slots.Add(new AvailabilitySlotDto(current, slotEnd, !isBooked));
                    current = slotEnd;
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

            var existingBookings = await _context.Bookings
                .Where(b => b.StaffId == staff.Id && b.DateTime.Date == request.Date.Date && b.Status != "Cancelled")
                .ToListAsync();

            foreach (var booking in existingBookings)
            {
                booking.Status = "Cancelled";
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = $"تم تسجيل طلب الإجازة ليوم {request.Date:yyyy-MM-dd} وإلغاء {existingBookings.Count} حجز مرتبطة بهذا اليوم.",
                affectedBookings = existingBookings.Count
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
                WorkingHours = dto.WorkingHours
            };

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

            if (dto.IsApproved)
            {
                var affectedBookings = await _context.Bookings
                    .Where(b => b.StaffId == id && b.DateTime.Date == dto.Date.Date && b.Status != "Cancelled")
                    .ToListAsync();

                foreach (var booking in affectedBookings)
                {
                    booking.Status = "Cancelled";
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = $"تمت الموافقة على الإجازة وإلغاء {affectedBookings.Count} حجز مرتبطة بيوم الإجازة." });
            }

            return Ok(new { message = "تم رفض طلب الإجازة." });
        }
    }
}
using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IAiServiceClient _aiServiceClient;

        public AdminController(IApplicationDbContext context, IAiServiceClient aiServiceClient)
        {
            _context = context;
            _aiServiceClient = aiServiceClient;
        }

        // GET /api/admin/dashboard/summary
        [HttpGet("dashboard/summary")]
        public async Task<ActionResult<AdminDashboardSummaryDto>> GetDashboardSummary()
        {
            var today = DateTime.Today;

            var todayBookings = await _context.Bookings
                .Include(b => b.Service)
                .Where(b => b.DateTime.Date == today)
                .ToListAsync();

            int todayCount = todayBookings.Count;
            decimal expectedRevenue = todayBookings.Where(b => b.Status != "Cancelled").Sum(b => b.Service.Price);
            int completedCount = todayBookings.Count(b => b.Status == "Completed");
            int highRiskCount = todayBookings.Count(b => b.NoShowProbability.HasValue && b.NoShowProbability.Value >= 0.7);

            return Ok(new AdminDashboardSummaryDto(
                todayCount,
                expectedRevenue,
                completedCount,
                highRiskCount
            ));
        }

        // GET /api/admin/bookings/live
        [HttpGet("bookings/live")]
        public async Task<IActionResult> GetLiveBookings()
        {
            var now = DateTime.Now;
            var today = DateTime.Today;

            var liveBookings = await _context.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Staff).ThenInclude(s => s.User)
                .Include(b => b.Service)
                .Where(b => b.DateTime.Date == today)
                .OrderBy(b => b.DateTime)
                .Select(b => new
                {
                    b.Id,
                    CustomerName = b.Customer.Name,
                    StaffName = b.Staff.User.Name,
                    ServiceName = b.Service.Name,
                    b.DateTime,
                    b.Status,
                    b.NoShowProbability,
                    IsActiveNow = b.DateTime <= now && b.DateTime.AddMinutes(b.Service.DurationInMinutes) >= now
                })
                .ToListAsync();

            return Ok(liveBookings);
        }

        // GET /api/admin/bookings?status=&date=
        [HttpGet("bookings")]
        public async Task<IActionResult> GetAllBookings([FromQuery] string? status, [FromQuery] DateTime? date)
        {
            var query = _context.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Staff).ThenInclude(s => s.User)
                .Include(b => b.Service)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(b => b.Status.ToLower() == status.ToLower());
            }

            if (date.HasValue)
            {
                query = query.Where(b => b.DateTime.Date == date.Value.Date);
            }

            var bookings = await query
                .OrderByDescending(b => b.DateTime)
                .Select(b => new
                {
                    b.Id,
                    CustomerId = b.CustomerId,
                    CustomerName = b.Customer.Name,
                    StaffId = b.StaffId,
                    StaffName = b.Staff.User.Name,
                    ServiceId = b.ServiceId,
                    ServiceName = b.Service.Name,
                    Price = b.Service.Price,
                    DurationInMinutes = b.Service.DurationInMinutes,
                    b.DateTime,
                    b.Status,
                    b.NoShowProbability
                })
                .ToListAsync();

            return Ok(bookings);
        }

        // PUT /api/admin/bookings/{id}/override
        [HttpPut("bookings/{id:int}/override")]
        public async Task<IActionResult> OverrideBooking(int id, [FromBody] OverrideBookingDto dto)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound("الحجز غير موجود.");

            if (!string.IsNullOrWhiteSpace(dto.Status))
            {
                booking.Status = dto.Status;
            }

            if (dto.NewDateTime.HasValue)
            {
                booking.DateTime = dto.NewDateTime.Value;
            }

            if (dto.NewStaffId.HasValue)
            {
                var staffExists = await _context.StaffMembers.AnyAsync(s => s.Id == dto.NewStaffId.Value);
                if (!staffExists) return BadRequest("الموظف الجديد غير موجود.");
                booking.StaffId = dto.NewStaffId.Value;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "تم تعديل بيانات الحجز يدوياً بواسطة الأدمن بنجاح.", booking });
        }

        // POST /api/admin/ai/business-data
        [HttpPost("ai/business-data")]
        public async Task<IActionResult> UpdateBusinessAiData([FromBody] UpdateBusinessAiDataDto dto)
        {
            var services = await _context.Services
                .AsNoTracking()
                .Where(service => service.IsActive)
                .Select(service => new AiBusinessServiceItem(
                    service.Name,
                    service.BusinessCategory.Name,
                    service.Price,
                    service.Description,
                    service.DurationInMinutes))
                .ToListAsync();

            var policies = string.Join(Environment.NewLine, new[]
            {
                dto.WorkingHoursInfo,
                dto.PolicyInfo,
                dto.CustomInstructions
            }.Where(value => !string.IsNullOrWhiteSpace(value)));

            var updated = await _aiServiceClient.IngestBusinessDataAsync(new AiBusinessDataRequest(
                1, dto.BusinessName, dto.IndustryCategory, services, policies));
            if (!updated)
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "AI knowledge service is temporarily unavailable." });

            var businessInfo = await _context.BusinessInfos.FirstOrDefaultAsync(info => info.Category == "AIConfiguration");
            var content = $"Business: {dto.BusinessName}\nIndustry: {dto.IndustryCategory}\nHours: {dto.WorkingHoursInfo}\nPolicies: {dto.PolicyInfo}\nInstructions: {dto.CustomInstructions}";
            if (businessInfo is null)
                _context.BusinessInfos.Add(new BookFlowAI.Domain.Entities.BusinessInfo { Category = "AIConfiguration", Content = content });
            else
                businessInfo.Content = content;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "تم تحديث بيانات المنشأة والمعلومات المرتبطة بالمساعد الذكي بنجاح.",
                updatedAt = DateTime.Now,
                data = dto,
                indexedServices = services.Count
            });
        }
    }
}

using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/staff")]
public class AdminStaffController : ControllerBase
{
    private readonly IApplicationDbContext _context;

    public AdminStaffController(IApplicationDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminStaffDto>>> GetAll()
    {
        var staff = await LoadStaffQuery().OrderBy(item => item.User.Name).ToListAsync();
        return Ok(staff.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminStaffDto>> GetById(int id)
    {
        var staff = await LoadStaffQuery().FirstOrDefaultAsync(item => item.Id == id);
        return staff is null ? NotFound(new { message = "Staff member not found." }) : Ok(ToDto(staff));
    }

    [HttpPost]
    public async Task<ActionResult<AdminStaffDto>> Create(AdminCreateStaffDto request)
    {
        var validation = Validate(request.Name, request.Email, request.Password, request.Shifts);
        if (validation is not null) return BadRequest(new { message = validation });

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(user => user.Email == email))
            return Conflict(new { message = "A user with this email already exists." });

        var serviceIds = request.ServiceIds.Distinct().ToArray();
        if (await _context.Services.CountAsync(service => serviceIds.Contains(service.Id) && service.IsActive) != serviceIds.Length)
            return BadRequest(new { message = "One or more selected services are invalid or inactive." });

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            PhoneNumber = request.PhoneNumber?.Trim(),
            Role = "Staff"
        };
        var staff = new StaffMember
        {
            User = user,
            Specialties = request.Specialties?.Trim(),
            WorkingHours = DescribeShifts(request.Shifts),
            IsAvailable = request.IsAvailable,
            Schedules = request.Shifts.Select(ToSchedule).ToList(),
            StaffServices = serviceIds.Select(serviceId => new StaffService { ServiceId = serviceId }).ToList()
        };

        _context.StaffMembers.Add(staff);
        await _context.SaveChangesAsync();

        var created = await LoadStaffQuery().SingleAsync(item => item.Id == staff.Id);
        return CreatedAtAction(nameof(GetById), new { id = staff.Id }, ToDto(created));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminStaffDto>> Update(int id, AdminUpdateStaffDto request)
    {
        var validation = Validate(request.Name, request.Email, null, request.Shifts);
        if (validation is not null) return BadRequest(new { message = validation });

        var staff = await LoadStaffQuery().FirstOrDefaultAsync(item => item.Id == id);
        if (staff is null) return NotFound(new { message = "Staff member not found." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _context.Users.AnyAsync(user => user.Id != staff.UserId && user.Email == email))
            return Conflict(new { message = "A user with this email already exists." });

        var serviceIds = request.ServiceIds.Distinct().ToArray();
        if (await _context.Services.CountAsync(service => serviceIds.Contains(service.Id) && service.IsActive) != serviceIds.Length)
            return BadRequest(new { message = "One or more selected services are invalid or inactive." });

        staff.User.Name = request.Name.Trim();
        staff.User.Email = email;
        staff.User.PhoneNumber = request.PhoneNumber?.Trim();
        staff.Specialties = request.Specialties?.Trim();
        staff.IsAvailable = request.IsAvailable;
        staff.WorkingHours = DescribeShifts(request.Shifts);

        _context.StaffSchedules.RemoveRange(staff.Schedules);
        _context.StaffServices.RemoveRange(staff.StaffServices);
        staff.Schedules = request.Shifts.Select(ToSchedule).ToList();
        staff.StaffServices = serviceIds.Select(serviceId => new StaffService { StaffId = id, ServiceId = serviceId }).ToList();
        await _context.SaveChangesAsync();

        var updated = await LoadStaffQuery().SingleAsync(item => item.Id == id);
        return Ok(ToDto(updated));
    }

    [HttpPatch("{id:int}/availability")]
    public async Task<IActionResult> SetAvailability(int id, SetStaffAvailabilityDto request)
    {
        var staff = await _context.StaffMembers.FindAsync(id);
        if (staff is null) return NotFound(new { message = "Staff member not found." });
        staff.IsAvailable = request.IsAvailable;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var staff = await _context.StaffMembers.Include(item => item.User).FirstOrDefaultAsync(item => item.Id == id);
        if (staff is null) return NotFound(new { message = "Staff member not found." });
        if (await _context.Bookings.AnyAsync(booking => booking.StaffId == id))
            return Conflict(new { message = "Staff with booking history cannot be deleted. Mark them unavailable instead." });

        staff.User.Role = "Customer";
        _context.StaffMembers.Remove(staff);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("time-off-requests")]
    public async Task<ActionResult<IEnumerable<AdminTimeOffRequestDto>>> GetTimeOffRequests([FromQuery] string? status = "Pending")
    {
        var query = _context.StaffTimeOffRequests.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(request => request.Status == status);

        return Ok(await query.OrderBy(request => request.Date)
            .Select(request => new AdminTimeOffRequestDto(
                request.Id, request.StaffId, request.Staff.User.Name, request.Date, request.Reason,
                request.Status, request.AdminComment, request.CreatedAt, request.ReviewedAt))
            .ToListAsync());
    }

    [HttpPatch("time-off-requests/{requestId:int}")]
    public async Task<IActionResult> ReviewTimeOffRequest(int requestId, ReviewTimeOffRequestDto dto)
    {
        var request = await _context.StaffTimeOffRequests.FirstOrDefaultAsync(item => item.Id == requestId);
        if (request is null) return NotFound(new { message = "Time-off request not found." });
        if (request.Status != "Pending") return Conflict(new { message = "This request has already been reviewed." });

        request.Status = dto.IsApproved ? "Approved" : "Rejected";
        request.AdminComment = dto.AdminComment?.Trim();
        request.ReviewedAt = DateTime.UtcNow;

        var affectedBookings = new List<Booking>();
        if (dto.IsApproved)
        {
            affectedBookings = await _context.Bookings
                .Where(booking => booking.StaffId == request.StaffId && booking.DateTime.Date == request.Date.Date
                    && booking.Status != "Cancelled")
                .ToListAsync();
            foreach (var booking in affectedBookings) booking.Status = "Cancelled";
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = dto.IsApproved ? "Time off approved." : "Time off rejected.", affectedBookings = affectedBookings.Count });
    }

    private IQueryable<StaffMember> LoadStaffQuery() => _context.StaffMembers
        .Include(item => item.User)
        .Include(item => item.Schedules)
        .Include(item => item.StaffServices).ThenInclude(assignment => assignment.Service)
        .AsSplitQuery();

    private static AdminStaffDto ToDto(StaffMember staff) => new(
        staff.Id,
        staff.UserId,
        staff.User.Name,
        staff.User.Email,
        staff.User.PhoneNumber,
        staff.Specialties,
        staff.IsAvailable,
        staff.StaffServices.OrderBy(item => item.Service.Name)
            .Select(item => new AdminStaffServiceDto(item.ServiceId, item.Service.Name)).ToArray(),
        staff.Schedules.OrderBy(item => item.DayOfWeek).ThenBy(item => item.StartTime)
            .Select(item => new AdminStaffShiftDto(item.Id, item.DayOfWeek, item.StartTime, item.EndTime)).ToArray());

    private static StaffSchedule ToSchedule(StaffShiftInputDto shift) => new()
    {
        DayOfWeek = shift.DayOfWeek,
        StartTime = shift.StartTime,
        EndTime = shift.EndTime
    };

    private static string DescribeShifts(IEnumerable<StaffShiftInputDto> shifts) => string.Join(", ",
        shifts.OrderBy(shift => shift.DayOfWeek).ThenBy(shift => shift.StartTime)
            .Select(shift => $"{shift.DayOfWeek} {shift.StartTime:hh\\:mm}-{shift.EndTime:hh\\:mm}"));

    private static string? Validate(string name, string email, string? password, IReadOnlyCollection<StaffShiftInputDto> shifts)
    {
        if (string.IsNullOrWhiteSpace(name)) return "Name is required.";
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return "A valid email is required.";
        if (password is not null && password.Length < 8) return "Password must be at least 8 characters.";
        if (shifts.Any(shift => shift.StartTime >= shift.EndTime)) return "Every shift must end after it starts.";

        var overlaps = shifts.GroupBy(shift => shift.DayOfWeek).Any(day =>
        {
            var ordered = day.OrderBy(shift => shift.StartTime).ToArray();
            return ordered.Zip(ordered.Skip(1), (current, next) => current.EndTime > next.StartTime).Any(value => value);
        });
        return overlaps ? "Staff shifts cannot overlap." : null;
    }
}

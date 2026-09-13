using System.ComponentModel.DataAnnotations;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using BookFlowAI.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.AspNetCore.SignalR;

namespace BookFlowAI.Api.Controllers;

public class InstaPayBookingForm
{
    [Range(1, int.MaxValue)] public int StaffId { get; set; }
    [Range(1, int.MaxValue)] public int ServiceId { get; set; }
    public DateTime DateTime { get; set; }
    [Required, RegularExpression(@"^[0-9]{12}$")] public string InstaPayRefNumber { get; set; } = "";
    public IFormFile? Receipt { get; set; }
}
public record VerifyInstaPayRequest([property: Required] bool? Approved, [property: StringLength(500)] string? Note);

public partial class BookingsController
{
    private ApplicationDbContext DatabaseContext => (ApplicationDbContext)_context;

    // Serialize all slot writes across API instances with a transaction-owned SQL Server lock.
    private async Task<IDbContextTransaction> BeginSlotTransaction(int staffId)
    {
        var transaction = await DatabaseContext.Database.BeginTransactionAsync();
        try
        {
            var resource = $"bookflow:staff:{staffId}";
            await DatabaseContext.Database.ExecuteSqlInterpolatedAsync($@"
                DECLARE @result int;
                EXEC @result = sp_getapplock @Resource={resource}, @LockMode='Exclusive',
                    @LockOwner='Transaction', @LockTimeout=10000;
                IF @result < 0 THROW 51000, 'Slot lock unavailable. Please retry.', 1;");
            return transaction;
        }
        catch { await transaction.DisposeAsync(); throw; }
    }

    [Authorize(Roles = "Customer")]
    [HttpGet("instapay-settings")]
    public IActionResult InstaPaySettings()
    {
        var configuration = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var recipient = configuration["InstaPay:Recipient"];
        return Ok(new { recipient, currency = "EGP", lockMinutes = 30, enabled = !string.IsNullOrWhiteSpace(recipient) });
    }

    [Authorize(Roles = "Customer")]
    [HttpPost("instapay")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<IActionResult> CreateInstaPay([FromForm] InstaPayBookingForm request)
    {
        var config = HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        if (string.IsNullOrWhiteSpace(config["InstaPay:Recipient"]))
            return StatusCode(503, new { message = "InstaPay recipient is not configured." });
        if (request.Receipt != null && !await ValidReceipt(request.Receipt))
            return BadRequest(new { message = "Upload a PNG or JPEG image up to 5 MB." });
        return await CreateBookingCore(new CreateBookingDto(request.StaffId, request.ServiceId, request.DateTime), request.InstaPayRefNumber, request.Receipt);
    }

    private static async Task<bool> ValidReceipt(IFormFile file)
    {
        if (file.Length == 0 || file.Length > 5 * 1024 * 1024) return false;
        var header = new byte[8];
        await using var stream = file.OpenReadStream();
        if (await stream.ReadAsync(header) < 8) return false;
        return (file.ContentType == "image/png" && header.SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}))
            || (file.ContentType == "image/jpeg" && header[0] == 255 && header[1] == 216 && header[2] == 255);
    }

    private string ReceiptDirectory
    {
        get
        {
            var root = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().ContentRootPath;
            var configured = HttpContext.RequestServices.GetRequiredService<IConfiguration>()["InstaPay:ReceiptStoragePath"] ?? "App_Data/receipts";
            return Path.GetFullPath(Path.IsPathRooted(configured) ? configured : Path.Combine(root, configured));
        }
    }

    private async Task<string> StoreReceipt(IFormFile receipt)
    {
        Directory.CreateDirectory(ReceiptDirectory);
        var name = Guid.NewGuid().ToString("N") + (receipt.ContentType == "image/png" ? ".png" : ".jpg");
        await using var output = System.IO.File.Create(Path.Combine(ReceiptDirectory, name));
        await receipt.CopyToAsync(output);
        return $"/api/bookings/instapay-receipts/{name}";
    }

    [HttpGet("instapay-receipts/{name}")]
    public async Task<IActionResult> Receipt(string name)
    {
        if (!TryGetCurrentUserId(out var userId)) return Unauthorized();
        if (name != Path.GetFileName(name)) return BadRequest();
        var url = $"/api/bookings/instapay-receipts/{name}";
        if (!await _context.Bookings.AnyAsync(b => b.ReceiptImageUrl == url && (b.CustomerId == userId || User.IsInRole("Admin")))) return NotFound();
        var path = Path.Combine(ReceiptDirectory, name);
        if (!System.IO.File.Exists(path)) return NotFound();
        Response.Headers.CacheControl = "no-store";
        return PhysicalFile(path, name.EndsWith(".png") ? "image/png" : "image/jpeg");
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("/api/admin/instapay-pending")]
    public async Task<IActionResult> PendingInstaPay() => Ok(await _context.Bookings.AsNoTracking()
        .Where(b => b.PaymentStatus == PaymentStatus.PendingInstaPay && b.Status != "Cancelled" && b.LockExpiresAt > DateTime.UtcNow)
        .OrderBy(b => b.LockExpiresAt)
        .Select(b => new { b.Id, CustomerName = b.Customer.Name, b.CustomerId, StaffName = b.Staff.User.Name,
            ServiceName = b.Service.Name, b.DateTime, Price = b.Service.Price, b.InstaPayRefNumber, b.ReceiptImageUrl, b.LockExpiresAt })
        .ToListAsync());

    [Authorize(Roles = "Admin")]
    [HttpPost("/api/admin/bookings/{id:int}/verify-instapay")]
    public async Task<IActionResult> VerifyInstaPay(int id, [FromBody] VerifyInstaPayRequest request)
    {
        if (!TryGetCurrentUserId(out var adminId)) return Unauthorized();
        var staffId = await _context.Bookings.Where(b => b.Id == id).Select(b => (int?)b.StaffId).FirstOrDefaultAsync();
        if (staffId == null) return NotFound();
        await using var transaction = await BeginSlotTransaction(staffId.Value);
        var approved = request.Approved == true;
        var status = approved ? "Confirmed" : "Cancelled";
        var paymentStatus = approved ? PaymentStatus.Confirmed : PaymentStatus.Rejected;
        var now = DateTime.UtcNow;
        var changed = await _context.Bookings.Where(b => b.Id == id && b.PaymentStatus == PaymentStatus.PendingInstaPay
            && b.Status == "PendingInstaPay" && b.LockExpiresAt > now)
            .ExecuteUpdateAsync(set => set.SetProperty(b => b.Status, status).SetProperty(b => b.PaymentStatus, (PaymentStatus?)paymentStatus)
                .SetProperty(b => b.LockExpiresAt, (DateTime?)null).SetProperty(b => b.PaymentVerificationNote, request.Note)
                .SetProperty(b => b.PaymentVerifiedAt, (DateTime?)now).SetProperty(b => b.PaymentVerifiedBy, (int?)adminId));
        if (changed == 0) return Conflict(new { message = "This payment has already been reviewed, cancelled, or expired." });
        await transaction.CommitAsync();
        var booking = await _context.Bookings.AsNoTracking().SingleAsync(b => b.Id == id);
        var message = approved ? "Your InstaPay payment and booking have been confirmed." : "Your InstaPay payment was rejected and your booking was cancelled. Contact support about your transfer.";
        await NotifyBookingStatusChange(id, booking.StaffId, status, message);
        await _hubContext.Clients.Group($"Customer_{booking.CustomerId}").SendAsync("ReceiveBookingUpdate",
            new { BookingId = id, booking.StaffId, Status = status, PaymentStatus = paymentStatus.ToString(), Message = message, Timestamp = now });
        return Ok(new { message, status, paymentStatus = paymentStatus.ToString() });
    }
}

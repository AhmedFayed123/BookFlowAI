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
    [Route("api/reviews")]
    public class ReviewsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public ReviewsController(IApplicationDbContext context)
        {
            _context = context;
        }

        // POST /api/reviews
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> CreateReview([FromBody] CreateReviewDto request)
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("sub")?.Value;
            var customerId = int.Parse(userIdClaim!);

            var booking = await _context.Bookings
                .FirstOrDefaultAsync(b => b.Id == request.BookingId && b.CustomerId == customerId);

            if (booking == null) return BadRequest("الحجز غير موجود أو لا يخصك.");
            if (booking.Status != "Completed") return BadRequest("يمكنك إعطاء تقييم فقط للحجوزات المكتملة.");

            var existingReview = await _context.Reviews.AnyAsync(r => r.BookingId == request.BookingId);
            if (existingReview) return BadRequest("لقد قمت بتقييم هذا الحجز مسبقاً.");

            var review = new Review
            {
                BookingId = request.BookingId,
                Rating = request.Rating,
                Comment = request.Comment
            };

            _context.Reviews.Add(review);
            await _context.SaveChangesAsync();

            return Ok(new { message = "تم إرسال التقييم بنجاح." });
        }

        // GET /api/reviews/staff/{staffId}
        [HttpGet("staff/{staffId}")]
        public async Task<ActionResult<IEnumerable<ReviewDto>>> GetStaffReviews(int staffId)
        {
            var reviews = await _context.Reviews
                .Include(r => r.Booking).ThenInclude(b => b.Customer)
                .Where(r => r.Booking.StaffId == staffId)
                .Select(r => new ReviewDto(
                    r.Id,
                    r.BookingId,
                    r.Booking.Customer.Name,
                    r.Rating,
                    r.Comment))
                .ToListAsync();

            return Ok(reviews);
        }
    }
}
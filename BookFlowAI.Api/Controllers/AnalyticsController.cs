using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/analytics")]
    public class AnalyticsController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public AnalyticsController(IApplicationDbContext context)
        {
            _context = context;
        }

        // GET /api/analytics/summary
        [HttpGet("summary")]
        public async Task<ActionResult<AnalyticsSummaryDto>> GetSummary()
        {
            var totalBookings = await _context.Bookings.CountAsync();
            var cancelledBookings = await _context.Bookings.CountAsync(b => b.Status == "Cancelled");

            var totalRevenue = await _context.Bookings
                .Where(b => b.Status == "Completed" || b.Status == "Confirmed")
                .SumAsync(b => b.Service.Price);

            double cancellationRate = totalBookings > 0
                ? (double)cancelledBookings / totalBookings * 100
                : 0;

            return Ok(new AnalyticsSummaryDto(
                totalRevenue,
                totalBookings,
                cancelledBookings,
                Math.Round(cancellationRate, 2)
            ));
        }

        // GET /api/analytics/services-performance
        [HttpGet("services-performance")]
        public async Task<ActionResult<IEnumerable<ServicePerformanceDto>>> GetServicesPerformance()
        {
            var performance = await _context.Bookings
                .Include(b => b.Service)
                .GroupBy(b => new { b.ServiceId, b.Service.Name })
                .Select(g => new ServicePerformanceDto(
                    g.Key.ServiceId,
                    g.Key.Name,
                    g.Count(),
                    g.Where(b => b.Status == "Completed" || b.Status == "Confirmed").Sum(b => b.Service.Price)
                ))
                .OrderByDescending(p => p.TotalBookings)
                .ToListAsync();

            return Ok(performance);
        }

        // GET /api/analytics/peak-hours
        [HttpGet("peak-hours")]
        public async Task<ActionResult<IEnumerable<PeakHourDto>>> GetPeakHours()
        {
            var bookings = await _context.Bookings.ToListAsync();

            var peakHours = bookings
                .GroupBy(b => b.DateTime.Hour)
                .Select(g => new PeakHourDto(
                    g.Key,
                    $"{g.Key:D2}:00 - {g.Key + 1:D2}:00",
                    g.Count()
                ))
                .OrderByDescending(p => p.BookingCount)
                .ToList();

            return Ok(peakHours);
        }

        // GET /api/analytics/no-show-rate
        [HttpGet("no-show-rate")]
        public async Task<ActionResult<NoShowRateDto>> GetNoShowRate()
        {
            var totalBookings = await _context.Bookings.CountAsync();
            var noShowCount = await _context.Bookings.CountAsync(b => b.Status == "NoShow");
            var highRiskCount = await _context.Bookings.CountAsync(b => b.NoShowProbability.HasValue && b.NoShowProbability.Value >= 0.7);

            double rate = totalBookings > 0
                ? (double)noShowCount / totalBookings * 100
                : 0;

            return Ok(new NoShowRateDto(
                Math.Round(rate, 2),
                noShowCount,
                highRiskCount
            ));
        }
    }
}
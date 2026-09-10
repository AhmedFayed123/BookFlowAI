namespace BookFlowAI.Application.DTOs
{
    // Dashboard & Live Bookings
    public record AdminDashboardSummaryDto(
        int TodayBookingsCount,
        decimal ExpectedRevenueToday,
        int CompletedBookingsToday,
        int HighRiskNoShowsCount
    );

    // Services Management
    public record CreateServiceDto(
        string Name,
        string Description,
        decimal Price,
        int DurationInMinutes
    );

    public record UpdateServiceDto(
        string Name,
        string Description,
        decimal Price,
        int DurationInMinutes,
        bool IsActive
    );

    // Staff Management
    public record CreateStaffDto(
        int UserId,
        string Specialties,
        string WorkingHours
    );

    public record UpdateStaffDto(
        string Specialties,
        string WorkingHours
    );

    public record SetStaffScheduleDto(
        DayOfWeek DayOfWeek,
        TimeSpan StartTime,
        TimeSpan EndTime
    );

    public record ApproveDayOffDto(
        DateTime Date,
        bool IsApproved,
        string? AdminComment
    );

    // Admin Booking Override
    public record OverrideBookingDto(
        string Status, // Confirmed, Cancelled, Completed, Rescheduled
        DateTime? NewDateTime,
        int? NewStaffId
    );

    // Analytics
    public record AnalyticsSummaryDto(
        decimal TotalRevenue,
        int TotalBookings,
        int CancelledBookings,
        double CancellationRatePercentage
    );

    public record ServicePerformanceDto(
        int ServiceId,
        string ServiceName,
        int TotalBookings,
        decimal TotalRevenueGenerated
    );

    public record PeakHourDto(
        int Hour24,
        string DisplayHour,
        int BookingCount
    );

    public record NoShowRateDto(
        double OverallNoShowRatePercentage,
        int TotalNoShowCount,
        int HighRiskPredictionsCount
    );

    // AI Business Data
    public record UpdateBusinessAiDataDto(
        string BusinessName,
        string WorkingHoursInfo,
        string PolicyInfo,
        string ServicesSummary,
        string CustomInstructions
    );
}
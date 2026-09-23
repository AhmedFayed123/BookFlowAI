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
        int BusinessCategoryId,
        string Name,
        string Description,
        decimal Price,
        int DurationInMinutes,
        string? ImageUrl = null
    );

    public record UpdateServiceDto(
        int BusinessCategoryId,
        string Name,
        string Description,
        decimal Price,
        int DurationInMinutes,
        bool IsActive,
        string? ImageUrl = null
    );

    // Staff Management (legacy DTOs retained for /api/staff compatibility)
    public record CreateStaffDto(int UserId, string Specialties, string WorkingHours);
    public record UpdateStaffDto(string Specialties, string WorkingHours);

    public record StaffShiftInputDto(
        DayOfWeek DayOfWeek,
        TimeSpan StartTime,
        TimeSpan EndTime
    );

    public record AdminCreateStaffDto(
        string Name,
        string Email,
        string Password,
        string? PhoneNumber,
        string? Specialties,
        bool IsAvailable,
        IReadOnlyCollection<int> ServiceIds,
        IReadOnlyCollection<StaffShiftInputDto> Shifts
    );

    public record AdminUpdateStaffDto(
        string Name,
        string Email,
        string? PhoneNumber,
        string? Specialties,
        bool IsAvailable,
        IReadOnlyCollection<int> ServiceIds,
        IReadOnlyCollection<StaffShiftInputDto> Shifts
    );

    public record AdminStaffServiceDto(int Id, string Name);
    public record AdminStaffShiftDto(int Id, DayOfWeek DayOfWeek, TimeSpan StartTime, TimeSpan EndTime);
    public record AdminStaffDto(
        int Id,
        int UserId,
        string Name,
        string Email,
        string? PhoneNumber,
        string? Specialties,
        bool IsAvailable,
        IReadOnlyCollection<AdminStaffServiceDto> Services,
        IReadOnlyCollection<AdminStaffShiftDto> Shifts
    );

    public record SetStaffAvailabilityDto(bool IsAvailable);

    // Dynamic business categories
    public record CreateBusinessCategoryDto(string Name, string? Slug, string? Description);
    public record UpdateBusinessCategoryDto(string Name, string? Slug, string? Description, bool IsActive);

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

    public record ReviewTimeOffRequestDto(bool IsApproved, string? AdminComment);

    public record AdminTimeOffRequestDto(
        int Id,
        int StaffId,
        string StaffName,
        DateTime Date,
        string? Reason,
        string Status,
        string? AdminComment,
        DateTime CreatedAt,
        DateTime? ReviewedAt
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
        string? IndustryCategory,
        string WorkingHoursInfo,
        string PolicyInfo,
        string ServicesSummary,
        string CustomInstructions
    );

    public record KnowledgeDocumentDto(
        int Id,
        string Title,
        string SourceType,
        string SourceName,
        int ChunkCount,
        DateTime CreatedAt,
        DateTime UpdatedAt
    );

    public record KnowledgeUploadRequestDto(
        string? Title,
        string? Content,
        string? SourceName
    );
}

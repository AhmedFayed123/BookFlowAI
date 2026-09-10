namespace BookFlowAI.Application.DTOs
{
    public record StaffScheduleDto(
        int Id,
        DayOfWeek DayOfWeek,
        TimeSpan StartTime,
        TimeSpan EndTime
    );

    public record StaffBookingItemDto(
        int Id,
        int CustomerId,
        string CustomerName,
        string CustomerPhone,
        int ServiceId,
        string ServiceName,
        int DurationInMinutes,
        decimal Price,
        DateTime DateTime,
        string Status,
        double? NoShowProbability
    );

    public record RequestDayOffDto(
        DateTime Date,
        string? Reason
    );
}
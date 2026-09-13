namespace BookFlowAI.Application.DTOs
{
    // ==========================================
    // 1. Home & Services DTOs
    // ==========================================
    public record ServiceDto(
        int Id,
        string Name,
        string Description,
        decimal Price,
        int DurationInMinutes,
        int BusinessCategoryId = 0,
        string BusinessCategoryName = "Uncategorized",
        bool IsActive = true,
        int BookingCount = 0
    );

    public record BusinessCategoryDto(
        int Id,
        string Name,
        string Slug,
        string Description,
        bool IsActive
    );

    public record StaffProfileDto(
        int Id,
        int UserId,
        string Name,
        string Email,
        string? PhoneNumber,
        string Specialties,
        string WorkingHours,
        double AverageRating,
        bool IsAvailable = true,
        IReadOnlyCollection<AdminStaffServiceDto>? Services = null
    );

    public record BusinessInfoDto(
        int Id,
        string Category,
        string Content
    );

    // ==========================================
    // 2. Booking DTOs
    // ==========================================
    public record CreateBookingDto(
        int StaffId,
        int ServiceId,
        DateTime DateTime
    );

    public record RescheduleBookingDto(
        DateTime NewDateTime
    );

    public record BookingDetailDto(
        int Id,
        int ServiceId,
        string ServiceName,
        int StaffId,
        string StaffName,
        DateTime DateTime,
        int DurationInMinutes,
        decimal Price,
        string Status,
        double? NoShowProbability,
        string? PaymentStatus = null,
        string? InstaPayRefNumber = null,
        string? ReceiptImageUrl = null,
        DateTime? LockExpiresAt = null,
        string? PaymentVerificationNote = null
    );

    public record AvailabilitySlotDto(
        TimeSpan StartTime,
        TimeSpan EndTime,
        bool IsAvailable
    );

    // ==========================================
    // 3. Reviews DTOs
    // ==========================================
    public record CreateReviewDto(
        int BookingId,
        int Rating,
        string? Comment
    );

    public record ReviewDto(
        int Id,
        int BookingId,
        string CustomerName,
        int Rating,
        string? Comment
    );

    // ==========================================
    // 4. AI Chat DTOs (تم تحديثها لتتوافق مع الـ AI Controller)
    // ==========================================
    public record ChatMessageItemDto(
        string Role,
        string Content
    );

    public record ChatRequestDto(
        string Message,
        int BusinessId = 1,
        string? SessionId = null,
        List<ChatMessageItemDto>? ConversationHistory = null
    );

    public record ChatResponseDto(
        string Reply,
        string? SessionId,
        bool SourceUsed,
        bool IsFallback,
        DateTime Timestamp
    );
}

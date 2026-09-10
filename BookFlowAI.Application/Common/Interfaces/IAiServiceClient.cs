namespace BookFlowAI.Application.Common.Interfaces
{
    // =========================================================================
    // No-Show Prediction DTOs
    // =========================================================================
    public record AiPredictRequest(
        int CustomerId,
        int TotalPastBookings,
        int PastNoShowsCount,
        int PastCancellationsCount,
        int LeadTimeDays,
        int BookingHour,
        int BookingDayOfWeek,
        bool IsWeekend,
        bool IsHoliday,
        int? DaysSinceLastNoShow
    );

    public record AiPredictResponse(
        double Probability,
        string RiskLevel,
        string ModelVersion,
        bool IsFallback
    );

    // =========================================================================
    // RAG & Chatbot DTOs
    // =========================================================================
    public record ChatMessageDto(
        string Role,
        string Content
    );

    public record AiChatClientRequest(
        int BusinessId,
        string? SessionId,
        string Message,
        List<ChatMessageDto>? ConversationHistory = null
    );

    public record AiChatClientResponse(
        string Reply,
        string? SessionId,
        bool SourceUsed,
        bool IsFallback
    );

    // =========================================================================
    // Interface
    // =========================================================================
    public interface IAiServiceClient
    {
        Task<AiPredictResponse?> PredictNoShowAsync(AiPredictRequest request);
        Task<AiChatClientResponse?> SendChatMessageAsync(AiChatClientRequest request);
    }
}
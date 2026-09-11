using System.Net.Http.Json;
using System.Text.Json;
using BookFlowAI.Application.Common.Interfaces;

namespace BookFlowAI.Infrastructure.Services
{
    public class AiServiceClient : IAiServiceClient
    {
        private readonly HttpClient _httpClient;

        // خيارات تحويل JSON لتتوافق تلقائياً مع نمط snake_case المتبع في Python FastAPI
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            PropertyNameCaseInsensitive = true
        };

        public AiServiceClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<AiPredictResponse?> PredictNoShowAsync(AiPredictRequest request)
        {
            try
            {
                var payload = new
                {
                    customer_id = request.CustomerId,
                    total_past_bookings = request.TotalPastBookings,
                    past_no_shows_count = request.PastNoShowsCount,
                    past_cancellations_count = request.PastCancellationsCount,
                    lead_time_days = request.LeadTimeDays,
                    booking_hour = request.BookingHour,
                    booking_day_of_week = request.BookingDayOfWeek,
                    is_weekend = request.IsWeekend,
                    is_holiday = request.IsHoliday,
                    days_since_last_no_show = request.DaysSinceLastNoShow
                };

                var response = await _httpClient.PostAsJsonAsync("/predict-no-show", payload);

                if (!response.IsSuccessStatusCode)
                    return new AiPredictResponse(0.20, "Low", "2.0.0", true);

                return await response.Content.ReadFromJsonAsync<AiPredictResponse>(_jsonOptions);
            }
            catch
            {
                return new AiPredictResponse(0.20, "Low", "2.0.0", true);
            }
        }

        public async Task<AiChatClientResponse?> SendChatMessageAsync(AiChatClientRequest request)
        {
            try
            {
                var payload = new
                {
                    business_id = request.BusinessId,
                    session_id = request.SessionId,
                    message = request.Message,
                    conversation_history = request.ConversationHistory?.Select(h => new
                    {
                        role = h.Role,
                        content = h.Content
                    })
                };

                var response = await _httpClient.PostAsJsonAsync("/chat", payload);

                if (!response.IsSuccessStatusCode)
                {
                    return new AiChatClientResponse(
                        Reply: "عذراً، خدمة المساعد الذكي غير متاحة حالياً.",
                        SessionId: request.SessionId,
                        SourceUsed: false,
                        IsFallback: true
                    );
                }

                return await response.Content.ReadFromJsonAsync<AiChatClientResponse>(_jsonOptions);
            }
            catch
            {
                return new AiChatClientResponse(
                    Reply: "حدث خطأ أثناء التواصل مع خدمة الذكاء الاصطناعي.",
                    SessionId: request.SessionId,
                    SourceUsed: false,
                    IsFallback: true
                );
            }
        }

        public async Task<bool> IngestBusinessDataAsync(AiBusinessDataRequest request)
        {
            var payload = new
            {
                business_id = request.BusinessId,
                business_name = request.BusinessName,
                business_category = request.BusinessCategory,
                services = request.Services.Select(service => new
                {
                    name = service.Name,
                    category = service.Category,
                    price = service.Price,
                    description = service.Description,
                    duration_minutes = service.DurationMinutes
                }),
                policies = request.Policies
            };

            try
            {
                using var response = await _httpClient.PostAsJsonAsync("/ingest-business-data", payload);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}

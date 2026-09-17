using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/ai/chat")]
    public class AiChatController : ControllerBase
    {
        private readonly IAiServiceClient _aiServiceClient;
        private readonly IApplicationDbContext _context;

        public AiChatController(IAiServiceClient aiServiceClient, IApplicationDbContext context)
        {
            _aiServiceClient = aiServiceClient;
            _context = context;
        }

        // POST /api/ai/chat
        [HttpPost]
        public async Task<ActionResult<ChatResponseDto>> SendMessage([FromBody] ChatRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("الرسالة لا يمكن أن تكون فارغة.");
            }

            int businessId = request.BusinessId > 0 ? request.BusinessId : 1;

            var guidedReply = await GetGuidedReplyAsync(request.Message);
            if (guidedReply is not null)
            {
                return Ok(new ChatResponseDto(
                    Reply: guidedReply,
                    SessionId: request.SessionId,
                    SourceUsed: true,
                    IsFallback: false,
                    Timestamp: DateTime.UtcNow
                ));
            }

            var historyDtos = request.ConversationHistory?
                .Select(h => new ChatMessageDto(h.Role, h.Content))
                .ToList();

            var aiClientRequest = new AiChatClientRequest(
                BusinessId: businessId,
                SessionId: request.SessionId,
                Message: request.Message,
                ConversationHistory: historyDtos
            );

            var aiResponse = await _aiServiceClient.SendChatMessageAsync(aiClientRequest);

            string replyMessage = aiResponse?.Reply
                ?? "عذراً، حدث خطأ أثناء التواصل مع خدمة الذكاء الاصطناعي. يرجى المحاولة لاحقاً.";

            return Ok(new ChatResponseDto(
                Reply: replyMessage,
                SessionId: aiResponse?.SessionId ?? request.SessionId,
                SourceUsed: aiResponse?.SourceUsed ?? false,
                IsFallback: aiResponse?.IsFallback ?? true,
                Timestamp: DateTime.UtcNow
            ));
        }

        private async Task<string?> GetGuidedReplyAsync(string message)
        {
            var normalized = message.Trim().ToLowerInvariant();
            var arabic = normalized.Any(character => character is >= '\u0600' and <= '\u06ff');

            // Intent order matters: "book without payment" is about payment, while
            // "cancel a booking" is about cancellation rather than booking steps.
            if (ContainsAny(normalized,
                "payment", "pay", "instapay", "without immediate payment", "without paying",
                "دفع", "ادفع", "إنستاباي", "انستاباي", "بدون دفع"))
            {
                return arabic
                    ? "لا يمكن تثبيت موعد بدون دفع. حوّل قيمة الخدمة عبر InstaPay ثم أرسل الرقم المرجعي المكوّن من 12 رقمًا؛ عندها يُحجز الموعد لمدة 30 دقيقة حتى يراجع الأدمن التحويل. إذا رُفض الدفع أو انتهت المهلة، تواصل مع الدعم قبل التحويل مرة أخرى."
                    : "A slot cannot be held without payment. Transfer the service price through InstaPay, then submit the 12-digit transfer reference. The slot is held for 30 minutes while an admin verifies it. If verification is rejected or expires, contact support before paying again.";
            }

            if (ContainsAny(normalized,
                "cancel", "cancellation", "reschedule", "change my booking", "change a booking", "modify booking",
                "إلغاء", "الغاء", "ألغي", "الغي", "تعديل الحجز", "تغيير الحجز", "تغيير الموعد", "إعادة جدولة", "اعادة جدولة"))
            {
                return arabic
                    ? "افتح «حجوزاتي» ثم افتح الحجز المطلوب. يمكنك إلغاء الحجز النشط من هناك. إعادة الجدولة متاحة للحجوزات غير المرتبطة بدفع؛ أما حجز InstaPay فيجب إلغاؤه وإنشاء حجز جديد، مع التواصل مع الدعم بخصوص التحويل قبل الدفع مرة أخرى."
                    : "Open My Bookings, then open the booking you want to manage. You can cancel an active booking there. Rescheduling is available for bookings without a payment record; for an InstaPay booking, cancel it and create a new booking, and contact support about the transfer before paying again.";
            }

            if (ContainsAny(normalized,
                "services", "service available", "what do you offer", "available treatments",
                "الخدمات", "خدمات متاحة", "الخدمات المتاحة", "بتقدموا ايه", "تقدمون"))
            {
                var services = await _context.Services.AsNoTracking()
                    .Where(service => service.IsActive)
                    .OrderBy(service => service.Name)
                    .Select(service => new { service.Name, service.Price, service.DurationInMinutes })
                    .ToListAsync();

                if (services.Count == 0)
                    return arabic ? "لا توجد خدمات متاحة للحجز حاليًا." : "There are no services available to book right now.";

                var lines = services.Select(service =>
                    $"- **{service.Name}** — EGP {service.Price:0.00}, {service.DurationInMinutes} minutes");
                var heading = arabic ? "الخدمات المتاحة حاليًا:" : "Services currently available:";
                return $"{heading}\n{string.Join("\n", lines)}";
            }

            if (ContainsAny(normalized,
                "how to book", "book an appointment", "make a booking", "reserve an appointment",
                "كيف أحجز", "كيف احجز", "حجز موعد", "احجز موعد"))
            {
                return arabic
                    ? "للحجز: اختر الخدمة من الصفحة الرئيسية، ثم مقدم الخدمة والموعد المتاح. راجع التفاصيل، وحوّل قيمة الخدمة عبر InstaPay، ثم أرسل الرقم المرجعي المكوّن من 12 رقمًا. سيُحجز الموعد لمدة 30 دقيقة حتى يتم التحقق من الدفع."
                    : "To book: choose a service on the home page, select a provider and an available time, then review the details. Transfer the service price through InstaPay and submit the 12-digit reference; the slot will be held for 30 minutes while payment is verified.";
            }

            return null;
        }

        private static bool ContainsAny(string message, params string[] phrases) =>
            phrases.Any(message.Contains);

        [HttpPost("predict-no-show")]
        public async Task<ActionResult<AiPredictResponse>> PredictNoShow([FromBody] AiPredictRequest request)
        {
            var prediction = await _aiServiceClient.PredictNoShowAsync(request);

            if (prediction == null)
            {
                return Ok(new AiPredictResponse(0.2d, "Low", "fallback", true));
            }

            return Ok(prediction);
        }
    }
}

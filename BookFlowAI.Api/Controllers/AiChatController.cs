using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BookFlowAI.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/ai/chat")]
    public class AiChatController : ControllerBase
    {
        private readonly IAiServiceClient _aiServiceClient;

        public AiChatController(IAiServiceClient aiServiceClient)
        {
            _aiServiceClient = aiServiceClient;
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
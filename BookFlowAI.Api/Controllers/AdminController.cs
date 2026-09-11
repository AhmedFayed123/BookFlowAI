using System.Text;
using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using DocumentFormat.OpenXml.Packaging;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace BookFlowAI.Api.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IAiServiceClient _aiServiceClient;
        private readonly IEmbeddingService _embeddingService;

        public AdminController(IApplicationDbContext context, IAiServiceClient aiServiceClient, IEmbeddingService embeddingService)
        {
            _context = context;
            _aiServiceClient = aiServiceClient;
            _embeddingService = embeddingService;
        }

        // GET /api/admin/dashboard/summary
        [HttpGet("dashboard/summary")]
        public async Task<ActionResult<AdminDashboardSummaryDto>> GetDashboardSummary()
        {
            var today = DateTime.Today;

            var todayBookings = await _context.Bookings
                .Include(b => b.Service)
                .Where(b => b.DateTime.Date == today)
                .ToListAsync();

            int todayCount = todayBookings.Count;
            decimal expectedRevenue = todayBookings.Where(b => b.Status != "Cancelled").Sum(b => b.Service.Price);
            int completedCount = todayBookings.Count(b => b.Status == "Completed");
            int highRiskCount = todayBookings.Count(b => b.NoShowProbability.HasValue && b.NoShowProbability.Value >= 0.7);

            return Ok(new AdminDashboardSummaryDto(
                todayCount,
                expectedRevenue,
                completedCount,
                highRiskCount
            ));
        }

        // GET /api/admin/bookings/live
        [HttpGet("bookings/live")]
        public async Task<IActionResult> GetLiveBookings()
        {
            var now = DateTime.Now;
            var today = DateTime.Today;

            var liveBookings = await _context.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Staff).ThenInclude(s => s.User)
                .Include(b => b.Service)
                .Where(b => b.DateTime.Date == today)
                .OrderBy(b => b.DateTime)
                .Select(b => new
                {
                    b.Id,
                    CustomerName = b.Customer.Name,
                    StaffName = b.Staff.User.Name,
                    ServiceName = b.Service.Name,
                    b.DateTime,
                    b.Status,
                    b.NoShowProbability,
                    IsActiveNow = b.DateTime <= now && b.DateTime.AddMinutes(b.Service.DurationInMinutes) >= now
                })
                .ToListAsync();

            return Ok(liveBookings);
        }

        // GET /api/admin/bookings?status=&date=
        [HttpGet("bookings")]
        public async Task<IActionResult> GetAllBookings([FromQuery] string? status, [FromQuery] DateTime? date)
        {
            var query = _context.Bookings
                .Include(b => b.Customer)
                .Include(b => b.Staff).ThenInclude(s => s.User)
                .Include(b => b.Service)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(b => b.Status.ToLower() == status.ToLower());
            }

            if (date.HasValue)
            {
                query = query.Where(b => b.DateTime.Date == date.Value.Date);
            }

            var bookings = await query
                .OrderByDescending(b => b.DateTime)
                .Select(b => new
                {
                    b.Id,
                    CustomerId = b.CustomerId,
                    CustomerName = b.Customer.Name,
                    StaffId = b.StaffId,
                    StaffName = b.Staff.User.Name,
                    ServiceId = b.ServiceId,
                    ServiceName = b.Service.Name,
                    Price = b.Service.Price,
                    DurationInMinutes = b.Service.DurationInMinutes,
                    b.DateTime,
                    b.Status,
                    b.NoShowProbability
                })
                .ToListAsync();

            return Ok(bookings);
        }

        // PUT /api/admin/bookings/{id}/override
        [HttpPut("bookings/{id:int}/override")]
        public async Task<IActionResult> OverrideBooking(int id, [FromBody] OverrideBookingDto dto)
        {
            var booking = await _context.Bookings.FindAsync(id);
            if (booking == null) return NotFound("الحجز غير موجود.");

            if (!string.IsNullOrWhiteSpace(dto.Status))
            {
                booking.Status = dto.Status;
            }

            if (dto.NewDateTime.HasValue)
            {
                booking.DateTime = dto.NewDateTime.Value;
            }

            if (dto.NewStaffId.HasValue)
            {
                var staffExists = await _context.StaffMembers.AnyAsync(s => s.Id == dto.NewStaffId.Value);
                if (!staffExists) return BadRequest("الموظف الجديد غير موجود.");
                booking.StaffId = dto.NewStaffId.Value;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "تم تعديل بيانات الحجز يدوياً بواسطة الأدمن بنجاح.", booking });
        }

        // POST /api/admin/ai/business-data
        [HttpPost("ai/business-data")]
        public async Task<IActionResult> UpdateBusinessAiData([FromBody] UpdateBusinessAiDataDto dto)
        {
            var services = await _context.Services
                .AsNoTracking()
                .Where(service => service.IsActive)
                .Select(service => new AiBusinessServiceItem(
                    service.Name,
                    service.BusinessCategory.Name,
                    service.Price,
                    service.Description,
                    service.DurationInMinutes))
                .ToListAsync();

            var policies = string.Join(Environment.NewLine, new[]
            {
                dto.WorkingHoursInfo,
                dto.PolicyInfo,
                dto.CustomInstructions
            }.Where(value => !string.IsNullOrWhiteSpace(value)));

            var updated = await _aiServiceClient.IngestBusinessDataAsync(new AiBusinessDataRequest(
                1, dto.BusinessName, dto.IndustryCategory, services, policies));
            if (!updated)
                return StatusCode(StatusCodes.Status503ServiceUnavailable,
                    new { message = "AI knowledge service is temporarily unavailable." });

            var businessInfo = await _context.BusinessInfos.FirstOrDefaultAsync(info => info.Category == "AIConfiguration");
            var content = $"Business: {dto.BusinessName}\nIndustry: {dto.IndustryCategory}\nHours: {dto.WorkingHoursInfo}\nPolicies: {dto.PolicyInfo}\nInstructions: {dto.CustomInstructions}";
            if (businessInfo is null)
                _context.BusinessInfos.Add(new BookFlowAI.Domain.Entities.BusinessInfo { Category = "AIConfiguration", Content = content });
            else
                businessInfo.Content = content;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "تم تحديث بيانات المنشأة والمعلومات المرتبطه بالمساعد الذكي بنجاح.",
                updatedAt = DateTime.Now,
                data = dto,
                indexedServices = services.Count
            });
        }

        // GET /api/admin/knowledge
        [HttpGet("knowledge")]
        public async Task<ActionResult<IEnumerable<KnowledgeDocumentDto>>> GetKnowledgeDocuments()
        {
            var documents = await _context.KnowledgeDocuments
                .AsNoTracking()
                .OrderByDescending(document => document.CreatedAt)
                .Select(document => new KnowledgeDocumentDto(
                    document.Id,
                    document.Title,
                    document.SourceType,
                    document.SourceName,
                    document.ChunkCount,
                    document.CreatedAt,
                    document.UpdatedAt))
                .ToListAsync();

            return Ok(documents);
        }

        // POST /api/admin/knowledge/upload
        [HttpPost("knowledge/upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadKnowledgeDocument(
            [FromForm] BookFlowAI.Api.Models.KnowledgeUploadForm request,
            CancellationToken cancellationToken = default)
        {
            var file = request.File;
            var title = request.Title;
            var content = request.Content;
            var sourceName = request.SourceName;

            var rawText = await ExtractTextAsync(file, title, content, cancellationToken);
            if (string.IsNullOrWhiteSpace(rawText))
            {
                return BadRequest(new { message = "Knowledge content is empty or could not be extracted." });
            }

            var finalTitle = string.IsNullOrWhiteSpace(title) ? BuildDefaultTitle(sourceName, file) : title.Trim();
            var document = new KnowledgeDocument
            {
                Title = finalTitle,
                SourceType = string.IsNullOrWhiteSpace(file?.FileName) ? "Manual" : DetermineSourceType(file.FileName),
                SourceName = string.IsNullOrWhiteSpace(sourceName) ? file?.FileName ?? "Manual entry" : sourceName.Trim(),
                Content = rawText,
                ChunkCount = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.KnowledgeDocuments.Add(document);
            await _context.SaveChangesAsync(cancellationToken);

            var chunks = SplitIntoChunks(rawText, 800, 120).ToList();
            var createdChunks = new List<KnowledgeChunk>();

            for (var index = 0; index < chunks.Count; index++)
            {
                var chunkText = chunks[index];
                var embedding = await _embeddingService.GenerateEmbeddingAsync(chunkText, cancellationToken);
                createdChunks.Add(new KnowledgeChunk
                {
                    KnowledgeDocumentId = document.Id,
                    ChunkIndex = index,
                    Content = chunkText,
                    EmbeddingJson = System.Text.Json.JsonSerializer.Serialize(embedding),
                    CreatedAt = DateTime.UtcNow
                });
            }

            _context.KnowledgeChunks.AddRange(createdChunks);
            document.ChunkCount = createdChunks.Count;
            document.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new
            {
                message = "Knowledge base entry was uploaded and vectorized successfully.",
                documentId = document.Id,
                chunkCount = document.ChunkCount,
                title = document.Title
            });
        }

        // DELETE /api/admin/knowledge/{id}
        [HttpDelete("knowledge/{id:int}")]
        public async Task<IActionResult> DeleteKnowledgeDocument(int id, CancellationToken cancellationToken)
        {
            var document = await _context.KnowledgeDocuments
                .Include(document => document.Chunks)
                .FirstOrDefaultAsync(document => document.Id == id, cancellationToken);

            if (document is null)
            {
                return NotFound(new { message = "Knowledge document was not found." });
            }

            _context.KnowledgeDocuments.Remove(document);
            await _context.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Knowledge document and its embeddings were deleted successfully." });
        }

        private static async Task<string> ExtractTextAsync(IFormFile? file, string? title, string? content, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(content))
            {
                return content.Trim();
            }

            if (file is null || file.Length == 0)
            {
                return string.Empty;
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            using var stream = file.OpenReadStream();
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);
            var bytes = memory.ToArray();

            if (extension == ".txt")
            {
                return Encoding.UTF8.GetString(bytes);
            }

            if (extension == ".pdf")
            {
                return ExtractPdfText(bytes);
            }

            if (extension == ".docx")
            {
                return ExtractDocxText(bytes);
            }

            return Encoding.UTF8.GetString(bytes);
        }

        private static string BuildDefaultTitle(string? sourceName, IFormFile? file)
        {
            if (!string.IsNullOrWhiteSpace(sourceName))
            {
                return sourceName.Trim();
            }

            return file is not null && !string.IsNullOrWhiteSpace(file.FileName)
                ? Path.GetFileNameWithoutExtension(file.FileName)
                : "Manual knowledge entry";
        }

        private static string DetermineSourceType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "PDF",
                ".docx" => "DOCX",
                ".txt" => "TXT",
                _ => "Manual"
            };
        }

        private static string ExtractPdfText(byte[] documentBytes)
        {
            try
            {
                using var stream = new MemoryStream(documentBytes);
                using var pdf = PdfDocument.Open(stream);
                var pages = new List<string>();

                foreach (var page in pdf.GetPages())
                {
                    pages.Add(page.Text);
                }

                return string.Join(Environment.NewLine, pages.Where(text => !string.IsNullOrWhiteSpace(text)));
            }
            catch
            {
                return "[PDF file uploaded; text extraction failed in the current environment.]";
            }
        }

        private static string ExtractDocxText(byte[] documentBytes)
        {
            try
            {
                using var stream = new MemoryStream(documentBytes);
                using var package = WordprocessingDocument.Open(stream, false);
                var body = package.MainDocumentPart?.Document?.Body;
                if (body is null)
                {
                    return string.Empty;
                }

                return body.InnerText.Replace("\u00a0", " ").Trim();
            }
            catch
            {
                return "[DOCX file uploaded; text extraction failed in the current environment.]";
            }
        }

        private static IEnumerable<string> SplitIntoChunks(string content, int chunkSize, int overlap)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                yield break;
            }

            var normalized = content.Replace("\r\n", "\n").Trim();
            var index = 0;
            while (index < normalized.Length)
            {
                var end = Math.Min(index + chunkSize, normalized.Length);
                var chunk = normalized.Substring(index, end - index).Trim();
                if (!string.IsNullOrWhiteSpace(chunk))
                {
                    yield return chunk;
                }

                if (end >= normalized.Length)
                {
                    break;
                }

                index += Math.Max(1, chunkSize - overlap);
            }
        }
    }
}

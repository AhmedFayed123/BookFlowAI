using Microsoft.AspNetCore.Http;

namespace BookFlowAI.Api.Models;

public sealed class KnowledgeUploadForm
{
    public IFormFile? File { get; set; }
    public string? Title { get; set; }
    public string? Content { get; set; }
    public string? SourceName { get; set; }
}

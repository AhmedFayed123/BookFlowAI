using System;
using System.Collections.Generic;

namespace BookFlowAI.Domain.Entities
{
    public class KnowledgeDocument
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string SourceType { get; set; } = "Manual";
        public string SourceName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public int ChunkCount { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<KnowledgeChunk> Chunks { get; set; } = new List<KnowledgeChunk>();
    }
}

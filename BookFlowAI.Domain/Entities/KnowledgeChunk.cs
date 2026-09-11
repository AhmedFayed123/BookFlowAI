using System;

namespace BookFlowAI.Domain.Entities
{
    public class KnowledgeChunk
    {
        public int Id { get; set; }
        public int KnowledgeDocumentId { get; set; }
        public KnowledgeDocument KnowledgeDocument { get; set; } = null!;
        public int ChunkIndex { get; set; }
        public string Content { get; set; } = string.Empty;
        public string EmbeddingJson { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

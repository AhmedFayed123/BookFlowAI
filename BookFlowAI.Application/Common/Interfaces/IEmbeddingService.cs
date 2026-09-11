namespace BookFlowAI.Application.Common.Interfaces
{
    public interface IEmbeddingService
    {
        Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken cancellationToken = default);
    }
}

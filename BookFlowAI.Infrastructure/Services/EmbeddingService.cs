using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using BookFlowAI.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;

namespace BookFlowAI.Infrastructure.Services
{
    public class EmbeddingService : IEmbeddingService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public EmbeddingService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        public async Task<float[]> GenerateEmbeddingAsync(string text, CancellationToken cancellationToken = default)
        {
            var content = (text ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(content))
            {
                return Array.Empty<float>();
            }

            var googleApiKey = _configuration["GoogleGenAI:ApiKey"]
                ?? _configuration["Gemini:ApiKey"]
                ?? Environment.GetEnvironmentVariable("GEMINI_API_KEY");

            if (!string.IsNullOrWhiteSpace(googleApiKey))
            {
                try
                {
                    var googleVector = await GenerateGoogleEmbeddingAsync(googleApiKey, content, cancellationToken);
                    if (googleVector.Length > 0)
                    {
                        return googleVector;
                    }
                }
                catch
                {
                    // Fallback to deterministic embedding if the provider is unavailable.
                }
            }

            var openAiApiKey = _configuration["OpenAI:ApiKey"]
                ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY");

            if (!string.IsNullOrWhiteSpace(openAiApiKey))
            {
                try
                {
                    var openAiVector = await GenerateOpenAiEmbeddingAsync(openAiApiKey, content, cancellationToken);
                    if (openAiVector.Length > 0)
                    {
                        return openAiVector;
                    }
                }
                catch
                {
                    // Fallback to deterministic embedding if the provider is unavailable.
                }
            }

            return CreateFallbackEmbedding(content);
        }

        private async Task<float[]> GenerateGoogleEmbeddingAsync(string apiKey, string text, CancellationToken cancellationToken)
        {
            using var client = _httpClientFactory.CreateClient();
            var payload = JsonSerializer.Serialize(new
            {
                model = "models/text-embedding-004",
                content = new
                {
                    parts = new[]
                    {
                        new { text }
                    }
                }
            });

            using var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={apiKey}");
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

            using var response = await client.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var document = JsonDocument.Parse(json);
            var values = document.RootElement
                .GetProperty("embedding")
                .GetProperty("values");

            return values.EnumerateArray()
                .Select(item => item.GetSingle())
                .ToArray();
        }

        private async Task<float[]> GenerateOpenAiEmbeddingAsync(string apiKey, string text, CancellationToken cancellationToken)
        {
            using var client = _httpClientFactory.CreateClient();
            var payload = JsonSerializer.Serialize(new
            {
                model = "text-embedding-3-small",
                input = text
            });

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/embeddings");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

            using var response = await client.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var document = JsonDocument.Parse(json);
            var values = document.RootElement
                .GetProperty("data")[0]
                .GetProperty("embedding");

            return values.EnumerateArray()
                .Select(item => item.GetSingle())
                .ToArray();
        }

        private static float[] CreateFallbackEmbedding(string text)
        {
            var vector = new float[32];
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(text));

            for (var index = 0; index < vector.Length; index++)
            {
                var seed = hash[index % hash.Length] + (byte)(index * 17);
                var normalized = (seed / 255d) * 2 - 1;
                vector[index] = (float)normalized;
            }

            return vector;
        }
    }
}

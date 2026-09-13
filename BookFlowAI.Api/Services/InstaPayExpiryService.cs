using BookFlowAI.Domain.Entities;
using BookFlowAI.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Services;

public class InstaPayExpiryService(IServiceScopeFactory scopes, ILogger<InstaPayExpiryService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await context.Bookings.Where(b => b.PaymentStatus == PaymentStatus.PendingInstaPay && b.LockExpiresAt <= DateTime.UtcNow)
                    .ExecuteUpdateAsync(set => set.SetProperty(b => b.Status, "Cancelled")
                        .SetProperty(b => b.PaymentStatus, (PaymentStatus?)PaymentStatus.Rejected)
                        .SetProperty(b => b.LockExpiresAt, (DateTime?)null)
                        .SetProperty(b => b.PaymentVerificationNote, "Verification window expired; contact support about your transfer."), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Failed to expire InstaPay locks."); }
        }
    }
}

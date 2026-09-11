using System.Security.Claims;
using BookFlowAI.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Hubs;

[Authorize]
public class BookingHub : Hub
{
    private readonly IApplicationDbContext _context;

    public BookingHub(IApplicationDbContext context) => _context = context;

    public override async Task OnConnectedAsync()
    {
        if (Context.User?.IsInRole("Admin") == true)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
        }
        else if (Context.User?.IsInRole("Staff") == true && TryGetUserId(out var userId))
        {
            var staffId = await _context.StaffMembers
                .Where(staff => staff.UserId == userId)
                .Select(staff => (int?)staff.Id)
                .SingleOrDefaultAsync();
            if (staffId.HasValue)
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Staff_{staffId.Value}");
        }

        await base.OnConnectedAsync();
    }

    public Task JoinAdminGroup() => Context.User?.IsInRole("Admin") == true
        ? Groups.AddToGroupAsync(Context.ConnectionId, "Admins")
        : Task.CompletedTask;

    public async Task JoinStaffGroup(int staffId)
    {
        if (Context.User?.IsInRole("Admin") == true)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Staff_{staffId}");
            return;
        }

        if (Context.User?.IsInRole("Staff") != true || !TryGetUserId(out var userId)) return;
        if (await _context.StaffMembers.AnyAsync(staff => staff.Id == staffId && staff.UserId == userId))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Staff_{staffId}");
    }

    private bool TryGetUserId(out int userId) => int.TryParse(
        Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Context.User?.FindFirst("sub")?.Value,
        out userId);
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BookFlowAI.Api.Hubs
{
    [Authorize]
    public class BookingHub : Hub
    {
        // انضمام الأدمن لغرفة التنبيهات المباشرة
        public async Task JoinAdminGroup()
        {
            if (Context.User != null && Context.User.IsInRole("Admin"))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, "Admins");
            }
        }

        // انضمام الموظف لغرفة التنبيهات الخاصة به
        public async Task JoinStaffGroup(int staffId)
        {
            if (Context.User != null && (Context.User.IsInRole("Staff") || Context.User.IsInRole("Admin")))
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"Staff_{staffId}");
            }
        }
    }
}
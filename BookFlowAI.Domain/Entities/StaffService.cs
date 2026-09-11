namespace BookFlowAI.Domain.Entities;

public class StaffService
{
    public int StaffId { get; set; }
    public StaffMember Staff { get; set; } = null!;

    public int ServiceId { get; set; }
    public Service Service { get; set; } = null!;
}

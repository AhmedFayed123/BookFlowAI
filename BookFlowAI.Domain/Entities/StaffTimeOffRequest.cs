namespace BookFlowAI.Domain.Entities
{
    public class StaffTimeOffRequest
    {
        public int Id { get; set; }
        public int StaffId { get; set; }
        public StaffMember Staff { get; set; } = null!;
        public DateTime Date { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = "Pending";
        public string? AdminComment { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReviewedAt { get; set; }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Domain.Entities
{
    public class StaffMember
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public User User { get; set; } = null!;
        public string? Specialties { get; set; }
        public string? WorkingHours { get; set; }

        // Relationships
        public ICollection<StaffSchedule> Schedules { get; set; } = new List<StaffSchedule>();
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}

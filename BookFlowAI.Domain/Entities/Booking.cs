    using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Domain.Entities
{
    public class Booking
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public User Customer { get; set; } = null!;

        public int StaffId { get; set; }
        public StaffMember Staff { get; set; } = null!;

        public int ServiceId { get; set; }
        public Service Service { get; set; } = null!;

        public DateTime DateTime { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Confirmed, Cancelled, Completed
        public double? NoShowProbability { get; set; }

        // Relationships
        public Review? Review { get; set; }
    }
}

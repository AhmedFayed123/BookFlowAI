using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Domain.Entities
{
    public class Service
    {
        public int Id { get; set; }
        public int BusinessCategoryId { get; set; }
        public BusinessCategory BusinessCategory { get; set; } = null!;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public int DurationInMinutes { get; set; }
        public bool IsActive { get; set; } = true;

        // Relationships
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
        public ICollection<StaffService> StaffServices { get; set; } = new List<StaffService>();
    }
}

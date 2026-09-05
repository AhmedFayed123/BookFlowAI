using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Domain.Entities
{
    public class StaffSchedule
    {
        public int Id { get; set; }
        public int StaffId { get; set; }
        public StaffMember Staff { get; set; } = null!;

        public DayOfWeek DayOfWeek { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
    }   
}

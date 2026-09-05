using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BookFlowAI.Domain.Entities
{
    public class BusinessInfo
    {
        public int Id { get; set; }
        public string Category { get; set; } = string.Empty; // Policy, Pricing, Hours
        public string Content { get; set; } = string.Empty;
    }
}

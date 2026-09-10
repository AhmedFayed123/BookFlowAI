using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers
{
    [ApiController]
    [Route("api/business")]
    public class BusinessInfoController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public BusinessInfoController(IApplicationDbContext context)
        {
            _context = context;
        }

        // GET /api/business/info
        [HttpGet("info")]
        public async Task<ActionResult<IEnumerable<BusinessInfoDto>>> GetInfo()
        {
            var infoList = await _context.BusinessInfos
                .Select(b => new BusinessInfoDto(b.Id, b.Content))
                .ToListAsync();

            return Ok(infoList);
        }
    }
}
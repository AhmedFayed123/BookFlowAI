using BookFlowAI.Application.Common.Interfaces;
using BookFlowAI.Application.DTOs;
using BookFlowAI.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookFlowAI.Api.Controllers
{
    [ApiController]
    [Route("api/services")]
    public class ServicesController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public ServicesController(IApplicationDbContext context)
        {
            _context = context;
        }

        // GET /api/services
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ServiceDto>>> GetAll()
        {
            var services = await _context.Services
                .AsNoTracking()
                .Where(s => s.IsActive && s.BusinessCategory.IsActive)
                .OrderBy(s => s.BusinessCategory.Name).ThenBy(s => s.Name)
                .Select(s => new ServiceDto(s.Id, s.Name, s.Description, s.Price, s.DurationInMinutes,
                    s.BusinessCategoryId, s.BusinessCategory.Name, s.IsActive, s.Bookings.Count))
                .ToListAsync();

            return Ok(services);
        }

        // GET /api/services/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<ServiceDto>> GetById(int id)
        {
            var service = await _context.Services
                .AsNoTracking()
                .Where(item => item.Id == id && item.IsActive)
                .Select(item => new ServiceDto(item.Id, item.Name, item.Description, item.Price,
                    item.DurationInMinutes, item.BusinessCategoryId, item.BusinessCategory.Name, item.IsActive, item.Bookings.Count))
                .FirstOrDefaultAsync();
            if (service == null) return NotFound("الخدمة غير موجودة.");

            return Ok(service);
        }
        // POST /api/services (إضافة خدمة جديدة - أدمن فقط)
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<ServiceDto>> Create([FromBody] CreateServiceDto dto)
        {
            if (dto.DurationInMinutes <= 0 || dto.Price < 0)
                return BadRequest(new { message = "Price and duration must be valid positive values." });
            if (!await _context.BusinessCategories.AnyAsync(category => category.Id == dto.BusinessCategoryId && category.IsActive))
                return BadRequest(new { message = "The selected business category is invalid or inactive." });

            var service = new Service
            {
                BusinessCategoryId = dto.BusinessCategoryId,
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                DurationInMinutes = dto.DurationInMinutes
            };

            _context.Services.Add(service);
            await _context.SaveChangesAsync();

            var categoryName = await _context.BusinessCategories.Where(category => category.Id == service.BusinessCategoryId)
                .Select(category => category.Name).SingleAsync();
            return CreatedAtAction(nameof(GetById), new { id = service.Id },
                new ServiceDto(service.Id, service.Name, service.Description, service.Price, service.DurationInMinutes,
                    service.BusinessCategoryId, categoryName, service.IsActive, 0));
        }

        // PUT /api/services/{id} (تعديل خدمة - أدمن فقط)
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateServiceDto dto)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return NotFound("الخدمة غير موجودة.");
            if (!await _context.BusinessCategories.AnyAsync(category => category.Id == dto.BusinessCategoryId && category.IsActive))
                return BadRequest(new { message = "The selected business category is invalid or inactive." });

            service.BusinessCategoryId = dto.BusinessCategoryId;
            service.Name = dto.Name;
            service.Description = dto.Description;
            service.Price = dto.Price;
            service.DurationInMinutes = dto.DurationInMinutes;
            service.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();
            return Ok(new { message = "تم تحديث بيانات الخدمة بنجاح.", service });
        }

        // DELETE /api/services/{id} (حذف/تعطيل خدمة - أدمن فقط)
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return NotFound("الخدمة غير موجودة.");

            service.IsActive = false;
            await _context.SaveChangesAsync();

            return Ok(new { message = "تم تعطيل الخدمة بنجاح." });
        }
    }
}

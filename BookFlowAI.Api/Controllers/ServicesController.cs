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
                .Select(s => new ServiceDto(s.Id, s.Name, s.Description, s.Price, s.DurationInMinutes))
                .ToListAsync();

            return Ok(services);
        }

        // GET /api/services/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<ServiceDto>> GetById(int id)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return NotFound("الخدمة غير موجودة.");

            return Ok(new ServiceDto(service.Id, service.Name, service.Description, service.Price, service.DurationInMinutes));
        }
        // POST /api/services (إضافة خدمة جديدة - أدمن فقط)
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<Service>> Create([FromBody] CreateServiceDto dto)
        {
            var service = new Service
            {
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                DurationInMinutes = dto.DurationInMinutes
            };

            _context.Services.Add(service);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), new { id = service.Id }, service);
        }

        // PUT /api/services/{id} (تعديل خدمة - أدمن فقط)
        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateServiceDto dto)
        {
            var service = await _context.Services.FindAsync(id);
            if (service == null) return NotFound("الخدمة غير موجودة.");

            service.Name = dto.Name;
            service.Description = dto.Description;
            service.Price = dto.Price;
            service.DurationInMinutes = dto.DurationInMinutes;

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

            _context.Services.Remove(service);
            await _context.SaveChangesAsync();

            return Ok(new { message = "تم حذف الخدمة بنجاح." });
        }
    }
}
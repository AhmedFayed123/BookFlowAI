"use client";

import Link from "next/link";
import ActionIcon from "../../../components/ui/ActionIcon";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import {
  adminApi,
  servicesApi,
  type AdminCreateStaffDto,
  type AdminStaffDto,
  type AdminTimeOffRequestDto,
  type ServiceDto,
  type StaffShiftInputDto,
} from "../../../lib/api";

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyShift = (): StaffShiftInputDto => ({ dayOfWeek: 1, startTime: "09:00:00", endTime: "17:00:00" });
const emptyForm = (): AdminCreateStaffDto => ({
  name: "",
  email: "",
  password: "",
  phoneNumber: "",
  specialties: "",
  isAvailable: true,
  serviceIds: [],
  shifts: [emptyShift()],
});

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<AdminStaffDto[]>([]);
  const [services, setServices] = useState<ServiceDto[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<AdminTimeOffRequestDto[]>([]);
  const [form, setForm] = useState<AdminCreateStaffDto>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [staffResult, serviceResult, timeOffResult] = await Promise.all([
        adminApi.getStaff(), servicesApi.getServices(), adminApi.getTimeOffRequests(),
      ]);
      setStaff(staffResult);
      setServices(serviceResult);
      setTimeOffRequests(timeOffResult);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load staff management data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
    setNotice(null);
  };

  const editStaff = async (item: AdminStaffDto) => {
    try { item = await adminApi.getStaffById(item.id); }
    catch (caught) { setNotice(caught instanceof Error ? caught.message : "Unable to load provider details."); return; }
    setEditingId(item.id);
    setForm({
      name: item.name,
      email: item.email,
      password: "",
      phoneNumber: item.phoneNumber ?? "",
      specialties: item.specialties ?? "",
      isAvailable: item.isAvailable,
      serviceIds: item.services.map((service) => service.id),
      shifts: item.shifts.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (form.serviceIds.length === 0) {
      setNotice("Select at least one service for this provider.");
      return;
    }
    if (form.shifts.length === 0) {
      setNotice("Add at least one working shift.");
      return;
    }
    if (form.shifts.some((shift) => !shift.startTime || !shift.endTime || shift.startTime >= shift.endTime)) {
      setNotice("Each working shift must have a valid start time before its end time.");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateStaff(editingId, {
          name: form.name,
          email: form.email,
          phoneNumber: form.phoneNumber,
          specialties: form.specialties,
          isAvailable: form.isAvailable,
          serviceIds: form.serviceIds,
          shifts: form.shifts,
        });
        setNotice("Staff member updated successfully.");
      } else {
        await adminApi.createStaff(form);
        setNotice("Staff member created successfully.");
      }
      setEditingId(null);
      setForm(emptyForm());
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save the staff member.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item: AdminStaffDto) => {
    try {
      await adminApi.setStaffAvailability(item.id, !item.isAvailable);
      setStaff((current) => current.map((value) => value.id === item.id ? { ...value, isAvailable: !value.isAvailable } : value));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update availability.");
    }
  };

  const removeStaff = async (item: AdminStaffDto) => {
    if (!window.confirm(`Delete ${item.name}? Staff with booking history must be marked unavailable instead.`)) return;
    try {
      await adminApi.deleteStaff(item.id);
      setStaff((current) => current.filter((value) => value.id !== item.id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to delete staff member.");
    }
  };

  const reviewTimeOff = async (request: AdminTimeOffRequestDto, isApproved: boolean) => {
    try {
      const result = await adminApi.reviewTimeOffRequest(request.id, isApproved);
      setTimeOffRequests((current) => current.filter((item) => item.id !== request.id));
      setNotice(`${result.message}${result.affectedBookings ? ` ${result.affectedBookings} booking(s) cancelled.` : ""}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to review the time-off request.");
    }
  };

  return (
    <ProtectedRoute requiredRole="Admin">
      <main className="min-h-screen bg-slate-100 px-4 py-6 md:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-wide text-emerald-700">Admin operations</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Staff & service providers</h1>
              <p className="mt-2 text-slate-600">Manage capabilities, working shifts, and booking availability.</p>
            </div>
            <Link href="/admin/dashboard" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Back to dashboard</Link>
          </header>

          {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

          <form onSubmit={submit} className="space-y-5 surface-card rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">{editingId ? "Edit provider" : "Add provider"}</h2>
              {editingId && <button type="button" onClick={resetForm} className="text-sm font-semibold text-emerald-700"><ActionIcon action="cancel" />Cancel edit</button>}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <input required placeholder="Full name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
              <input required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
              {!editingId && <input required minLength={8} type="password" placeholder="Temporary password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />}
              <input placeholder="Phone" value={form.phoneNumber ?? ""} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
              <input placeholder="Skills / qualifications" value={form.specialties ?? ""} onChange={(event) => setForm({ ...form, specialties: event.target.value })} className="rounded-xl border border-slate-200 px-4 py-3 md:col-span-2" />
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-700">Assigned services</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                    <input type="checkbox" checked={form.serviceIds.includes(service.id)} onChange={() => setForm((current) => ({ ...current, serviceIds: current.serviceIds.includes(service.id) ? current.serviceIds.filter((id) => id !== service.id) : [...current.serviceIds, service.id] }))} />
                    <span><strong>{service.name}</strong><span className="block text-xs text-slate-500">{service.businessCategoryName}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <div className="flex items-center justify-between">
                <legend className="text-sm font-semibold text-slate-700">Working shifts</legend>
                <button type="button" onClick={() => setForm({ ...form, shifts: [...form.shifts, emptyShift()] })} className="text-sm font-semibold text-emerald-700">+ Add shift</button>
              </div>
              {form.shifts.map((shift, index) => (
                <div key={`${index}-${shift.dayOfWeek}`} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <select value={shift.dayOfWeek} onChange={(event) => setForm({ ...form, shifts: form.shifts.map((item, itemIndex) => itemIndex === index ? { ...item, dayOfWeek: Number(event.target.value) } : item) })} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    {days.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                  </select>
                  <input required aria-label="Shift start time" type="time" value={shift.startTime.slice(0, 5)} onChange={(event) => setForm({ ...form, shifts: form.shifts.map((item, itemIndex) => itemIndex === index ? { ...item, startTime: event.target.value ? `${event.target.value}:00` : "" } : item) })} className="rounded-xl border border-slate-200 px-3 py-2" />
                  <input required aria-label="Shift end time" type="time" value={shift.endTime.slice(0, 5)} onChange={(event) => setForm({ ...form, shifts: form.shifts.map((item, itemIndex) => itemIndex === index ? { ...item, endTime: event.target.value ? `${event.target.value}:00` : "" } : item) })} className="rounded-xl border border-slate-200 px-3 py-2" />
                  <button type="button" onClick={() => setForm({ ...form, shifts: form.shifts.filter((_, itemIndex) => itemIndex !== index) })} className="px-2 text-sm font-semibold text-rose-600">Remove</button>
                </div>
              ))}
            </fieldset>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={form.isAvailable} onChange={(event) => setForm({ ...form, isAvailable: event.target.checked })} /> Available for booking</label>
              <button disabled={saving} className="rounded-xl button-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"><ActionIcon action="save" />{saving ? "Saving..." : editingId ? "Save changes" : "Create provider"}</button>
            </div>
          </form>

          {timeOffRequests.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Pending time-off requests</h2>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {timeOffRequests.map((request) => <article key={request.id} className="rounded-xl border border-amber-200 bg-white p-4">
                <h3 className="font-semibold text-slate-900">{request.staffName}</h3>
                <p className="mt-1 text-sm text-slate-600">{new Date(request.date).toLocaleDateString()} · {request.reason || "No reason provided"}</p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => void reviewTimeOff(request, true)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Approve</button>
                  <button onClick={() => void reviewTimeOff(request, false)} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">Reject</button>
                </div>
              </article>)}
            </div>
          </section>}

          <section className="surface-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Provider directory</h2>
            {loading ? <p className="mt-4 text-slate-500">Loading staff...</p> : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {staff.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-semibold text-slate-900">{item.name}</h3><p className="text-sm text-slate-500">{item.email}</p></div>
                      <button onClick={() => void toggleAvailability(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{item.isAvailable ? "Available" : "Unavailable"}</button>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{item.specialties || "No qualifications recorded."}</p>
                    <div className="mt-3 flex flex-wrap gap-2">{item.services.map((service) => <span key={service.id} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">{service.name}</span>)}</div>
                    <div className="mt-3 text-xs text-slate-500">{item.shifts.length} configured shift{item.shifts.length === 1 ? "" : "s"}</div>
                    <div className="mt-4 flex gap-3"><button onClick={() => editStaff(item)} className="text-sm font-semibold text-emerald-700"><ActionIcon action="edit" />Edit</button><button onClick={() => void removeStaff(item)} className="text-sm font-semibold text-rose-600">Delete</button></div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </ProtectedRoute>
  );
}

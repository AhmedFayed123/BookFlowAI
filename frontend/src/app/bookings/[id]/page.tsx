"use client";

import Link from "next/link";
import ActionIcon from "../../../components/ui/ActionIcon";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import WorkspaceShell from "../../../components/ui/WorkspaceShell";
import AsyncState, { buttonClass, cardClass, fieldClass } from "../../../components/ui/AsyncState";
import { useToast } from "../../../components/ui/ToastProvider";
import { BOOKINGS_CHANGED_EVENT } from "../../../lib/notifications";
import { accountApi, adminApi, bookingsApi, reviewsApi, staffApi, type AvailabilitySlotDto, type BookingDetailDto, type BookingStatus, type ReviewDto, type StaffProfileDto, type UserProfileResponse } from "../../../lib/api";
import { combineLocalDateAndTime, toLocalDateInputValue, toScheduleDateTime } from "../../../lib/booking";

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { toast } = useToast();
  const [booking, setBooking] = useState<BookingDetailDto | null>(null);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<AvailabilitySlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [providers, setProviders] = useState<StaffProfileDto[]>([]);
  const [overrideStatus, setOverrideStatus] = useState<BookingStatus>("Pending");
  const [overrideProvider, setOverrideProvider] = useState(0);
  const [overrideTime, setOverrideTime] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (!Number.isInteger(id) || id < 1) throw new Error("Invalid booking reference.");
      const [result, user] = await Promise.all([bookingsApi.getById(id), accountApi.getProfile()]);
      setBooking(result); setProfile(user); setOverrideStatus(result.status);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load booking."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { const refresh = () => void load(); const timer = window.setTimeout(refresh, 0); window.addEventListener(BOOKINGS_CHANGED_EVENT, refresh); return () => { window.clearTimeout(timer); window.removeEventListener(BOOKINGS_CHANGED_EVENT, refresh); }; }, [load]);

  useEffect(() => {
    if (!booking) return;
    let active = true;
    void reviewsApi.getByStaff(booking.staffId).then((items) => {
      if (active) { setReviews(items); setReviewed(items.some((item) => item.bookingId === booking.id)); setReviewsError(null); }
    }).catch((caught: unknown) => { if (active) setReviewsError(caught instanceof Error ? caught.message : "Unable to load provider reviews."); });
    if (profile?.role === "Admin") void staffApi.getStaff(booking.serviceId).then((items) => { if (active) setProviders(items); }).catch(() => { if (active) toast("Provider choices could not be loaded. You can still change status.", "warning"); });
    return () => { active = false; };
  }, [booking, profile?.role, toast]);

  useEffect(() => {
    if (!booking || !date) return;
    let active = true;
    void staffApi.getAvailableSlots(booking.staffId, date, booking.serviceId).then((items) => {
      if (active) { setSlots(items.filter((item) => item.isAvailable)); setSlotsLoading(false); }
    }).catch((caught: unknown) => { if (active) { setSlotError(caught instanceof Error ? caught.message : "Unable to load availability."); setSlotsLoading(false); } });
    return () => { active = false; };
  }, [booking, date]);

  const action = async (request: () => Promise<unknown>, success: string) => {
    setSaving(true);
    try { await request(); toast(success, "success"); await load(); return true; }
    catch (caught) { toast(caught instanceof Error ? caught.message : "The action could not be completed.", "error"); return false; }
    finally { setSaving(false); }
  };
  const reschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!slots.some((item) => item.startTime === slot) || combineLocalDateAndTime(date, slot) <= new Date()) { toast("Select an available future time.", "warning"); return; }
    if (await action(() => bookingsApi.reschedule(id, { newDateTime: toScheduleDateTime(date, slot) }), "Booking rescheduled.")) { setSlot(""); setDate(""); }
  };
  const review = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true);
    try { await reviewsApi.create({ bookingId: id, rating, comment: comment.trim() || null }); setReviewed(true); toast("Review submitted.", "success"); setReviews(await reviewsApi.getByStaff(booking!.staffId)); }
    catch (caught) { toast(caught instanceof Error ? caught.message : "Unable to submit review.", "error"); }
    finally { setSaving(false); }
  };

  const canManage = profile?.role === "Admin" || profile?.role === "Customer";
  const editable = booking && ["Pending", "PendingInstaPay", "Confirmed"].includes(booking.status);
  return <ProtectedRoute>
    {profile ? <WorkspaceShell role={profile.role} eyebrow="Booking details" title={`Booking #${id}`} description="Your appointment, provider, and next steps in one place.">
      <AsyncState loading={loading} error={error} retry={() => void load()} />
      {!loading && !error && booking && <>
        <section className={cardClass}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{booking.serviceName}</h2><span className={`rounded-full border px-3 py-1 text-xs ${booking.status === "PendingInstaPay" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200"}`}>{booking.status === "PendingInstaPay" ? "⏳ Pending InstaPay verification" : booking.status}</span></div><p className="text-sm text-slate-600">{new Date(booking.dateTime).toLocaleString()} · {booking.durationInMinutes} minutes · EGP {booking.price.toFixed(2)}</p><p className="text-sm">Provider: <Link href={`/providers/${booking.staffId}`} className="font-medium text-emerald-800 underline underline-offset-4">{booking.staffName}</Link></p>
          <div className="flex flex-wrap gap-3">{canManage && editable && <button disabled={saving} onClick={() => { if (window.confirm("Cancel this booking?")) void action(() => bookingsApi.cancel(id), "Booking cancelled."); }} className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-700">Cancel booking</button>}{profile.role !== "Customer" && booking.status !== "PendingInstaPay" && booking.status !== "Cancelled" && booking.status !== "Completed" && booking.status !== "NoShow" && <>{booking.status === "Pending" && <button disabled={saving} onClick={() => void action(() => bookingsApi.updateStatus(id, "confirm"), "Booking confirmed.")} className={buttonClass}>Confirm</button>}<button disabled={saving} onClick={() => void action(() => bookingsApi.updateStatus(id, "complete"), "Booking completed.")} className={buttonClass}>Complete</button><button disabled={saving} onClick={() => void action(() => bookingsApi.updateStatus(id, "mark-no-show"), "Marked as no-show.")} className="text-sm text-amber-800">Mark no-show</button></>}</div>
        </section>
        <div className="grid gap-6 lg:grid-cols-2">
          {canManage && editable && !booking.paymentStatus && <form onSubmit={reschedule} className={cardClass}><h2 className="text-lg font-semibold">Reschedule appointment</h2><label className="block text-sm font-medium">New date<input required type="date" min={toLocalDateInputValue(new Date())} value={date} onChange={(event) => { setDate(event.target.value); setSlot(""); setSlots([]); setSlotError(null); setSlotsLoading(Boolean(event.target.value)); }} className={fieldClass} /></label><AsyncState loading={slotsLoading} error={slotError} />{date && !slotsLoading && !slotError && <label className="block text-sm font-medium">Available time<select required value={slot} onChange={(event) => setSlot(event.target.value)} className={fieldClass}><option value="">{slots.length ? "Choose a time" : "No available times on this date"}</option>{slots.map((item) => <option key={item.startTime} value={item.startTime}>{item.startTime.slice(0, 5)} – {item.endTime.slice(0, 5)}</option>)}</select></label>}<button disabled={saving || !slot || slotsLoading} className={buttonClass}><ActionIcon action="save" />{saving ? "Updating…" : "Reschedule booking"}</button></form>}
          {profile.role === "Customer" && booking.status === "Completed" && <section className={cardClass}><h2 className="text-lg font-semibold">Share your experience</h2>{reviewed ? <p className="text-sm text-emerald-800">You have reviewed this booking. Thank you.</p> : <form onSubmit={review} className="space-y-4"><label className="block text-sm font-medium">Rating<select value={rating} onChange={(event) => setRating(Number(event.target.value))} className={fieldClass}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label className="block text-sm font-medium">Comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} className={fieldClass} /></label><button disabled={saving} className={buttonClass}><ActionIcon action="submit" />Submit review</button></form>}</section>}
          {profile.role === "Admin" && !booking.paymentStatus && <form onSubmit={(event) => { event.preventDefault(); if (window.confirm("Apply this administrative override? This bypasses normal availability checks.")) void action(() => adminApi.overrideBooking(id, { status: overrideStatus, newStaffId: overrideProvider || null, newDateTime: overrideTime || null }), "Override applied."); }} className={cardClass}><h2 className="text-lg font-semibold">Administrative override</h2><p className="text-xs text-amber-800">Emergency operation: the backend bypasses normal availability checks.</p><label className="block text-sm font-medium">Status<select value={overrideStatus} onChange={(event) => setOverrideStatus(event.target.value as BookingStatus)} className={fieldClass}>{["Pending", "Confirmed", "Completed", "Cancelled", "NoShow"].map((status) => <option key={status}>{status}</option>)}</select></label><label className="block text-sm font-medium">Provider<select value={overrideProvider} onChange={(event) => setOverrideProvider(Number(event.target.value))} className={fieldClass}><option value="0">Keep current provider</option>{providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="block text-sm font-medium">Optional new date and time<input type="datetime-local" value={overrideTime} onChange={(event) => setOverrideTime(event.target.value)} className={fieldClass} /></label><button disabled={saving} className={buttonClass}>Apply override</button></form>}
        </div>
        <section className={cardClass}><h2 className="text-lg font-semibold">Provider reviews</h2><AsyncState loading={false} error={reviewsError} />{!reviewsError && reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}{reviews.map((item) => <div key={item.id} className="border-t border-slate-100 pt-3"><p className="text-sm font-medium">{item.customerName} · {item.rating}/5</p><p className="mt-1 text-sm text-slate-600">{item.comment || "No written comment."}</p></div>)}</section>
      </>}
    </WorkspaceShell> : <div className="mx-auto max-w-3xl p-6"><AsyncState loading={loading} error={error} retry={() => void load()} /></div>}
  </ProtectedRoute>;
}

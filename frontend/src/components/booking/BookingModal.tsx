"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CalendarDays, Check, CheckCircle2, Clock3, ShieldCheck, UserRound, X } from "lucide-react";
import {
  bookingsApi,
  staffApi,
  type AvailabilitySlotDto,
  type ServiceDto,
  type StaffProfileDto,
} from "../../lib/api";
import { calculateBookingEstimate } from "../../lib/serviceFilters";
import { combineLocalDateAndTime, getUpcomingLocalDates, toLocalDateInputValue, toScheduleDateTime } from "../../lib/booking";
import { useToast } from "../ui/ToastProvider";
import { publishNotification, appointmentLabel } from "../../lib/notifications";

const api = {
  staff: {
    getAll: staffApi.getStaff,
    getAvailableSlots: staffApi.getAvailableSlots,
  },
  bookings: {
    create: bookingsApi.create,
  },
};

const bookingStepOneSchema = z.object({
  staffId: z.number().min(1, "Please select a staff member."),
});

const bookingStepTwoSchema = z.object({
  selectedDate: z.string().min(1, "Please choose a date."),
  slot: z
    .object({
      startTime: z.string().min(1),
      endTime: z.string().min(1),
      isAvailable: z.boolean(),
    })
    .refine((value) => value.isAvailable, "Please choose an available slot."),
});

type BookingFormValues = {
  staffId: number;
  selectedDate: string;
  slot: AvailabilitySlotDto | null;
};

type BookingModalProps = {
  service: ServiceDto | null;
  open: boolean;
  onClose: () => void;
};

const formatDate = (dateString: string) =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatTimeSpan = (timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function BookingModal({
  service,
  open,
  onClose,
}: BookingModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [staffMembers, setStaffMembers] = useState<StaffProfileDto[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlotDto[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const form = useForm<BookingFormValues>({
    defaultValues: {
      staffId: 0,
      selectedDate: "",
      slot: null,
    },
  });

  const selectedStaffId = useWatch({ control: form.control, name: "staffId" });
  const selectedStaff = staffMembers.find((staff) => staff.id === selectedStaffId) ?? null;
  const selectedSlot = useWatch({ control: form.control, name: "slot" });
  const selectedDate = useWatch({ control: form.control, name: "selectedDate" });
  const quickDates = useMemo(() => getUpcomingLocalDates(7), []);
  const configuredTaxRate = Number.isFinite(Number(process.env.NEXT_PUBLIC_TAX_RATE)) ? Number(process.env.NEXT_PUBLIC_TAX_RATE) : 0;
  const configuredBookingFee = Number.isFinite(Number(process.env.NEXT_PUBLIC_BOOKING_FEE)) ? Math.max(0, Number(process.env.NEXT_PUBLIC_BOOKING_FEE)) : 0;
  const estimate = calculateBookingEstimate(service?.price ?? 0, configuredTaxRate, configuredBookingFee);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [onClose, open, submitting]);

  useEffect(() => {
    if (!open) {
      const resetTimer = window.setTimeout(() => {
        setStep(1);
        setCreatedBookingId(null);
        setErrorMessage(null);
        form.reset({
          staffId: 0,
          selectedDate: "",
          slot: null,
        });
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    let active = true;
    const loadStaff = async () => {
      try {
        setLoadingStaff(true);
        const result = await api.staff.getAll(service?.id);
        if (active) setStaffMembers(result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load staff members.";
        if (active) setErrorMessage(message);
      } finally {
        if (active) setLoadingStaff(false);
      }
    };

    void loadStaff();
    return () => { active = false; };
  }, [form, open, service?.id]);

  useEffect(() => {
    if (!open || !selectedStaffId || !selectedDate) {
      const resetTimer = window.setTimeout(() => {
        setSlots([]);
        form.setValue("slot", null);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    let active = true;
    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        const result = await api.staff.getAvailableSlots(
          selectedStaffId,
          selectedDate,
          service?.id,
        );
        if (active) {
          setSlots(result.filter((slot) => slot.isAvailable));
          form.setValue("slot", null);
          setErrorMessage(null);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load time slots.";
        if (active) {
          setErrorMessage(message);
          setSlots([]);
        }
      } finally {
        if (active) setLoadingSlots(false);
      }
    };

    void fetchSlots();
    return () => { active = false; };
  }, [form, open, selectedDate, selectedStaffId, service?.id]);

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      const parsed = bookingStepOneSchema.safeParse({
        staffId: form.getValues("staffId"),
      });

      if (!parsed.success) {
        setErrorMessage(
          parsed.error.issues[0]?.message ?? "Please select a staff member.",
        );
        return false;
      }
    }

    if (currentStep === 2) {
      const parsed = bookingStepTwoSchema.safeParse({
        selectedDate: form.getValues("selectedDate"),
        slot: form.getValues("slot"),
      });

      if (!parsed.success) {
        setErrorMessage(
          parsed.error.issues[0]?.message ?? "Please choose a valid slot.",
        );
        return false;
      }
    }

    setErrorMessage(null);
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, 3));
  };

  const handleBack = () => setStep((current) => Math.max(current - 1, 1));

  const handleSubmit = async () => {
    if (!service) return;
    if (!validateStep(2)) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const bookingDate = combineLocalDateAndTime(selectedDate, selectedSlot?.startTime ?? "");
      if (bookingDate <= new Date()) throw new Error("Please choose a future time slot.");
      const response = await api.bookings.create({
        staffId: form.getValues("staffId"),
        serviceId: service.id,
        dateTime: toScheduleDateTime(selectedDate, selectedSlot?.startTime ?? ""),
      });

      setCreatedBookingId(response.bookingId);
      setStep(3);
      const message = `Your booking with ${service.name} was successfully scheduled. Awaiting provider confirmation.`;
      publishNotification({ id: `booking-created:${response.bookingId}`, kind: "booking", title: "Booking scheduled", message, bookingId: response.bookingId, appointmentAt: toScheduleDateTime(selectedDate, selectedSlot?.startTime ?? ""), createdAt: new Date().toISOString() });
      toast(`${service.name} · ${appointmentLabel(bookingDate.toISOString())}. Booking request created.`, "success");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Booking could not be created.";
      setErrorMessage(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !service) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/35 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="booking-modal-title" aria-describedby="booking-modal-description" className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 text-slate-900">
          <div>
            <p className="text-xs font-medium tracking-wide text-emerald-800">
              Booking
            </p>
            <h3 id="booking-modal-title" className="mt-1 text-xl font-semibold">{service.name}</h3>
            <p id="booking-modal-description" className="sr-only">Choose a provider and available time, then review and confirm your appointment.</p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-all duration-200 ease-in-out hover:bg-slate-100"
            aria-label="Close booking modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {createdBookingId ? (
          <div className="space-y-6 p-6">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-7 w-7" /></span>
                  <div>
                  <p className="text-sm font-semibold tracking-wide text-emerald-700">
                    Booking confirmed
                  </p>
                  <h4 className="mt-2 text-3xl font-semibold text-slate-900">
                    #{createdBookingId}
                  </h4>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs tracking-wide text-slate-500">
                  Service
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {service.name}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {service.durationInMinutes} minutes • $
                  {service.price.toFixed(2)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs tracking-wide text-slate-500">
                  Staff
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {selectedStaff?.name ?? "Assigned staff"}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {selectedSlot
                    ? `${formatDate(selectedDate)} • ${formatTimeSpan(selectedSlot.startTime)}`
                    : "Schedule confirmed"}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 ease-in-out hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 border-b border-slate-200 px-4 py-3 text-xs sm:px-6">
              {[{ icon: UserRound, label: "Provider" }, { icon: CalendarDays, label: "Date & time" }, { icon: ShieldCheck, label: "Review" }].map((item, index) => {
                const currentStep = index + 1;
                const Icon = item.icon;
                return <div key={item.label} className={`flex items-center justify-center gap-2 font-semibold ${step >= currentStep ? "text-emerald-700" : "text-slate-500"}`}><span className={`grid h-7 w-7 place-items-center rounded-full ${step > currentStep ? "bg-emerald-100 text-emerald-700" : step === currentStep ? "bg-emerald-100 text-emerald-700" : "bg-slate-100"}`}>{step > currentStep ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}</span><span className="hidden sm:inline">{item.label}</span></div>;
              })}
            </div>

            <div className="space-y-5 p-5">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">
                      Choose your staff
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Pick the professional who will provide this service.
                    </p>
                  </div>

                  {loadingStaff ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <div
                          key={`staff-skeleton-${index}`}
                          className="skeleton-shimmer rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="h-4 w-28 rounded-full bg-slate-200" />
                          <div className="mt-3 h-3 w-full rounded-full bg-slate-200" />
                          <div className="mt-2 h-3 w-5/6 rounded-full bg-slate-200" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {staffMembers.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No available providers are assigned to this service yet.</div>}
                      {staffMembers.map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            form.setValue("staffId", staff.id);
                            setErrorMessage(null);
                          }}
                          className={`rounded-xl border p-4 text-left transition-all duration-200 ease-in-out ${
                            selectedStaffId === staff.id
                              ? "border-slate-500 bg-slate-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-400 hover:bg-emerald-50/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-base font-semibold text-slate-900">
                                {staff.name}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">
                                {staff.specialties}
                              </div>
                            </div>
                            <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {staff.averageRating.toFixed(1)}★
                            </div>
                          </div>
                          <div className="mt-3 text-sm text-slate-500">
                            {staff.workingHours}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">
                      Pick a date and time
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Available slots are shown based on your selected staff
                      member.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <label
                      htmlFor="booking-date"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Select date
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      min={toLocalDateInputValue(new Date())}
                      value={selectedDate}
                      onChange={(event) =>
                        form.setValue("selectedDate", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" aria-label="Quick date selection">
                    {quickDates.map((date) => <button key={date} type="button" aria-label={`Select ${formatDate(date)}`} aria-pressed={selectedDate === date} onClick={() => form.setValue("selectedDate", date)} className={`rounded-xl border px-2 py-2 text-center text-xs transition-all duration-200 ease-in-out ${selectedDate === date ? "border-slate-800 bg-slate-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"}`}><span className="block font-semibold">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })}</span><span>{new Date(`${date}T12:00:00`).getDate()}</span></button>)}
                  </div>

                  {loadingSlots ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`slot-skeleton-${index}`}
                          className="h-12 skeleton-shimmer rounded-xl bg-slate-200"
                        />
                      ))}
                    </div>
                  ) : !selectedDate ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Choose a date to see live availability.</div>
                  ) : slots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {slots.map((slot) => (
                        <button
                          key={`${slot.startTime}-${slot.endTime}`}
                          type="button"
                          aria-label={`Select ${slot.startTime} to ${slot.endTime}`}
                          aria-pressed={Boolean(selectedSlot && selectedSlot.startTime === slot.startTime && selectedSlot.endTime === slot.endTime)}
                          onClick={() => form.setValue("slot", slot)}
                          className={`rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200 ease-in-out ${
                            selectedSlot &&
                            selectedSlot.startTime === slot.startTime &&
                            selectedSlot.endTime === slot.endTime
                              ? "border-slate-800 bg-slate-900 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          <div className="font-semibold">
                            {formatTimeSpan(slot.startTime)}
                          </div>
                          <div className="mt-1 text-xs opacity-80">
                            to {formatTimeSpan(slot.endTime)}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      No available slots for this date. Please choose another
                      date.
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-900">
                      Confirm your booking
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Review the information before submitting your request.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs tracking-wide text-slate-500">
                        Service
                      </div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        {service.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {service.durationInMinutes} min • $
                        {service.price.toFixed(2)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs tracking-wide text-slate-500">
                        Staff
                      </div>
                      <div className="mt-2 text-lg font-semibold text-slate-900">
                        {selectedStaff?.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {selectedStaff?.specialties}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs tracking-wide text-slate-500">
                          Booking time
                        </div>
                        <div className="mt-2 text-base font-semibold text-slate-900">
                          {selectedDate ? formatDate(selectedDate) : "—"}
                        </div>
                        <div className="text-sm text-slate-600">
                          {selectedSlot
                            ? `${formatTimeSpan(selectedSlot.startTime)} - ${formatTimeSpan(selectedSlot.endTime)}`
                            : "—"}
                        </div>
                      </div>

                      <Clock3 className="h-6 w-6 text-emerald-700" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <h5 className="font-semibold text-slate-900">Price estimate</h5>
                    <dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between text-slate-600"><dt>Service subtotal</dt><dd>${estimate.subtotal.toFixed(2)}</dd></div><div className="flex justify-between text-slate-600"><dt>Estimated taxes</dt><dd>${estimate.tax.toFixed(2)}</dd></div><div className="flex justify-between text-slate-600"><dt>Booking fee</dt><dd>${estimate.fee.toFixed(2)}</dd></div><div className="flex justify-between border-t border-emerald-200 pt-2 text-base font-semibold text-slate-950"><dt>Estimated total</dt><dd>${estimate.total.toFixed(2)}</dd></div></dl>
                    <p className="mt-3 text-xs leading-5 text-slate-500">Final taxes or fees depend on your business configuration and are confirmed before payment.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 ease-in-out hover:bg-slate-50"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                {step > 1 && !createdBookingId && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-200 ease-in-out hover:bg-slate-50"
                  >
                    Back
                  </button>
                )}

                {!createdBookingId && (
                  <button
                    type="button"
                    onClick={step === 3 ? handleSubmit : handleNext}
                    disabled={submitting}
                    className="rounded-xl button-primary px-4 py-2.5 text-sm font-semibold text-white  transition-all duration-200 ease-in-out hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Processing..."
                      : step === 3
                        ? "Confirm booking"
                        : "Continue"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

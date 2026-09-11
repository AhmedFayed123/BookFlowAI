"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  bookingsApi,
  staffApi,
  type AvailabilitySlotDto,
  type ServiceDto,
  type StaffProfileDto,
} from "../../lib/api";

const api = {
  staff: {
    getAll: staffApi.getStaff,
    getAvailableSlots: staffApi.getAvailableSlots,
  },
  bookings: {
    create: bookingsApi.create,
    getById: bookingsApi.getById,
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

const getRiskBadge = (probability?: number | null) => {
  const safeProbability = typeof probability === "number" ? probability : 0;

  if (safeProbability >= 0.7) {
    return {
      label: "High Risk",
      className: "bg-red-100 text-red-700 ring-red-200",
    };
  }

  if (safeProbability >= 0.4) {
    return {
      label: "Medium Risk",
      className: "bg-yellow-100 text-yellow-700 ring-yellow-200",
    };
  }

  return {
    label: "Low Risk",
    className: "bg-green-100 text-green-700 ring-green-200",
  };
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString(undefined, {
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
  const [step, setStep] = useState(1);
  const [staffMembers, setStaffMembers] = useState<StaffProfileDto[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlotDto[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<{
    id: number;
    noShowProbability?: number | null;
  } | null>(null);

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

  useEffect(() => {
    if (!open) {
      const resetTimer = window.setTimeout(() => {
        setStep(1);
        setCreatedBooking(null);
        setErrorMessage(null);
        form.reset({
          staffId: 0,
          selectedDate: "",
          slot: null,
        });
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    const loadStaff = async () => {
      try {
        setLoadingStaff(true);
        const result = await api.staff.getAll(service?.id);
        setStaffMembers(result);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load staff members.";
        setErrorMessage(message);
      } finally {
        setLoadingStaff(false);
      }
    };

    void loadStaff();
  }, [form, open, service?.id]);

  useEffect(() => {
    if (!open || !selectedStaffId || !selectedDate) {
      const resetTimer = window.setTimeout(() => {
        setSlots([]);
        form.setValue("slot", null);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        const result = await api.staff.getAvailableSlots(
          selectedStaffId,
          selectedDate,
        );
        setSlots(result.filter((slot) => slot.isAvailable));
        form.setValue("slot", null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load time slots.";
        setErrorMessage(message);
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    void fetchSlots();
  }, [form, open, selectedDate, selectedStaffId]);

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
      const bookingDate = new Date(
        `${selectedDate}T${selectedSlot?.startTime ?? "00:00"}:00`,
      );
      const response = await api.bookings.create({
        staffId: form.getValues("staffId"),
        serviceId: service.id,
        dateTime: bookingDate.toISOString(),
      });

      const createdBookingDetails = await api.bookings.getById(
        response.bookingId,
      );
      setCreatedBooking({
        id: response.bookingId,
        noShowProbability: createdBookingDetails.noShowProbability ?? 0,
      });
      setStep(3);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Booking could not be created.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !service) return null;

  const riskBadge = getRiskBadge(createdBooking?.noShowProbability);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-violet-100">
              Booking
            </p>
            <h3 className="mt-1 text-xl font-bold">{service.name}</h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl transition hover:bg-white/20"
            aria-label="Close booking modal"
          >
            ×
          </button>
        </div>

        {createdBooking ? (
          <div className="space-y-6 p-6">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Booking confirmed
                  </p>
                  <h4 className="mt-2 text-3xl font-black text-slate-900">
                    #{createdBooking.id}
                  </h4>
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${riskBadge.className}`}
                >
                  {riskBadge.label}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Service
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {service.name}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {service.durationInMinutes} minutes • $
                  {service.price.toFixed(2)}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Staff
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">
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
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 text-sm text-slate-500">
              <span className="font-medium text-slate-700">
                Step {step} of 3
              </span>
              <div className="flex items-center gap-2">
                {[1, 2, 3].map((currentStep) => (
                  <div
                    key={currentStep}
                    className={`h-2.5 w-2.5 rounded-full ${
                      step >= currentStep ? "bg-violet-600" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-5 p-5">
              {errorMessage && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">
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
                          className="animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="h-4 w-28 rounded-full bg-slate-200" />
                          <div className="mt-3 h-3 w-full rounded-full bg-slate-200" />
                          <div className="mt-2 h-3 w-5/6 rounded-full bg-slate-200" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {staffMembers.map((staff) => (
                        <button
                          key={staff.id}
                          type="button"
                          onClick={() => {
                            form.setValue("staffId", staff.id);
                            setErrorMessage(null);
                          }}
                          className={`rounded-2xl border p-4 text-left transition ${
                            selectedStaffId === staff.id
                              ? "border-violet-500 bg-violet-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/30"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-base font-bold text-slate-900">
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
                    <h4 className="text-lg font-bold text-slate-900">
                      Pick a date and time
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Available slots are shown based on your selected staff
                      member.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <label
                      htmlFor="booking-date"
                      className="mb-2 block text-sm font-medium text-slate-700"
                    >
                      Select date
                    </label>
                    <input
                      id="booking-date"
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={selectedDate}
                      onChange={(event) =>
                        form.setValue("selectedDate", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-violet-400"
                    />
                  </div>

                  {loadingSlots ? (
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`slot-skeleton-${index}`}
                          className="h-12 animate-pulse rounded-2xl bg-slate-200"
                        />
                      ))}
                    </div>
                  ) : slots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {slots.map((slot) => (
                        <button
                          key={`${slot.startTime}-${slot.endTime}`}
                          type="button"
                          onClick={() => form.setValue("slot", slot)}
                          className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                            selectedSlot &&
                            selectedSlot.startTime === slot.startTime &&
                            selectedSlot.endTime === slot.endTime
                              ? "border-violet-500 bg-violet-50 text-violet-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-violet-200"
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
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                      No available slots for this date. Please choose another
                      date.
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">
                      Confirm your booking
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      Review the information before submitting your request.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Service
                      </div>
                      <div className="mt-2 text-lg font-bold text-slate-900">
                        {service.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {service.durationInMinutes} min • $
                        {service.price.toFixed(2)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Staff
                      </div>
                      <div className="mt-2 text-lg font-bold text-slate-900">
                        {selectedStaff?.name}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">
                        {selectedStaff?.specialties}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Booking time
                        </div>
                        <div className="mt-2 text-base font-bold text-slate-900">
                          {selectedDate ? formatDate(selectedDate) : "—"}
                        </div>
                        <div className="text-sm text-slate-600">
                          {selectedSlot
                            ? `${formatTimeSpan(selectedSlot.startTime)} - ${formatTimeSpan(selectedSlot.endTime)}`
                            : "—"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Total
                        </div>
                        <div className="mt-2 text-2xl font-black text-slate-900">
                          ${service.price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <div className="flex items-center gap-3">
                {step > 1 && !createdBooking && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Back
                  </button>
                )}

                {!createdBooking && (
                  <button
                    type="button"
                    onClick={step === 3 ? handleSubmit : handleNext}
                    disabled={submitting}
                    className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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

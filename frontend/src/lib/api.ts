import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

export type BookingStatus =
    | "Pending"
    | "Confirmed"
    | "Completed"
    | "Cancelled"
    | "NoShow";

export type UserRole = "Customer" | "Staff" | "Admin";
export type PaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";
export type NotificationType = "booking" | "payment" | "system" | "reminder";
export type ChatRole = "user" | "assistant";

export interface ApiEnvelope<T> {
    success: boolean;
    message?: string;
    data?: T;
}

export interface ApiErrorPayload {
    success?: boolean;
    message?: string;
    error?: {
        code?: string;
        message?: string;
    };
    detail?: string;
}

export class ApiClientError extends Error {
    status: number;
    payload: ApiErrorPayload | unknown;

    constructor(status: number, message: string, payload: ApiErrorPayload | unknown) {
        super(message);
        this.name = "ApiClientError";
        this.status = status;
        this.payload = payload;
    }
}

export interface RegisterRequest {
    name: string;
    email: string;
    password: string;
    phoneNumber?: string | null;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RefreshTokenRequest {
    accessToken: string;
    refreshToken: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

export interface UpdateProfileRequest {
    name: string;
    phoneNumber?: string | null;
}

export interface AuthResponse {
    token: string;
    refreshToken: string;
    refreshTokenExpiration: string;
    name: string;
    email: string;
    role: UserRole;
}

export interface UserProfileResponse {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    phoneNumber?: string | null;
}

export interface ServiceDto {
    id: number;
    name: string;
    description: string;
    price: number;
    durationInMinutes: number;
}

export interface CreateServiceDto {
    name: string;
    description: string;
    price: number;
    durationInMinutes: number;
}

export interface UpdateServiceDto {
    name: string;
    description: string;
    price: number;
    durationInMinutes: number;
    isActive: boolean;
}

export interface StaffProfileDto {
    id: number;
    userId: number;
    name: string;
    email: string;
    phoneNumber?: string | null;
    specialties: string;
    workingHours: string;
    averageRating: number;
}

export interface BusinessInfoDto {
    id: number;
    content: string;
}

export interface CreateBookingDto {
    staffId: number;
    serviceId: number;
    dateTime: string;
}

export interface RescheduleBookingDto {
    newDateTime: string;
}

export interface BookingDetailDto {
    id: number;
    serviceId: number;
    serviceName: string;
    staffId: number;
    staffName: string;
    dateTime: string;
    durationInMinutes: number;
    price: number;
    status: BookingStatus;
    noShowProbability?: number | null;
}

export interface AvailabilitySlotDto {
    startTime: string;
    endTime: string;
    isAvailable: boolean;
}

export interface CreateReviewDto {
    bookingId: number;
    rating: number;
    comment?: string | null;
}

export interface ReviewDto {
    id: number;
    bookingId: number;
    customerName: string;
    rating: number;
    comment?: string | null;
}

export interface ChatMessageItemDto {
    role: ChatRole | string;
    content: string;
}

export interface ChatRequestDto {
    message: string;
    businessId?: number;
    sessionId?: string | null;
    conversationHistory?: ChatMessageItemDto[] | null;
}

export interface ChatResponseDto {
    reply: string;
    sessionId?: string | null;
    sourceUsed: boolean;
    isFallback: boolean;
    timestamp: string;
}

export interface StaffScheduleDto {
    id: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
}

export interface StaffBookingItemDto {
    id: number;
    customerId: number;
    customerName: string;
    customerPhone: string;
    serviceId: number;
    serviceName: string;
    durationInMinutes: number;
    price: number;
    dateTime: string;
    status: BookingStatus;
    noShowProbability?: number | null;
}

export interface RequestDayOffDto {
    date: string;
    reason?: string | null;
}

export interface AdminDashboardSummaryDto {
    todayBookingsCount: number;
    expectedRevenueToday: number;
    completedBookingsToday: number;
    highRiskNoShowsCount: number;
}

export interface AnalyticsSummaryDto {
    totalRevenue: number;
    totalBookings: number;
    cancelledBookings: number;
    cancellationRatePercentage: number;
}

export interface ServicePerformanceDto {
    serviceId: number;
    serviceName: string;
    totalBookings: number;
    totalRevenueGenerated: number;
}

export interface PeakHourDto {
    hour24: number;
    displayHour: string;
    bookingCount: number;
}

export interface NoShowRateDto {
    overallNoShowRatePercentage: number;
    totalNoShowCount: number;
    highRiskPredictionsCount: number;
}

export interface OverrideBookingDto {
    status?: string;
    newDateTime?: string | null;
    newStaffId?: number | null;
}

export interface UpdateBusinessAiDataDto {
    businessName: string;
    workingHoursInfo: string;
    policyInfo: string;
    servicesSummary: string;
    customInstructions: string;
}

export interface NoShowPredictionRequest {
    customerId: number;
    totalPastBookings: number;
    pastNoShowsCount: number;
    pastCancellationsCount?: number;
    leadTimeDays: number;
    bookingHour: number;
    bookingDayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
    daysSinceLastNoShow?: number | null;
}

export interface NoShowPredictionResponse {
    probability: number;
    riskLevel: "Low" | "Medium" | "High";
    modelVersion: string;
    isFallback: boolean;
}

export interface PaymentRecord {
    id: number;
    bookingId?: number | null;
    amount: number;
    currency: string;
    status: PaymentStatus;
    method: string;
    createdAt: string;
    paidAt?: string | null;
}

export interface NotificationPayload {
    id?: number;
    userId?: number | null;
    bookingId?: number | null;
    staffId?: number | null;
    title?: string;
    message: string;
    type: NotificationType;
    isRead?: boolean;
    createdAt?: string;
    metadata?: Record<string, unknown>;
}

export interface BookingNotification extends NotificationPayload {
    serviceName?: string;
    status?: BookingStatus;
    dateTime?: string;
    noShowProbability?: number | null;
}

export interface BookingStatusUpdate {
    bookingId: number;
    staffId?: number | null;
    status: BookingStatus;
    message: string;
    timestamp: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const AI_BASE_URL = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000";

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

const aiMicroserviceClient: AxiosInstance = axios.create({
    baseURL: AI_BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

const readTokenFromStorage = (): string | null => {
    if (typeof window === "undefined") {
        return null;
    }

    const candidates = ["access_token", "token", "authToken"];
    for (const key of candidates) {
        const value = window.localStorage.getItem(key);
        if (value) {
            return value;
        }
    }

    const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("access_token="));

    if (!cookieValue) {
        return null;
    }

    return decodeURIComponent(cookieValue.split("=")[1] ?? "");
};

const clearAuthStorage = (): void => {
    if (typeof window === "undefined") {
        return;
    }

    ["access_token", "token", "authToken", "refresh_token"].forEach((key) => {
        window.localStorage.removeItem(key);
    });

    document.cookie = "access_token=; Max-Age=0; path=/";
    document.cookie = "refresh_token=; Max-Age=0; path=/";
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = readTokenFromStorage();

    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

const normalizeError = (error: AxiosError<ApiErrorPayload>): ApiClientError => {
    const status = error.response?.status ?? 0;
    const payload = error.response?.data ?? { message: error.message };

    const message =
        typeof payload === "object" && payload !== null
            ? payload.message ??
            payload.error?.message ??
            payload.detail ??
            error.message
            : error.message;

    return new ApiClientError(status, String(message), payload);
};

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorPayload>) => {
        const apiError = normalizeError(error);

        if (apiError.status === 401) {
            clearAuthStorage();

            if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
                window.location.assign("/login");
            }
        }

        return Promise.reject(apiError);
    },
);

aiMicroserviceClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = readTokenFromStorage();
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

aiMicroserviceClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorPayload>) => {
        const apiError = normalizeError(error);
        return Promise.reject(apiError);
    },
);

const unwrapData = <T>(payload: ApiEnvelope<T> | T): T => {
    if (payload && typeof payload === "object" && "data" in payload && payload.data !== undefined) {
        return (payload as ApiEnvelope<T>).data as T;
    }

    return payload as T;
};

export const authApi = {
    async login(data: LoginRequest): Promise<AuthResponse> {
        const response = await api.post<ApiEnvelope<AuthResponse> | AuthResponse>("/auth/login", data);
        return unwrapData(response.data);
    },

    async register(data: RegisterRequest): Promise<AuthResponse> {
        const response = await api.post<ApiEnvelope<AuthResponse> | AuthResponse>("/auth/register", data);
        return unwrapData(response.data);
    },

    async me(): Promise<UserProfileResponse> {
        const response = await api.get<UserProfileResponse>("/account/me");
        return response.data;
    },

    async refreshToken(data: RefreshTokenRequest): Promise<AuthResponse> {
        const response = await api.post<ApiEnvelope<AuthResponse> | AuthResponse>("/auth/refresh-token", data);
        return unwrapData(response.data);
    },

    async revokeToken(token: string): Promise<boolean> {
        const response = await api.post<{ success: boolean; message?: string }>("/auth/revoke-token", token);
        return response.data.success;
    },

    async logout(refreshToken: string): Promise<boolean> {
        const response = await api.post<{ success: boolean; message?: string }>("/auth/logout", refreshToken);
        return response.data.success;
    },
};

export const accountApi = {
    async getProfile(): Promise<UserProfileResponse> {
        const response = await api.get<UserProfileResponse>("/account/me");
        return response.data;
    },

    async updateProfile(data: UpdateProfileRequest): Promise<boolean> {
        const response = await api.put<{ success?: boolean; message?: string }>("/account/me", data);
        return response.data.success !== false;
    },

    async changePassword(data: ChangePasswordRequest): Promise<boolean> {
        const response = await api.put<{ success?: boolean; message?: string }>("/account/change-password", data);
        return response.data.success !== false;
    },
};

export const bookingsApi = {
    async getAll(params?: { status?: string; date?: string }): Promise<BookingDetailDto[]> {
        const response = await api.get<BookingDetailDto[]>("/bookings", { params });
        return response.data;
    },

    async getMyBookings(): Promise<BookingDetailDto[]> {
        const response = await api.get<BookingDetailDto[]>("/bookings/my-bookings");
        return response.data;
    },

    async getById(id: number): Promise<BookingDetailDto> {
        const response = await api.get<BookingDetailDto>(`/bookings/${id}`);
        return response.data;
    },

    async create(data: CreateBookingDto): Promise<{ message: string; bookingId: number }> {
        const response = await api.post<{ message: string; bookingId: number }>("/bookings", data);
        return response.data;
    },

    async reschedule(id: number, data: RescheduleBookingDto): Promise<{ message: string }> {
        const response = await api.put<{ message: string }>(`/bookings/${id}/reschedule`, data);
        return response.data;
    },

    async cancel(id: number): Promise<{ message: string }> {
        const response = await api.put<{ message: string }>(`/bookings/${id}/cancel`);
        return response.data;
    },

    async updateStatus(id: number, status: "confirm" | "complete" | "mark-no-show",): Promise<{ message: string }> {
        const endpointMap: Record<typeof status, string> = {
            confirm: `/bookings/${id}/confirm`,
            complete: `/bookings/${id}/complete`,
            "mark-no-show": `/bookings/${id}/mark-no-show`,
        };

        const response = await api.put<{ message: string }>(endpointMap[status]);
        return response.data;
    },
};

export const servicesApi = {
    async getServices(): Promise<ServiceDto[]> {
        const response = await api.get<ServiceDto[]>("/services");
        return response.data;
    },

    async getById(id: number): Promise<ServiceDto> {
        const response = await api.get<ServiceDto>(`/services/${id}`);
        return response.data;
    },

    async create(data: CreateServiceDto): Promise<ServiceDto> {
        const response = await api.post<ServiceDto>("/services", data);
        return response.data;
    },

    async update(id: number, data: UpdateServiceDto): Promise<{ message: string; service: ServiceDto }> {
        const response = await api.put<{ message: string; service: ServiceDto }>(`/services/${id}`, data);
        return response.data;
    },

    async remove(id: number): Promise<{ message: string }> {
        const response = await api.delete<{ message: string }>(`/services/${id}`);
        return response.data;
    },
};

export const staffApi = {
    async getStaff(): Promise<StaffProfileDto[]> {
        const response = await api.get<StaffProfileDto[]>("/staff");
        return response.data;
    },

    async getById(id: number): Promise<StaffProfileDto> {
        const response = await api.get<StaffProfileDto>(`/staff/${id}`);
        return response.data;
    },

    async getAvailableSlots(staffId: number, date: string): Promise<AvailabilitySlotDto[]> {
        const response = await api.get<AvailabilitySlotDto[]>(`/staff/${staffId}/availability`, {
            params: { date },
        });
        return response.data;
    },

    async getMySchedule(): Promise<StaffScheduleDto[]> {
        const response = await api.get<StaffScheduleDto[]>("/staff/my-schedule");
        return response.data;
    },

    async getMyBookings(date?: string): Promise<StaffBookingItemDto[]> {
        const response = await api.get<StaffBookingItemDto[]>("/staff/my-bookings", {
            params: date ? { date } : undefined,
        });
        return response.data;
    },

    async requestDayOff(data: RequestDayOffDto): Promise<{ message: string; affectedBookings: number }> {
        const response = await api.put<{ message: string; affectedBookings: number }>("/staff/schedule/day-off", data);
        return response.data;
    },
};

export const aiApi = {
    async sendChatMessage(data: ChatRequestDto): Promise<ChatResponseDto> {
        const response = await api.post<ChatResponseDto>("/ai/chat", data);
        return response.data;
    },

    async getPrediction(data: NoShowPredictionRequest): Promise<NoShowPredictionResponse> {
        const response = await api.post<NoShowPredictionResponse>("/ai/predict-no-show", data);
        return response.data;
    },
};

export const aiApiRaw = aiMicroserviceClient;

export const businessInfoApi = {
    async getInfo(): Promise<BusinessInfoDto[]> {
        const response = await api.get<BusinessInfoDto[]>("/business/info");
        return response.data;
    },
};

export const reviewsApi = {
    async create(data: CreateReviewDto): Promise<ReviewDto> {
        const response = await api.post<ReviewDto>("/reviews", data);
        return response.data;
    },

    async getByStaff(staffId: number): Promise<ReviewDto[]> {
        const response = await api.get<ReviewDto[]>(`/reviews/staff/${staffId}`);
        return response.data;
    },
};

export const adminApi = {
    async getDashboardSummary(): Promise<AdminDashboardSummaryDto> {
        const response = await api.get<AdminDashboardSummaryDto>("/admin/dashboard/summary");
        return response.data;
    },

    async getLiveBookings(): Promise<Array<Record<string, unknown>>> {
        const response = await api.get<Array<Record<string, unknown>>>("/admin/bookings/live");
        return response.data;
    },

    async getBookings(status?: string, date?: string): Promise<Array<Record<string, unknown>>> {
        const response = await api.get<Array<Record<string, unknown>>>("/admin/bookings", {
            params: { status, date },
        });
        return response.data;
    },

    async overrideBooking(id: number, data: OverrideBookingDto): Promise<{ message: string }> {
        const response = await api.put<{ message: string }>(`/admin/bookings/${id}/override`, data);
        return response.data;
    },

    async updateBusinessAiData(data: UpdateBusinessAiDataDto): Promise<{ message: string; updatedAt: string; data: UpdateBusinessAiDataDto }> {
        const response = await api.post<{ message: string; updatedAt: string; data: UpdateBusinessAiDataDto }>("/admin/ai/business-data", data);
        return response.data;
    },
};

export const analyticsApi = {
    async getSummary(): Promise<AnalyticsSummaryDto> {
        const response = await api.get<AnalyticsSummaryDto>("/analytics/summary");
        return response.data;
    },

    async getServicesPerformance(): Promise<ServicePerformanceDto[]> {
        const response = await api.get<ServicePerformanceDto[]>("/analytics/services-performance");
        return response.data;
    },

    async getPeakHours(): Promise<PeakHourDto[]> {
        const response = await api.get<PeakHourDto[]>("/analytics/peak-hours");
        return response.data;
    },

    async getNoShowRate(): Promise<NoShowRateDto> {
        const response = await api.get<NoShowRateDto>("/analytics/no-show-rate");
        return response.data;
    },
};

export { api, aiMicroserviceClient as aiMicroserviceApi, AI_BASE_URL };

export const authStorage = {
    setAccessToken(token: string): void {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem("access_token", token);
        document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}`;
    },

    setRefreshToken(token: string): void {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem("refresh_token", token);
        document.cookie = `refresh_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}`;
    },

    getAccessToken: readTokenFromStorage,
    clear: clearAuthStorage,
};

export const architectureNotes = {
    improvements: [
        "Use a typed ApiResponse wrapper for every endpoint and centralize domain-specific error models instead of relying on loose unknown payloads.",
        "Introduce refresh-token rotation with a single in-memory refresh queue and silent token refresh before 401 errors surface to the UI.",
        "Move all route-specific logic into a feature-oriented client layer (e.g. bookingsApi, staffApi, aiApi) to reduce state duplication and enable easy testability.",
        "Normalize backend DateTime values to ISO strings and map them in one shared serializer layer to avoid locale drift across browsers.",
    ],
};

"""
schemas.py
-----------
يحتوي هذا الملف على جميع الـ Pydantic Models (Schemas) المستخدمة في خدمة BookFlowAI
للذكاء الاصطناعي. تم تصميم الحقول بعناية لضمان أعلى مستوى من الـ Validation، مع توثيق
كامل لكل حقل داخل واجهة Swagger (OpenAPI Docs) عبر أمثلة (Examples) واقعية.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ==============================================================================================
# Enums
# ==============================================================================================

class RiskLevel(str, Enum):
    """مستوى خطورة عدم حضور العميل للحجز"""
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


class ChatRole(str, Enum):
    """دور المرسل داخل سجل المحادثة"""
    USER = "user"
    ASSISTANT = "assistant"


# ==============================================================================================
# No-Show Prediction Schemas
# ==============================================================================================

class NoShowPredictionRequest(BaseModel):
    """
    بيانات الحجز المطلوبة لتوقع احتمالية عدم حضور العميل (No-Show).
    كل هذه الحقول تُشكّل الـ Features التي يعتمد عليها نموذج الـ Machine Learning.
    """

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "customer_id": 1024,
                "total_past_bookings": 12,
                "past_no_shows_count": 2,
                "past_cancellations_count": 1,
                "lead_time_days": 3,
                "booking_hour": 18,
                "booking_day_of_week": 4,
                "is_weekend": False,
                "is_holiday": False,
                "days_since_last_no_show": 45,
            }
        }
    )

    customer_id: int = Field(..., gt=0, description="المعرف الفريد للعميل داخل النظام")
    total_past_bookings: int = Field(
        ..., ge=0, description="إجمالي عدد الحجوزات السابقة للعميل (يُستخدم لحساب معدل الحضور التاريخي)"
    )
    past_no_shows_count: int = Field(
        ..., ge=0, description="عدد المرات التي لم يحضر فيها العميل لحجوزاته السابقة"
    )
    past_cancellations_count: int = Field(
        default=0, ge=0, description="عدد مرات الإلغاء المسبق من قِبل العميل (مؤشر مختلف عن عدم الحضور)"
    )
    lead_time_days: int = Field(
        ..., ge=0, le=365, description="عدد الأيام الفاصلة بين تاريخ إنشاء الحجز وتاريخ الموعد الفعلي"
    )
    booking_hour: int = Field(
        ..., ge=0, le=23, description="الساعة المحددة للحجز بنظام 24 ساعة (0 - 23)"
    )
    booking_day_of_week: int = Field(
        default=0, ge=0, le=6, description="يوم الأسبوع للحجز (0 = الإثنين ... 6 = الأحد)"
    )
    is_weekend: bool = Field(default=False, description="هل الموعد يقع في عطلة نهاية الأسبوع؟")
    is_holiday: bool = Field(default=False, description="هل الموعد يصادف يوم عطلة رسمية/مناسبة؟")
    days_since_last_no_show: Optional[int] = Field(
        default=None,
        ge=0,
        description="عدد الأيام منذ آخر مرة لم يحضر فيها العميل (اتركه فارغًا إن لم يسبق له ذلك)",
    )

    @field_validator("past_no_shows_count")
    @classmethod
    def no_shows_cannot_exceed_bookings(cls, v: int, info):
        total = info.data.get("total_past_bookings")
        if total is not None and v > total:
            raise ValueError("عدد مرات عدم الحضور لا يمكن أن يتجاوز إجمالي عدد الحجوزات السابقة")
        return v


class NoShowPredictionResponse(BaseModel):
    """نتيجة توقع احتمالية عدم حضور العميل"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "probability": 0.42,
                "risk_level": "Medium",
                "model_version": "2.0.0",
                "is_fallback": False,
            }
        }
    )

    probability: float = Field(..., ge=0.0, le=1.0, description="احتمالية عدم حضور العميل (من 0 إلى 1)")
    risk_level: RiskLevel = Field(..., description="تصنيف مستوى الخطورة بناءً على الاحتمالية")
    model_version: str = Field(default="2.0.0", description="إصدار نموذج الـ ML المستخدم في التوقع")
    is_fallback: bool = Field(
        default=False,
        description="يشير إلى ما إذا تم استخدام قيمة احتياطية (Fallback) بسبب تعذر التوقع الفعلي",
    )


# ==============================================================================================
# Chat / RAG Schemas
# ==============================================================================================

class ChatMessage(BaseModel):
    """رسالة واحدة داخل سجل المحادثة (تُستخدم لبناء الذاكرة السياقية للمساعد الذكي)"""

    role: ChatRole = Field(..., description="مرسل الرسالة: عميل (user) أو المساعد (assistant)")
    content: str = Field(..., min_length=1, max_length=2000, description="نص الرسالة")


class ChatRequest(BaseModel):
    """طلب محادثة مع المساعد الذكي القائم على RAG"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "business_id": 7,
                "session_id": "b7-customer-1024",
                "message": "ما الخدمات المتاحة وكيف يمكنني حجز موعد؟",
                "conversation_history": [
                    {"role": "user", "content": "ما هي مواعيد العمل؟"},
                    {"role": "assistant", "content": "نعمل يوميًا من 10 صباحًا حتى 10 مساءً."},
                ],
            }
        }
    )

    business_id: int = Field(..., gt=0, description="معرف المنشأة صاحبة قاعدة المعرفة")
    session_id: Optional[str] = Field(
        default=None,
        max_length=100,
        description="معرف فريد لجلسة المحادثة، يُستخدم لتفعيل ذاكرة المحادثة عبر الرسائل المتعددة",
    )
    message: str = Field(..., min_length=1, max_length=1000, description="سؤال أو رسالة العميل")
    conversation_history: Optional[List[ChatMessage]] = Field(
        default=None,
        max_length=20,
        description="سجل المحادثة السابق (اختياري) في حال عدم الاعتماد على session_id من جهة الخادم",
    )


class ChatResponse(BaseModel):
    """رد المساعد الذكي على العميل"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "reply": "يمكنك اختيار الخدمة المناسبة ثم مقدم الخدمة والموعد المتاح.",
                "session_id": "b7-customer-1024",
                "source_used": True,
                "is_fallback": False,
            }
        }
    )

    reply: str = Field(..., description="رد المساعد الذكي")
    session_id: Optional[str] = Field(default=None, description="معرف الجلسة (يُعاد كما وصل من الطلب)")
    source_used: bool = Field(
        default=False,
        description="هل تم الاعتماد على بيانات مسترجعة من قاعدة معرفة المنشأة في توليد الرد؟",
    )
    is_fallback: bool = Field(
        default=False, description="يشير إلى استخدام رد احتياطي بسبب تعطل/تجاوز حد نموذج اللغة (LLM)"
    )


# ==============================================================================================
# Business Data Ingestion Schemas
# ==============================================================================================

class ServiceItem(BaseModel):
    """بيانات خدمة واحدة تقدمها المنشأة"""

    name: str = Field(..., min_length=1, max_length=150, description="اسم الخدمة")
    category: Optional[str] = Field(default=None, max_length=120, description="تصنيف النشاط الديناميكي")
    price: float = Field(..., ge=0, description="سعر الخدمة بالجنيه المصري")
    description: Optional[str] = Field(default=None, max_length=500, description="وصف مختصر للخدمة (اختياري)")
    duration_minutes: Optional[int] = Field(
        default=None, ge=1, le=600, description="مدة الخدمة بالدقائق (اختياري)"
    )


class IngestBusinessDataRequest(BaseModel):
    """طلب تخزين/تحديث بيانات المنشأة داخل قاعدة المعرفة الخاصة بـ RAG"""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "business_id": 7,
                "business_name": "مركز الخدمات المتكاملة",
                "business_category": "Consultation Services",
                "services": [
                    {"name": "استشارة مهنية", "category": "Professional Coaching", "price": 500.0, "duration_minutes": 60},
                    {"name": "تقييم أولي", "category": "Consultation Services", "price": 250.0, "duration_minutes": 30},
                ],
                "policies": "يجب الحضور قبل الموعد بـ 10 دقائق. يُسمح بإلغاء الحجز حتى 24 ساعة قبل الموعد.",
            }
        }
    )

    business_id: int = Field(..., gt=0, description="المعرف الفريد للمنشأة")
    business_name: Optional[str] = Field(default=None, max_length=200, description="اسم المنشأة (اختياري)")
    business_category: Optional[str] = Field(default=None, max_length=120, description="تصنيف الصناعة أو النشاط")
    services: List[ServiceItem] = Field(default_factory=list, description="قائمة بخدمات المنشأة")
    policies: str = Field(default="", max_length=3000, description="سياسات المنشأة (الإلغاء، الحضور، الدفع...)")


# ==============================================================================================
# Standard API Response Wrappers (تُستخدم داخل الـ Error Handling Middleware)
# ==============================================================================================

class ErrorDetail(BaseModel):
    """تفاصيل الخطأ الموحدة التي تُعاد للعميل عند حدوث أي استثناء"""

    code: str = Field(..., description="كود الخطأ الداخلي")
    message: str = Field(..., description="رسالة الخطأ القابلة للعرض للمستخدم/الـ Backend")


class StandardErrorResponse(BaseModel):
    """الشكل الموحد لأي رد خطأ يصدر من الخدمة، لضمان تعامل الـ .NET Backend بشكل ثابت"""

    success: bool = Field(default=False)
    error: ErrorDetail

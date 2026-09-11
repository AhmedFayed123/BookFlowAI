import logging
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from schemas import (
    NoShowPredictionRequest, NoShowPredictionResponse,
    ChatRequest, ChatResponse,
    IngestBusinessDataRequest,
    StandardErrorResponse, ErrorDetail
)

# إعداد الـ Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BookFlowAI.Main")

app = FastAPI(
    title="BookFlowAI - Microservice",
    version="2.0.0",
    description="خدمة الذكاء الاصطناعي لتوقع عدم الحضور والمساعد الذكي القائم على RAG"
)


# ==============================================================================================
# Global Exception Handlers
# ==============================================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """التقاط أخطاء الـ Validation وإعادتها بـ StandardErrorResponse"""
    first_err = exc.errors()[0]
    msg = f"خطأ في المدخلات: {first_err.get('msg')} في الحقل {first_err.get('loc')}"
    
    error_payload = StandardErrorResponse(
        success=False,
        error=ErrorDetail(code="VALIDATION_ERROR", message=msg)
    )
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=error_payload.model_dump())


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """التقاط أي استثناء عام غير متوقع"""
    logger.error(f"خطأ عام داخل الخدمة: {str(exc)}", exc_info=True)
    error_payload = StandardErrorResponse(
        success=False,
        error=ErrorDetail(code="INTERNAL_SERVER_ERROR", message="حدث خطأ غير متوقع داخل خدمة الذكاء الاصطناعي.")
    )
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=error_payload.model_dump())


# ==============================================================================================
# Endpoints
# ==============================================================================================

@app.get("/health", tags=["Health"])
async def health_check():
    """فحص حالة الخدمة (Docker Healthcheck)"""
    return {"status": "ok", "service": "BookFlowAI.AI Engine", "version": "2.0.0"}


@app.get("/healthz", tags=["Health"])
async def healthz_check():
    """Health endpoint compatible with orchestration, load balancers, and uptime monitors."""
    return {"status": "ok", "service": "BookFlowAI.AI Engine", "version": "2.0.0"}


@app.get("/readyz", tags=["Health"])
async def readyz_check():
    """Readiness endpoint for container orchestration."""
    return {"status": "ready", "service": "BookFlowAI.AI Engine", "version": "2.0.0"}


@app.post(
    "/predict-no-show",
    response_model=NoShowPredictionResponse,
    tags=["Machine Learning"]
)
async def predict_no_show_endpoint(request: NoShowPredictionRequest):
    """حساب احتمالية عدم حضور العميل بناءً على نموذج ML متقدم"""
    from ml_engine import predict_no_show
    return predict_no_show(request)


@app.post(
    "/chat",
    response_model=ChatResponse,
    tags=["RAG & Chatbot"]
)
async def chat_endpoint(request: ChatRequest):
    """المساعد الذكي للإجابة على استفسارات العملاء بناءً على سياق المنشأة"""
    from rag_engine import generate_chat_response
    return await generate_chat_response(request)


@app.post(
    "/ingest-business-data",
    tags=["Business Knowledge"]
)
async def ingest_business_data_endpoint(request: IngestBusinessDataRequest):
    """تحديث قاعدة المعرفة (Vector DB) بخدمات وسياسات المنشأة"""
    from rag_engine import ingest_business_data_to_vector_db
    count = ingest_business_data_to_vector_db(request)
    return {
        "success": True,
        "message": f"تم تخزين وتحويل {count} عنصر إلى Embeddings بنجاح داخل ChromaDB للمنشأة رقم {request.business_id}."
    }

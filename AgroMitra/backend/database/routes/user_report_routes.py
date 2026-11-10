from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.database.models.product import Product
from backend.database.models.user import User, UserRole
from backend.database.models.user_report import ReportStatus, ReportTargetType, UserReport
from backend.database.routes.auth_routes import get_current_user
from backend.database.schemas.user_report_schema import (
    UserReportCreate,
    UserReportResponse,
    UserReportUpdate,
)

router = APIRouter(prefix="/api/v1/reports", tags=["Reports"])


def _build_response(report: UserReport, db: Session) -> UserReportResponse:
    reporter = db.query(User).filter(User.user_id == report.reporter_id).first()
    product = (
        db.query(Product).filter(Product.product_id == report.target_product_id).first()
        if report.target_product_id else None
    )
    target_user = (
        db.query(User).filter(User.user_id == report.target_user_id).first()
        if report.target_user_id else None
    )
    return UserReportResponse(
        report_id=report.report_id,
        reporter_id=report.reporter_id,
        reporter_name=reporter.name_en if reporter else None,
        target_type=report.target_type,
        target_product_id=report.target_product_id,
        target_product_name=product.title_en if product else None,
        target_user_id=report.target_user_id,
        target_user_name=target_user.name_en if target_user else None,
        reason=report.reason,
        status=report.status,
        admin_note=report.admin_note,
        created_at=report.created_at,
        resolved_at=report.resolved_at,
    )


@router.post("/", response_model=UserReportResponse, status_code=201)
async def create_report(
    payload: UserReportCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.buyer, UserRole.consumer):
        raise HTTPException(status_code=403, detail="Only buyers can report listings or users.")

    if payload.target_type == ReportTargetType.listing:
        if not payload.target_product_id or payload.target_user_id:
            raise HTTPException(status_code=422, detail="A listing report must include only target_product_id.")
        if not db.query(Product.product_id).filter(Product.product_id == payload.target_product_id).first():
            raise HTTPException(status_code=404, detail="Listing not found.")
        target_product_id, target_user_id = payload.target_product_id, None
    else:
        if not payload.target_user_id or payload.target_product_id:
            raise HTTPException(status_code=422, detail="A user report must include only target_user_id.")
        if str(payload.target_user_id) == str(current_user.user_id):
            raise HTTPException(status_code=400, detail="You cannot report your own account.")
        if not db.query(User.user_id).filter(User.user_id == payload.target_user_id).first():
            raise HTTPException(status_code=404, detail="User not found.")
        target_product_id, target_user_id = None, payload.target_user_id

    report = UserReport(
        reporter_id=current_user.user_id,
        target_type=payload.target_type,
        target_product_id=target_product_id,
        target_user_id=target_user_id,
        reason=payload.reason.strip(),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return _build_response(report, db)


@router.get("/admin", response_model=List[UserReportResponse])
async def list_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    reports = db.query(UserReport).order_by(UserReport.created_at.desc()).limit(500).all()
    return [_build_response(report, db) for report in reports]


@router.put("/admin/{report_id}", response_model=UserReportResponse)
async def update_report(
    report_id: UUID,
    payload: UserReportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required.")
    report = db.query(UserReport).filter(UserReport.report_id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.status = payload.status
    report.admin_note = payload.admin_note.strip() if payload.admin_note else None
    report.resolved_at = datetime.utcnow() if payload.status == ReportStatus.resolved else None
    db.commit()
    db.refresh(report)
    return _build_response(report, db)

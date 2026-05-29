from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.database import get_db
from app.models import User, UserStatus

bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        if user_id is None:
            raise ValueError
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or unknown user")
    return user


def require_treasurer(user: User = Depends(get_current_user)) -> User:
    if user.role.value != "treasurer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Treasurer role required")
    return user


def require_approver(user: User = Depends(get_current_user)) -> User:
    if not user.can_approve:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Approval permission required")
    return user

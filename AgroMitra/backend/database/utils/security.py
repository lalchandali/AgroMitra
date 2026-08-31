import os
import secrets
import string
from datetime import datetime, timedelta

import bcrypt
from jose import JWTError, jwt

# ⚠️ JWT_SECRET_KEY অবশ্যই backend/.env ফাইলে সেট করতে হবে।
# নিচের ভ্যালুটা শুধু local dev-এ ভুলে .env সেট করতে ভুলে গেলে
# app crash না করে চালু থাকার জন্য একটা fallback — production-এ
# এটার উপর ভরসা করা যাবে না, কারণ এটা source code-এ visible।
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-only-fallback-change-me-in-env")
ALGORITHM  = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS   = 7

# ── Password Hashing ──────────────────────────────────────────
def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode('utf-8')[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode('utf-8'))

# ── JWT Tokens ────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta=None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

# ── OTP ───────────────────────────────────────────────────────
OTP_STORAGE = {}

def generate_otp(mobile_number: str) -> str:
    otp = ''.join(secrets.choice(string.digits) for _ in range(6))
    OTP_STORAGE[mobile_number] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=5),
        "attempts": 0,
    }
    return otp

def verify_otp(mobile_number: str, otp_input: str):
    record = OTP_STORAGE.get(mobile_number)
    if not record:
        return False, "OTP not found."
    if datetime.utcnow() > record["expires_at"]:
        del OTP_STORAGE[mobile_number]
        return False, "OTP expired."
    if record["attempts"] >= 3:
        del OTP_STORAGE[mobile_number]
        return False, "Too many attempts."
    if record["otp"] != otp_input:
        record["attempts"] += 1
        return False, f"Invalid OTP. {3 - record['attempts']} attempts remaining."
    del OTP_STORAGE[mobile_number]
    return True, "OTP verified successfully."


# ── Login Brute-Force Protection ────────────────────────────────
# OTP_STORAGE-এর মতোই in-memory dict — মনে রাখবেন এটাও শুধু single-process
# dev/small deployment-এর জন্য কাজ করে ঠিকভাবে; একাধিক worker/instance
# নিয়ে production-এ চালাতে হলে এটা Redis বা DB টেবিলে সরিয়ে নিতে হবে,
# নাহলে প্রতিটা worker আলাদা count রাখবে আর lockout ঠিকভাবে কাজ করবে না।
LOGIN_ATTEMPTS = {}
MAX_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_MINUTES = 15


def check_login_lockout(mobile_number: str):
    """Locked থাকলে (remaining_minutes, True) — নাহলে (0, False)।"""
    record = LOGIN_ATTEMPTS.get(mobile_number)
    if not record:
        return 0, False
    locked_until = record.get("locked_until")
    if locked_until and datetime.utcnow() < locked_until:
        remaining = int((locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        return remaining, True
    if locked_until and datetime.utcnow() >= locked_until:
        del LOGIN_ATTEMPTS[mobile_number]
    return 0, False


def record_failed_login(mobile_number: str):
    record = LOGIN_ATTEMPTS.setdefault(mobile_number, {"count": 0, "locked_until": None})
    record["count"] += 1
    if record["count"] >= MAX_LOGIN_ATTEMPTS:
        record["locked_until"] = datetime.utcnow() + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)


def reset_login_attempts(mobile_number: str):
    LOGIN_ATTEMPTS.pop(mobile_number, None)
# Iteration 6: email verification, resend, forgot/reset password, legacy logins, blast engine
import os
import re
import time
import uuid
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
LOG = "/var/log/supervisor/backend.err.log"


def link_for(email, kind, wait=3.0):
    """Return the latest raw token logged for this email and kind (verify-email / reset-password)."""
    deadline = time.time() + wait
    while time.time() < deadline:
        out = subprocess.run(["grep", "-a", f"email to {email} not sent", LOG], capture_output=True, text=True).stdout
        toks = re.findall(rf"{kind}\?token=(\S+)", out)
        if toks:
            return toks
        time.sleep(0.3)
    return []


@pytest.fixture(scope="module")
def s():
    x = requests.Session()
    x.headers.update({"Content-Type": "application/json"})
    return x


@pytest.fixture(scope="module")
def new_user(s):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "pass123", "username": "TEST_u"})
    assert r.status_code == 200, r.text
    return {"email": email, "resp": r.json()}


# Legacy accounts
class TestLegacy:
    @pytest.mark.parametrize("email,pw", [("admin@robostrike.com", "admin123"), ("player@robostrike.com", "player123")])
    def test_legacy_login(self, s, email, pw):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == email and isinstance(d["token"], str)


# Register + verify
class TestVerify:
    def test_register_pending(self, new_user):
        assert new_user["resp"] == {"pending": True, "email": new_user["email"]}

    def test_duplicate_register(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/register", json={"email": new_user["email"], "password": "pass123", "username": "TEST_u"})
        assert r.status_code == 400

    def test_login_unverified_403(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": new_user["email"], "password": "pass123"})
        assert r.status_code == 403 and r.json()["detail"] == "email_not_verified"

    def test_resend_cooldown(self, s, new_user):
        before = len(link_for(new_user["email"], "verify-email"))
        r = s.post(f"{BASE_URL}/api/auth/resend-verification", json={"email": new_user["email"]})
        assert r.status_code == 200 and r.json() == {"ok": True}
        time.sleep(1)
        assert len(link_for(new_user["email"], "verify-email")) == before  # cooldown -> no new link

    def test_resend_unknown_email(self, s):
        r = s.post(f"{BASE_URL}/api/auth/resend-verification", json={"email": "nobody_xyz@example.com"})
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_verify_and_reuse(self, s, new_user):
        toks = link_for(new_user["email"], "verify-email")
        assert toks, "verify link not found in log"
        tok = toks[-1]
        r = s.post(f"{BASE_URL}/api/auth/verify-email", json={"token": tok})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["email"] == new_user["email"] and d["token"]
        me = s.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {d['token']}"})
        assert me.status_code == 200 and me.json()["email"] == new_user["email"]
        r2 = s.post(f"{BASE_URL}/api/auth/verify-email", json={"token": tok})
        assert r2.status_code == 400 and r2.json()["detail"] == "invalid_or_expired_token"

    def test_login_after_verify(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": new_user["email"], "password": "pass123"})
        assert r.status_code == 200

    def test_verify_bad_token(self, s):
        r = s.post(f"{BASE_URL}/api/auth/verify-email", json={"token": "bad"})
        assert r.status_code == 400 and r.json()["detail"] == "invalid_or_expired_token"


# Forgot / reset
class TestReset:
    def test_forgot_unknown(self, s):
        r = s.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "nobody_xyz@example.com", "lang": "en"})
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_reset_flow(self, s, new_user):
        r = s.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": new_user["email"], "lang": "es"})
        assert r.status_code == 200 and r.json() == {"ok": True}
        toks = link_for(new_user["email"], "reset-password")
        assert len(toks) == 1
        # second within cooldown -> no new link
        s.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": new_user["email"]})
        time.sleep(1)
        assert len(link_for(new_user["email"], "reset-password")) == 1
        tok = toks[-1]
        short = s.post(f"{BASE_URL}/api/auth/reset-password", json={"token": tok, "password": "123"})
        assert short.status_code == 422
        r = s.post(f"{BASE_URL}/api/auth/reset-password", json={"token": tok, "password": "newpass456"})
        assert r.status_code == 200 and r.json() == {"ok": True}
        r2 = s.post(f"{BASE_URL}/api/auth/reset-password", json={"token": tok, "password": "other789"})
        assert r2.status_code == 400 and r2.json()["detail"] == "invalid_or_expired_token"
        old = s.post(f"{BASE_URL}/api/auth/login", json={"email": new_user["email"], "password": "pass123"})
        assert old.status_code == 401
        new = s.post(f"{BASE_URL}/api/auth/login", json={"email": new_user["email"], "password": "newpass456"})
        assert new.status_code == 200

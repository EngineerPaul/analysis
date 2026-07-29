"""Auth endpoint tests."""

import pytest
from fastapi.testclient import TestClient

from tests.conftest import register_user


def test_registration_success(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/registration",
        json={
            "login": "newuser1",
            "password": "secret1",
            "name": "Анна",
            "surname": "Сидорова",
        },
    )
    assert response.status_code == 201
    assert CookieManager_access_present(response)


def CookieManager_access_present(response) -> bool:
    cookies = response.cookies
    return "access_token" in cookies and "refresh_token" in cookies


@pytest.mark.parametrize(
    "payload,status_code",
    [
        ({"login": "ab", "password": "secret1", "name": "Анна", "surname": "Сидорова"}, 422),
        ({"login": "validuser", "password": "123", "name": "Анна", "surname": "Сидорова"}, 422),
        ({"login": "validuser", "password": "secret1", "name": "A", "surname": "Сидорова"}, 422),
        ({"login": "юзер123", "password": "secret1", "name": "Анна", "surname": "Сидорова"}, 422),
        ({"login": "validuser", "password": "secret1", "name": "Анна1", "surname": "Сидорова"}, 422),
        ({"password": "secret1", "name": "Анна", "surname": "Сидорова"}, 422),
        ({"login": "validuser", "name": "Анна", "surname": "Сидорова"}, 422),
    ],
)
def test_registration_validation(client: TestClient, payload: dict, status_code: int) -> None:
    response = client.post("/api/v1/auth/registration", json=payload)
    assert response.status_code == status_code


def test_registration_duplicate_login(client: TestClient) -> None:
    register_user(client, login="dupuser")
    response = client.post(
        "/api/v1/auth/registration",
        json={
            "login": "dupuser",
            "password": "secret1",
            "name": "Анна",
            "surname": "Сидорова",
        },
    )
    assert response.status_code == 409


def test_login_success_and_fail(client: TestClient) -> None:
    register_user(client, login="loginuser", password="secret1")
    client.cookies.clear()
    ok = client.post("/api/v1/auth/login", json={"login": "loginuser", "password": "secret1"})
    assert ok.status_code == 200
    bad = client.post("/api/v1/auth/login", json={"login": "loginuser", "password": "wrong12"})
    assert bad.status_code == 401


def test_logout_and_refresh(client: TestClient) -> None:
    register_user(client, login="tokuser")
    refresh = client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 200
    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
    again = client.post("/api/v1/auth/refresh")
    assert again.status_code == 401


def test_protected_without_auth(client: TestClient) -> None:
    response = client.get("/api/v1/analysis")
    assert response.status_code == 401

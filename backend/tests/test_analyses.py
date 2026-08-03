"""Analysis endpoint tests."""

import pytest
from fastapi.testclient import TestClient

from tests.conftest import analysis_payload, register_user


def test_create_list_delete_analysis(client: TestClient) -> None:
    register_user(client)
    created = client.post("/api/v1/analyses", json=analysis_payload())
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Глюкоза"
    listed = client.get("/api/v1/analyses")
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    deleted = client.delete(f"/api/v1/analyses/{body['id']}")
    assert deleted.status_code == 204
    listed_after = client.get("/api/v1/analyses")
    assert listed_after.json() == []


@pytest.mark.parametrize(
    "overrides,expected",
    [
        ({"name": ""}, 422),
        ({"value": "abc"}, 422),
        ({"ref_upper": 5.0, "ref_lower": None}, 422),
        ({"ref_upper": 3.0, "ref_lower": 5.0}, 422),
        ({"organization": "Lab@1"}, 422),
        ({"note": "x" * 1501}, 422),
        ({"date": None}, 422),
    ],
)
def test_analysis_validation(client: TestClient, overrides: dict, expected: int) -> None:
    register_user(client, login="valuser")
    payload = analysis_payload(**overrides)
    if overrides.get("date") is None and "date" in overrides:
        payload.pop("date", None)
    response = client.post("/api/v1/analyses", json=payload)
    assert response.status_code == expected


def test_users_isolation(client: TestClient) -> None:
    register_user(client, login="userone")
    created = client.post("/api/v1/analyses", json=analysis_payload(name="Холестерин"))
    assert created.status_code == 201
    analysis_id = created.json()["id"]

    client.cookies.clear()
    register_user(client, login="usertwo")
    listed = client.get("/api/v1/analyses")
    assert listed.json() == []
    deleted = client.delete(f"/api/v1/analyses/{analysis_id}")
    assert deleted.status_code == 404


def test_analysis_without_references(client: TestClient) -> None:
    register_user(client, login="norefuser")
    payload = analysis_payload()
    payload["ref_upper"] = None
    payload["ref_lower"] = None
    response = client.post("/api/v1/analyses", json=payload)
    assert response.status_code == 201
    assert response.json()["ref_upper"] is None


def test_update_analysis(client: TestClient) -> None:
    register_user(client, login="edituser")
    created = client.post("/api/v1/analyses", json=analysis_payload(name="Глюкоза", date="2025-01-10"))
    assert created.status_code == 201
    analysis_id = created.json()["id"]

    updated = client.put(
        f"/api/v1/analyses/{analysis_id}",
        json=analysis_payload(name="Холестерин", date="2025-02-20", value=6.2, note="правка"),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["id"] == analysis_id
    assert body["name"] == "Холестерин"
    assert body["date"] == "2025-02-20"
    assert body["note"] == "правка"

    listed = client.get("/api/v1/analyses").json()
    assert len(listed) == 1
    assert listed[0]["name"] == "Холестерин"

    missing = client.put("/api/v1/analyses/99999", json=analysis_payload())
    assert missing.status_code == 404

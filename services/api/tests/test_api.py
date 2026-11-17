import uuid

import pytest

from app.engines.questions.registry import generate

from .conftest import register

pytestmark = pytest.mark.asyncio


def _cid() -> str:
    return uuid.uuid4().hex


async def test_health_and_tracks(client):
    assert (await client.get("/api/health")).json() == {"status": "ok"}
    tracks = (await client.get("/api/v1/tracks")).json()
    assert {t["id"] for t in tracks} == {"trader", "researcher", "developer"}
    t = (await client.get("/api/v1/tracks/researcher")).json()
    assert t["sections"] and t["sections"][0]["items"]
    assert (await client.get("/api/v1/tracks/nope")).status_code == 404


async def test_auth_flow_and_csrf(client):
    email = f"{_cid()}@example.com"
    r = await client.post("/api/v1/auth/register", json={"email": email, "password": "short", "display_name": "x"})
    assert r.status_code == 422
    r = await client.post("/api/v1/auth/register", json={"email": email, "password": "long-enough-pw", "display_name": "x"})
    assert r.status_code == 201
    assert "aps_session" in r.cookies or "aps_session" in client.cookies
    assert (await client.post("/api/v1/auth/register", json={"email": email, "password": "long-enough-pw",
                                                             "display_name": "x"})).status_code == 409
    assert (await client.get("/api/v1/users/me")).status_code == 200
    # cookie-auth POST without CSRF header is rejected
    r = await client.post("/api/v1/attempts/batch", json={})
    assert r.status_code == 403
    r = await client.post("/api/v1/auth/logout", headers={"x-aps-csrf": "1"})
    assert r.status_code == 204
    client.cookies.clear()
    assert (await client.get("/api/v1/users/me")).status_code == 401
    bad = await client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"})
    assert bad.status_code == 401
    ok = await client.post("/api/v1/auth/login", json={"email": email, "password": "long-enough-pw"})
    assert ok.status_code == 200
    client.cookies.clear()


async def test_generate_and_validate(client):
    r = await client.post("/api/v1/questions/generate", json={"question_type": "multiplication", "difficulty": 4,
                                                               "count": 5, "seed": 7})
    body = r.json()
    assert r.status_code == 200 and len(body["questions"]) == 5
    q0 = body["questions"][0]
    v = await client.post("/api/v1/questions/validate", json={"question_type": "multiplication", "difficulty": 4,
                                                               "seed": q0["seed"], "answer": q0["answer_display"]})
    assert v.json()["correct"] is True
    assert (await client.post("/api/v1/questions/generate", json={"question_type": "x", "difficulty": 1})).status_code == 404
    assert (await client.post("/api/v1/questions/generate", json={"question_type": "sequence", "difficulty": 11})).status_code == 422


async def test_practice_batch_idempotent_and_stats(client):
    h = await register(client, f"{_cid()}@example.com")
    sid = _cid()
    attempts = [{"client_event_id": f"{sid}-{i}", "question_id": f"q{i}", "question_type": "multiplication",
                 "question_seed": i, "skill_tags": ["arithmetic"], "submitted_answer": "1", "is_correct": i % 3 != 0,
                 "response_us": 1_000_000 + i * 1000, "attempt_number": i} for i in range(10)]
    payload = {"idempotency_key": f"{sid}-b1", "attempts": attempts[:6],
               "session": {"client_session_id": sid, "trainer_type": "multiplication", "difficulty": 3, "seed": 1}}
    r1 = (await client.post("/api/v1/attempts/batch", json=payload, headers=h)).json()
    assert r1["accepted"] == 6 and r1["total"] == 6
    # exact retry of same batch -> cached response, no duplicates
    r2 = (await client.post("/api/v1/attempts/batch", json=payload, headers=h)).json()
    assert r2 == r1
    # overlapping batch with new key: duplicates by event id are dropped
    payload2 = {**payload, "idempotency_key": f"{sid}-b2", "attempts": attempts[4:], "complete": True}
    r3 = (await client.post("/api/v1/attempts/batch", json=payload2, headers=h)).json()
    assert r3["accepted"] == 4 and r3["duplicates"] == 2 and r3["total"] == 10
    assert r3["correct"] == sum(1 for a in attempts if a["is_correct"])
    sess = (await client.get(f"/api/v1/sessions/{r3['session_id']}", headers=h)).json()
    assert sess["session"]["session_status"] == "completed" and len(sess["attempts"]) == 10
    assert sess["session"]["median_response_us"] == 1_004_500
    skills = (await client.get("/api/v1/progress/skills", headers=h)).json()
    assert skills[0]["skill_tag"] == "arithmetic" and skills[0]["attempts"] == 10
    summary = (await client.get("/api/v1/progress/summary", headers=h)).json()
    assert summary["attempts"] == 10
    hist = (await client.get("/api/v1/analytics/history", headers=h)).json()
    assert hist and hist[0]["attempts"] == 10
    # other user cannot write into this session
    h2 = await register(client, f"{_cid()}@example.com")
    bad = await client.post("/api/v1/attempts/batch", json={**payload, "idempotency_key": f"{sid}-x"}, headers=h2)
    assert bad.status_code == 403


async def _run_assessment(client, h, answers_correct: int, n: int = 6):
    r = await client.post("/api/v1/sessions/assessment", headers=h, json={
        "trainer_type": "multiplication", "difficulty": 3, "question_count": n, "config_key": "test_preset"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert all("answer_display" not in q for q in body["questions"])
    attempts = []
    for i, q in enumerate(body["questions"]):
        truth = generate("multiplication", q["seed"], 3).answer_display
        ans = truth if i < answers_correct else "-1"
        # client lies: claims everything is correct
        attempts.append({"client_event_id": _cid(), "question_id": q["question_id"], "question_type": "multiplication",
                         "question_seed": q["seed"], "submitted_answer": ans, "is_correct": True,
                         "response_us": 2_000_000, "attempt_number": i})
    sd = {"client_session_id": body["client_session_id"], "trainer_type": "multiplication", "mode": "assessment",
          "difficulty": 3, "seed": body["session"]["seed"]}
    # validate endpoint refuses during active assessment
    v = await client.post("/api/v1/questions/validate", headers=h, json={
        "question_type": "multiplication", "difficulty": 3, "seed": body["questions"][0]["seed"], "answer": "1"})
    assert v.status_code == 403
    return (await client.post("/api/v1/attempts/batch", headers=h, json={
        "idempotency_key": _cid(), "session": sd, "attempts": attempts, "complete": True})).json()


async def test_assessment_is_server_graded(client):
    h = await register(client, f"{_cid()}@example.com")
    res = await _run_assessment(client, h, answers_correct=4)
    assert res["server_validated"] is True
    assert res["correct"] == 4 and res["total"] == 6  # client's is_correct claims ignored


async def test_assessment_rejects_foreign_questions(client):
    h = await register(client, f"{_cid()}@example.com")
    r = (await client.post("/api/v1/sessions/assessment", headers=h, json={
        "trainer_type": "multiplication", "difficulty": 3, "question_count": 2})).json()
    sd = {"client_session_id": r["client_session_id"], "trainer_type": "multiplication", "mode": "assessment",
          "difficulty": 3, "seed": 0}
    bad = await client.post("/api/v1/attempts/batch", headers=h, json={"idempotency_key": _cid(), "session": sd, "attempts": [
        {"client_event_id": _cid(), "question_id": "x", "question_type": "multiplication", "question_seed": 12345,
         "submitted_answer": "1", "is_correct": True, "response_us": 1, "attempt_number": 0}]})
    assert bad.status_code == 400


async def test_benchmarks_suppressed_then_reported(client):
    users = [await register(client, f"{_cid()}@example.com") for _ in range(3)]
    first = (await client.get("/api/v1/analytics/benchmarks", headers=users[0],
                              params={"trainer_type": "multiplication", "difficulty": 3, "config_key": "bench_only"})).json()
    assert first["status"] == "insufficient_data"
    for i, h in enumerate(users):
        r = await client.post("/api/v1/sessions/assessment", headers=h, json={
            "trainer_type": "multiplication", "difficulty": 3, "question_count": 3, "config_key": "bench_only"})
        body = r.json()
        attempts = [{"client_event_id": _cid(), "question_id": q["question_id"], "question_type": "multiplication",
                     "question_seed": q["seed"], "submitted_answer": generate("multiplication", q["seed"], 3).answer_display
                     if j <= i else "0", "is_correct": True, "response_us": 10, "attempt_number": j}
                    for j, q in enumerate(body["questions"])]
        await client.post("/api/v1/attempts/batch", headers=h, json={"idempotency_key": _cid(), "complete": True, "attempts": attempts,
                          "session": {"client_session_id": body["client_session_id"], "trainer_type": "multiplication",
                                      "mode": "assessment", "difficulty": 3, "seed": body["session"]["seed"]}})
    b = (await client.get("/api/v1/analytics/benchmarks", headers=users[2],
                          params={"trainer_type": "multiplication", "difficulty": 3, "config_key": "bench_only"})).json()
    assert b["sample_size"] == 3 and b["status"] == "provisional"
    assert b["your_percentile"] == pytest.approx(100 * 2.5 / 3)


async def test_game_session_events_idempotent(client):
    h = await register(client, f"{_cid()}@example.com")
    cid = _cid()
    g = (await client.post("/api/v1/games/market_making/sessions", headers=h,
                           json={"client_session_id": cid, "difficulty": 3, "seed": 9, "initial_state": {"x": 1}})).json()
    again = (await client.post("/api/v1/games/market_making/sessions", headers=h,
                               json={"client_session_id": cid, "difficulty": 3, "seed": 9})).json()
    assert again["id"] == g["id"]
    evs = [{"sequence_number": i, "event_type": "quote", "event_payload": {"bid": 1}, "event_timestamp": i * 10.0} for i in range(5)]
    r = (await client.post(f"/api/v1/games/{g['id']}/events", headers=h, json=evs)).json()
    assert r["accepted"] == 5
    r = (await client.post(f"/api/v1/games/{g['id']}/events", headers=h, json=evs)).json()
    assert r["accepted"] == 0 and r["duplicates"] == 5
    done = (await client.post(f"/api/v1/games/{g['id']}/complete", headers=h,
                              json={"score": 12.5, "realised_pnl": "10.25", "mark_to_market_pnl": "11.000001"})).json()
    assert done["realised_pnl"] == "10.250000" and done["completed_at"]
    log = (await client.get(f"/api/v1/games/{g['id']}/events", headers=h)).json()
    assert [e["seq"] for e in log["events"]] == list(range(5))
    assert (await client.post("/api/v1/games/nope/sessions", headers=h,
                              json={"client_session_id": _cid(), "difficulty": 1, "seed": 1})).status_code == 404


async def test_export_and_delete(client):
    h = await register(client, f"{_cid()}@example.com")
    exp = (await client.get("/api/v1/users/me/export", headers=h)).json()
    assert "password_hash" not in exp["user"]
    assert (await client.delete("/api/v1/users/me", headers=h)).status_code == 204
    assert (await client.get("/api/v1/users/me", headers=h)).status_code == 401


async def test_code_execution_disabled(client):
    st = (await client.get("/api/v1/code/status")).json()
    assert st["server_execution_enabled"] is False
    r = await client.post("/api/v1/code/run", json={"problem_id": "lru", "language": "python", "source": "print(1)"})
    assert r.status_code == 501


async def test_session_probe_anonymous(client):
    client.cookies.clear()
    r = await client.get("/api/v1/auth/session")
    assert r.status_code == 200 and r.json() == {"user": None}

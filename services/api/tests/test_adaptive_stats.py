from datetime import datetime, timezone

from app.engines import adaptive, stats
from app.engines.adaptive import AttemptSummary as A


def test_no_change_before_window():
    lvl, _ = adaptive.next_difficulty(5, [A(True, 100)] * 5)
    assert lvl == 5


def test_level_up_requires_accuracy_and_speed():
    assert adaptive.next_difficulty(5, [A(True, 1000)] * 20)[0] == 6
    assert adaptive.next_difficulty(5, [A(True, 60000)] * 20)[0] == 5
    assert adaptive.next_difficulty(5, [A(False, 1000)] * 10 + [A(True, 1000)] * 10)[0] == 4
    assert adaptive.next_difficulty(1, [A(False, 1000)] * 20)[0] == 1


def test_spaced_repetition_intervals_grow():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    s = adaptive.ReviewState()
    intervals = []
    for _ in range(4):
        s = adaptive.schedule_review(s, 1.0, now)
        intervals.append(s.interval_days)
    assert intervals[0] < intervals[1] < intervals[2] < intervals[3]
    fail = adaptive.schedule_review(s, 0.2, now)
    assert fail.repetitions == 0 and fail.interval_days < 1


def test_stats_match_history():
    flags = [True, True, False, True, True, True, False]
    rts = [1000, 2000, 3000, 1500, 500, 800, 4000]
    s = stats.compute(flags, rts, duration_us=60_000_000)
    assert s.attempts == 7 and s.correct == 5 and s.incorrect == 2
    assert s.best_streak == 3
    assert s.median_us == 1500
    assert s.fastest_correct_us == 500
    assert s.net_score == 3
    assert s.qpm == 7.0
    assert s.p90_us == 4000

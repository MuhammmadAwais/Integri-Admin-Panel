# Personalization Run Summaries API

Admin endpoints that report how many users received notifications after
personalization thresholds were applied. Each time the personalized dispatcher
fires for a country/slot, it writes a summary to the `NewsPersoRunSummary`
Firestore collection. These endpoints surface that data.

---

## 1. Last Run — `GET /api/v1/news/admin/personalization/last-run/{country}`

Returns the most recent personalization run for a country. Answers
**"why did only N users get pushed for country X's last slot?"** without
grepping worker logs.

### Authentication

Admin only (Bearer token, must match `admin_email`).

### Query Parameters

| Parameter | Type  | Required | Description |
|-----------|-------|----------|-------------|
| `country` | path  | yes      | Country key from `NEWS_COUNTRY_CONFIG`, e.g. `Germany`. |
| `slot`    | int   | no       | Restrict to this slot number (1, 2, 3). Omit to return the newest run across all slots. |

### Response — `PersoRunSummary`

```jsonc
{
  "country": "Germany",
  "slot": 1,
  "date": "2026-09-03",
  "run_at": "2026-09-03T08:15:42.123456+00:00",
  "status": "ok",            // see Status Codes below
  "reason": "",
  "candidate_articles": 4,
  "elapsed_ms": 2340,

  // ── User funnel ────────────────────────────────────────────
  "cohort": {
    "enumerated": 1200,           // total users found in Firestore
    "no_vector": 180,             // skipped — no personalization vector
    "stale_vector": 12,           // skipped — vector built on old taxonomy
    "with_vector": 1008,          // users that cleared the vector gate
    "frequency_capped": 50,       // already hit daily push cap
    "eligible_for_match": 958     // passed to the cosine matcher
  },

  // ── Threshold filtering ────────────────────────────────────
  "matching": {
    "scored_users": 958,          // users with ≥1 scorable article
    "users_no_signal": 30,        // zero-norm vector — no topical signal
    "users_below_threshold": 420, // had signal but no article cleared threshold
    "users_matched": 508,         // ≥1 article passed threshold → will receive push
    "pushes_assigned": 508,       // total (user, article) assignments
    "distinct_payload_groups": 12, // unique (article_id, lang) FCM multicasts
    "recent_push_dedup_count": 5, // articles deduped (7-day window)
    "score_p50": 0.0432,          // median of each user's best article score
    "score_p90": 0.0891,          // 90th percentile
    "score_p99": 0.1523,          // 99th percentile
    "score_max": 0.2104,          // highest score in cohort
    "score_mean": 0.0510          // mean of best scores
  },

  // ── FCM delivery ───────────────────────────────────────────
  "dispatch": {
    "sent": 502,
    "failed": 6,
    "batches": 3,
    "per_topic": {                // per-bucket breakdown
      "general": {"sent": 300, "failed": 2, "batches": 2},
      "sports":  {"sent": 202, "failed": 4, "batches": 1}
    },
    "committed_users": 502,       // push succeeded → frequency cap committed
    "failed_users": 6
  },

  // ── Config snapshot ────────────────────────────────────────
  "config": {
    "thresholds": {               // per-tier cosine floors used this run
      "general": 0.05,
      "sports": 0.05,
      "politics": 0.05
    },
    "top_k": 1,
    "max_pool": 50,
    "scoring_method": "embedding", // "embedding" or "keyword"
    "taxonomy_hash": "a3f1c9..."
  },

  // ── Derived rates ──────────────────────────────────────────
  "rates": {
    "push_rate_pct": 53.03,           // users_matched / eligible × 100
    "threshold_drop_rate_pct": 43.84, // users_below_threshold / eligible × 100
    "cold_start_rate_pct": 15.00      // no_vector / enumerated × 100
  }
}
```

### Status Codes

| `status`               | Meaning |
|------------------------|---------|
| `ok`                   | Matching + dispatch completed normally. |
| `empty_pool`           | No candidate articles available. |
| `no_scoreable_articles`| Articles exist but none are scorable. |
| `no_users`             | Firestore user enumeration returned nothing. |
| `no_user_vectors`      | Every user is missing or has a stale vector. |
| `all_frequency_capped` | Every user has hit their daily push cap. |
| `no_matches`           | No user cleared any threshold. |
| `error`                | Unhandled exception; see `reason`. |

### HTTP Errors

| Code | When |
|------|------|
| 403  | Caller is not the admin. |
| 404  | No run ever recorded for this country (personalization is off or pipeline hasn't fired). |
| 422  | Unknown country. |

---

## 2. Recent Runs — `GET /api/v1/news/admin/personalization/runs/{country}`

Returns every personalization run for a country in the trailing N-day window,
newest first. Useful for spotting drift — e.g. `threshold_drop_rate_pct`
climbing day over day means the thresholds are gating too aggressively.

### Authentication

Admin only (Bearer token, must match `admin_email`).

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `country` | path | yes      | —       | Country key, e.g. `Pakistan`. |
| `days`    | int  | no       | 7       | Look back N days (1–90). |

### Response — `PersoRunSummaryList`

```jsonc
{
  "country": "Pakistan",
  "days": 7,
  "count": 14,          // total runs in the window
  "runs": [
    { /* PersoRunSummary — same shape as endpoint 1 */ },
    { /* ... */ }
  ]
}
```

Each entry in `runs` is a full `PersoRunSummary` (see response schema above).
Runs are sorted newest first by `run_at`.

### HTTP Errors

| Code | When |
|------|------|
| 403  | Caller is not the admin. |
| 422  | Unknown country or `days` out of range. |

---

## Reading the Funnel

The user funnel flows top-to-bottom:

```
enumerated                     (all users for this country)
 └─ no_vector                  (cold start — never personalized)
 └─ stale_vector               (vector built on old taxonomy)
 └─ with_vector                (have a current vector)
     └─ frequency_capped       (already pushed today)
     └─ eligible_for_match     (passed to the cosine scorer)
         └─ users_no_signal    (zero-norm vector)
         └─ users_below_threshold  ← THRESHOLD GATE
         └─ users_matched      → received notification
```

### Key metrics to watch

| Metric | What it tells you |
|--------|-------------------|
| `rates.push_rate_pct` | Share of eligible users who actually got a push. Low = thresholds are strict or content doesn't match interests. |
| `rates.threshold_drop_rate_pct` | Share of eligible users dropped by the cosine floor. Rising over days = thresholds too aggressive for the current score distribution. |
| `rates.cold_start_rate_pct` | Share of users with no vector at all. High = many new users haven't been personalized yet. |
| `matching.score_p50` vs `config.thresholds` | If the median best-score sits well below the threshold, most users will be dropped. Lower the threshold to increase push rate. |
| `dispatch.sent` vs `dispatch.failed` | FCM delivery success. High failure usually means stale device tokens. |

### Example: diagnosing low push rate

1. Call `GET /api/v1/news/admin/personalization/last-run/Germany`.
2. Check `rates.threshold_drop_rate_pct` — if it's above 80%, thresholds are too high.
3. Compare `matching.score_p50` against `config.thresholds.general`:
   - If `score_p50 = 0.03` but `threshold = 0.10`, scores are landing far below the floor.
4. Call `GET /api/v1/news/admin/personalization/runs/Germany?days=14` to see if this is a trend or a one-off.
5. Lower the threshold via the thresholds admin endpoint and monitor the next run.

---

## Storage

- **Collection:** `NewsPersoRunSummary`
- **Doc ID:** `{country}__{date}__slot{slot}` (e.g. `Germany__2026-09-03__slot1`)
- **Written by:** `news_perso_run_repository.record_run()` at the end of each `run_personalized_dispatch` call.
- **Best-effort:** A write failure never breaks the notification dispatch.

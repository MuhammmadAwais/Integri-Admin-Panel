import type { PersoRunSummary, PersoRunStatus } from 'api/backendApi';

export interface StatusMeta {
  label: string;
  badgeClass: string;
  color: string;
  summary: string;
}

/**
 * Returns plain-English status explanations for administrators.
 */
export function getStatusMeta(status: PersoRunStatus | string): StatusMeta {
  switch (status) {
    case 'ok':
      return {
        label: 'Delivered Successfully',
        badgeClass: 'badge-active',
        color: '#86efac',
        summary: 'All checks passed. Stories were matched to reader interests and delivered.',
      };
    case 'empty_pool':
      return {
        label: 'No Stories Available',
        badgeClass: 'badge-default',
        color: '#fde047',
        summary: 'There were no new published articles ready to send for this time slot.',
      };
    case 'no_scoreable_articles':
      return {
        label: 'Unscorable Stories',
        badgeClass: 'badge-default',
        color: '#fde047',
        summary: 'New articles exist, but their content could not be evaluated for user interests.',
      };
    case 'no_users':
      return {
        label: 'No Readers in Region',
        badgeClass: 'badge-custom',
        color: '#a5b4fc',
        summary: 'No active app users were found in this country.',
      };
    case 'no_user_vectors':
      return {
        label: 'No Reading Profiles',
        badgeClass: 'badge-default',
        color: '#fde047',
        summary: 'Readers were found, but none have built a reading history profile yet.',
      };
    case 'all_frequency_capped':
      return {
        label: 'Daily Alert Limit Reached',
        badgeClass: 'badge-custom',
        color: '#93c5fd',
        summary: 'Every reader in this country has already received their maximum alerts for today.',
      };
    case 'no_matches':
      return {
        label: 'No Relevant Matches',
        badgeClass: 'badge-default',
        color: '#fde047',
        summary: 'Stories were evaluated, but none matched any reader closely enough to pass the cutoff.',
      };
    case 'error':
      return {
        label: 'System Issue',
        badgeClass: 'badge-error',
        color: '#f87171',
        summary: 'An unexpected issue stopped this delivery run from finishing.',
      };
    default:
      return {
        label: status || 'Unknown Status',
        badgeClass: 'badge-default',
        color: '#d4af37',
        summary: 'Status reported by dispatch engine.',
      };
  }
}

export interface DiagnosisResult {
  title: string;
  summary: string;
  detail: string;
  severity: 'success' | 'warning' | 'info' | 'error';
  action?: {
    label: string;
    path: string;
  };
}

/**
 * Automatically evaluates the run and generates a plain-English diagnosis answering:
 * "Why did only N users receive notifications in this run?"
 */
export function analyzeRunDiagnosis(run: PersoRunSummary): DiagnosisResult {
  // If status is not 'ok', explain the early termination
  if (run.status !== 'ok') {
    const meta = getStatusMeta(run.status);
    if (run.status === 'empty_pool' || run.status === 'no_scoreable_articles') {
      return {
        title: 'Run Halted: No Fresh News Articles',
        summary: 'No notifications could be sent because there were no eligible articles in the content pool.',
        detail: 'Ensure news scrapers and ingestion feeds are active for this country and language.',
        severity: 'warning',
        action: { label: 'View News Articles', path: '/news' },
      };
    }
    if (run.status === 'all_frequency_capped') {
      return {
        title: 'Run Halted: All Readers Already Reached Today',
        summary: `All ${run.cohort?.enumerated?.toLocaleString() ?? 0} readers already received their allowed quota of notifications today.`,
        detail: 'Readers are protected against notification spam. They will become eligible again tomorrow.',
        severity: 'info',
      };
    }
    if (run.status === 'no_user_vectors') {
      return {
        title: 'Run Halted: Audience Needs Profiles',
        summary: 'Every user in this country has missing or outdated interest profiles.',
        detail: 'As users open the app and read news, or when memory profiles are seeded, personalized alerts will resume.',
        severity: 'warning',
        action: { label: 'Go to Memory Backfill', path: '/personalization/memory-backfill' },
      };
    }
    if (run.status === 'no_matches') {
      return {
        title: 'Run Halted: Stories Were Not Relevant Enough',
        summary: 'Candidate stories were evaluated against all eligible readers, but none cleared the relevance cutoff floor.',
        detail: 'Consider lowering the relevance thresholds for this country so more readers qualify.',
        severity: 'warning',
        action: { label: 'Adjust Relevance Cutoffs', path: '/personalization/thresholds' },
      };
    }
    return {
      title: meta.label,
      summary: meta.summary,
      detail: run.reason ? `System reported: "${run.reason}"` : 'Check worker logs if this persists.',
      severity: run.status === 'error' ? 'error' : 'warning',
    };
  }

  // Threshold drop diagnosis (> 65%)
  if (run.rates?.threshold_drop_rate_pct >= 65) {
    const p50 = run.matching?.score_p50 ?? 0;
    const dropPct = run.rates.threshold_drop_rate_pct.toFixed(1);
    const dropCount = run.matching?.users_below_threshold?.toLocaleString() ?? '0';

    return {
      title: `High Relevance Filter (${dropPct}% Dropped)`,
      summary: `${dropCount} interested readers were filtered out because available stories didn't meet their relevance cutoff.`,
      detail: `The typical match score was ${p50.toFixed(3)}. When reader interest scores land below the cutoff floor, stories are held back. Lowering the cutoff in the Thresholds tab will reach more readers.`,
      severity: 'warning',
      action: {
        label: 'Adjust Relevance Cutoffs',
        path: '/personalization/thresholds',
      },
    };
  }

  // Cold start diagnosis (> 35%)
  if (run.rates?.cold_start_rate_pct >= 35) {
    const coldPct = run.rates.cold_start_rate_pct.toFixed(1);
    const coldCount = run.cohort?.no_vector?.toLocaleString() ?? '0';

    return {
      title: `High Proportion of New Readers (${coldPct}%)`,
      summary: `${coldCount} readers were skipped because they have not yet built a personalized reading profile.`,
      detail: 'New readers need reading activity or profile initialization before personalized recommendations can activate.',
      severity: 'info',
      action: {
        label: 'Run Memory Backfill',
        path: '/personalization/memory-backfill',
      },
    };
  }

  // Delivery failures (> 5% of dispatched)
  const totalDispatched = (run.dispatch?.sent ?? 0) + (run.dispatch?.failed ?? 0);
  if (totalDispatched > 0 && (run.dispatch?.failed ?? 0) / totalDispatched > 0.05) {
    const failedCount = run.dispatch.failed.toLocaleString();
    return {
      title: 'Device Delivery Notice',
      summary: `${failedCount} phone deliveries could not be completed by Firebase Cloud Messaging.`,
      detail: 'Common causes include uninstalled apps, disabled system notifications, or expired device tokens.',
      severity: 'warning',
    };
  }

  // Normal healthy run
  const reachPct = run.rates?.push_rate_pct?.toFixed(1) ?? '0';
  const sentCount = (run.dispatch?.sent ?? run.matching?.users_matched ?? 0).toLocaleString();
  const durationSec = ((run.elapsed_ms ?? 0) / 1000).toFixed(2);

  return {
    title: 'Healthy Notification Run',
    summary: `Delivered relevant news to ${sentCount} readers (${reachPct}% of ready audience) in ${durationSec}s.`,
    detail: 'Stories matched reader preferences cleanly and cleared the relevance cutoffs with high device delivery success.',
    severity: 'success',
  };
}

export interface FunnelStep {
  id: string;
  stepNumber: number;
  title: string;
  plainEnglish: string;
  count: number;
  pctOfTotal: number;
  dropCount: number;
  dropReason?: string;
  dropBadge?: string;
}

/**
 * Builds the 5-step audience journey in plain English
 */
export function buildAudienceFunnel(run: PersoRunSummary): FunnelStep[] {
  const enumerated = Math.max(run.cohort?.enumerated ?? 0, 1);

  // Step 1: Total audience
  const totalCount = run.cohort?.enumerated ?? 0;

  // Step 2: Has active profile
  const withVector = run.cohort?.with_vector ?? 0;
  const noVector = run.cohort?.no_vector ?? 0;
  const staleVector = run.cohort?.stale_vector ?? 0;
  const skippedProfile = noVector + staleVector;

  // Step 3: Within daily limit
  const eligible = run.cohort?.eligible_for_match ?? 0;
  const freqCapped = run.cohort?.frequency_capped ?? 0;

  // Step 4: Interest match
  const matched = run.matching?.users_matched ?? 0;
  const belowThreshold = run.matching?.users_below_threshold ?? 0;
  const noSignal = run.matching?.users_no_signal ?? 0;
  const droppedMatching = belowThreshold + noSignal;

  // Step 5: Delivered to device
  const delivered = run.dispatch?.sent ?? matched;
  const deliveryFailed = run.dispatch?.failed ?? 0;

  return [
    {
      id: 'audience',
      stepNumber: 1,
      title: 'Total Readers in Region',
      plainEnglish: 'All registered readers located in this country.',
      count: totalCount,
      pctOfTotal: 100,
      dropCount: 0,
    },
    {
      id: 'profiled',
      stepNumber: 2,
      title: 'Have Reading History',
      plainEnglish: 'Readers with an established topical interest profile.',
      count: withVector,
      pctOfTotal: Math.round((withVector / enumerated) * 100),
      dropCount: skippedProfile,
      dropReason: `${noVector.toLocaleString()} new readers (no profile yet) + ${staleVector.toLocaleString()} need profile update`,
      dropBadge: 'New / Needs Update',
    },
    {
      id: 'limit',
      stepNumber: 3,
      title: 'Ready for Today\'s Alerts',
      plainEnglish: 'Readers who have not yet reached their maximum daily push limit.',
      count: eligible,
      pctOfTotal: Math.round((eligible / enumerated) * 100),
      dropCount: freqCapped,
      dropReason: `${freqCapped.toLocaleString()} readers already received their maximum alerts for today`,
      dropBadge: 'Daily Limit Reached',
    },
    {
      id: 'matched',
      stepNumber: 4,
      title: 'Found Relevant Stories',
      plainEnglish: 'Readers where at least one candidate article passed the relevance cutoff.',
      count: matched,
      pctOfTotal: Math.round((matched / enumerated) * 100),
      dropCount: droppedMatching,
      dropReason: `${belowThreshold.toLocaleString()} fell below relevance cutoff + ${noSignal.toLocaleString()} had zero interest signal`,
      dropBadge: 'Relevance Cutoff',
    },
    {
      id: 'delivered',
      stepNumber: 5,
      title: 'Delivered to Phones',
      plainEnglish: 'Notifications successfully handed off to mobile devices.',
      count: delivered,
      pctOfTotal: Math.round((delivered / enumerated) * 100),
      dropCount: deliveryFailed,
      dropReason: deliveryFailed > 0 ? `${deliveryFailed.toLocaleString()} phone deliveries failed (uninstalled / disabled)` : undefined,
      dropBadge: deliveryFailed > 0 ? 'Delivery Failed' : undefined,
    },
  ];
}

/**
 * Format score into an intuitive match strength tier
 */
export function getScoreInterpretation(score: number): { label: string; color: string } {
  if (score >= 0.15) return { label: 'Very Strong Match', color: '#86efac' };
  if (score >= 0.08) return { label: 'Strong Match', color: '#86efac' };
  if (score >= 0.04) return { label: 'Moderate Match', color: '#D4AF37' };
  if (score >= 0.02) return { label: 'Light Match', color: '#fde047' };
  return { label: 'Faint Match', color: '#f87171' };
}

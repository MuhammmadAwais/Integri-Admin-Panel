import React, { useState, useEffect } from 'react';
import { 
  TierLimitsService, 
  ModelsService, 
  type TierLimitsConfig, 
  type TierName,
  type TierLimitsResponse 
} from 'api/backendApi';
import { 
  SlidersHorizontal, 
  Save, 
  RotateCcw, 
  AlertTriangle, 
  Info, 
  Sparkles,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { useSelector } from 'react-redux';
import './tier-configuration.scss';

// Default baseline structure for safe fallbacks
const DEFAULT_LIMITS: Record<TierName, TierLimitsConfig> = {
  freemium: {
    daily_messages: 40,
    daily_tokens: 35000,
    monthly_tokens: 800000,
    voice_minutes: 40,
    image_generation: 2,
    file_input_token_cap: 7000,
    default_model_on_limit: 'integri'
  },
  premium: {
    daily_messages: 60,
    daily_tokens: 60000,
    monthly_tokens: 1700000,
    voice_minutes: 400,
    image_generation: 30,
    file_input_token_cap: 20000,
    default_model_on_limit: 'integri'
  },
  pro: {
    daily_messages: 70,
    daily_tokens: 80000,
    monthly_tokens: 3000000,
    voice_minutes: 900,
    image_generation: 150,
    file_input_token_cap: 50000,
    default_model_on_limit: 'integri'
  }
};

type FieldErrors = Partial<Record<TierName, Partial<Record<keyof TierLimitsConfig, string>>>>;

export default function TierConfigurationPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);
  const [initialLimits, setInitialLimits] = useState<Record<TierName, TierLimitsConfig>>(DEFAULT_LIMITS);
  const [currentLimits, setCurrentLimits] = useState<Record<TierName, TierLimitsConfig>>(DEFAULT_LIMITS);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<FieldErrors>({});
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Fetch initial tier limits and active models
  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch limits and models in parallel
        const [limitsRes, modelsRes] = await Promise.allSettled([
          TierLimitsService.fetchTierLimits(),
          ModelsService.fetchModels()
        ]);

        if (!active) return;

        if (limitsRes.status === 'fulfilled') {
          const fetchedLimits = limitsRes.value.limits;
          if (fetchedLimits) {
            // Guarantee all required properties exist
            const sanitized: Record<TierName, TierLimitsConfig> = { ...DEFAULT_LIMITS };
            (Object.keys(DEFAULT_LIMITS) as TierName[]).forEach((tier) => {
              if (fetchedLimits[tier]) {
                sanitized[tier] = {
                  daily_messages: fetchedLimits[tier].daily_messages ?? DEFAULT_LIMITS[tier].daily_messages,
                  daily_tokens: fetchedLimits[tier].daily_tokens ?? DEFAULT_LIMITS[tier].daily_tokens,
                  monthly_tokens: fetchedLimits[tier].monthly_tokens ?? DEFAULT_LIMITS[tier].monthly_tokens,
                  voice_minutes: fetchedLimits[tier].voice_minutes ?? DEFAULT_LIMITS[tier].voice_minutes,
                  image_generation: fetchedLimits[tier].image_generation ?? DEFAULT_LIMITS[tier].image_generation,
                  file_input_token_cap: fetchedLimits[tier].file_input_token_cap ?? DEFAULT_LIMITS[tier].file_input_token_cap,
                  default_model_on_limit: fetchedLimits[tier].default_model_on_limit || DEFAULT_LIMITS[tier].default_model_on_limit
                };
              }
            });
            setInitialLimits(sanitized);
            setCurrentLimits(JSON.parse(JSON.stringify(sanitized))); // Deep copy
          }
        } else {
          console.error('❌ Failed to fetch tier limits:', limitsRes.reason);
          setError('Could not load plan settings from the server.');
        }

        if (modelsRes.status === 'fulfilled') {
          setAvailableModels(modelsRes.value || []);
        } else {
          console.warn('⚠️ Failed to fetch active models:', modelsRes.reason);
        }
      } catch (err: any) {
        console.error('❌ Unexpected error fetching configuration:', err);
        setError('Something went wrong while loading settings. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Compute if any changes actually exist compared to the initial fetch
  const computeDelta = (curr: Record<TierName, TierLimitsConfig>, init: Record<TierName, TierLimitsConfig>) => {
    const delta: Partial<Record<TierName, Partial<TierLimitsConfig>>> = {};
    let hasChanges = false;

    (Object.keys(init) as TierName[]).forEach((tier) => {
      const initTier = init[tier];
      const currTier = curr[tier];
      const tierDelta: Partial<TierLimitsConfig> = {};
      let tierChanged = false;

      (Object.keys(initTier) as (keyof TierLimitsConfig)[]).forEach((field) => {
        if (currTier[field] !== initTier[field]) {
          tierDelta[field] = currTier[field] as any;
          tierChanged = true;
          hasChanges = true;
        }
      });

      if (tierChanged) {
        delta[tier] = tierDelta;
      }
    });

    return { delta, hasChanges };
  };

  const { delta, hasChanges } = computeDelta(currentLimits, initialLimits);

  // Validate form fields client-side
  const validateFields = (): boolean => {
    const errors: FieldErrors = {};
    let isValid = true;

    (Object.keys(currentLimits) as TierName[]).forEach((tier) => {
      const config = currentLimits[tier];
      const tierErrors: Partial<Record<keyof TierLimitsConfig, string>> = {};
      let hasTierError = false;

      // Integer fields validations
      const integerFields: (keyof Omit<TierLimitsConfig, 'default_model_on_limit'>)[] = [
        'daily_messages',
        'daily_tokens',
        'monthly_tokens',
        'voice_minutes',
        'image_generation',
        'file_input_token_cap'
      ];

      integerFields.forEach((field) => {
        const val = config[field];
        if (val === undefined || val === null || isNaN(val) || (val as any) === '') {
          tierErrors[field] = 'Please enter a number';
          hasTierError = true;
          isValid = false;
        } else if (val < 0) {
          tierErrors[field] = 'Must be 0 or higher';
          hasTierError = true;
          isValid = false;
        } else if (!Number.isInteger(Number(val))) {
          tierErrors[field] = 'Must be a whole number';
          hasTierError = true;
          isValid = false;
        }
      });

      // String field validation
      if (!config.default_model_on_limit || config.default_model_on_limit.trim() === '') {
        tierErrors.default_model_on_limit = 'Please specify a fallback model';
        hasTierError = true;
        isValid = false;
      }

      if (hasTierError) {
        errors[tier] = tierErrors;
      }
    });

    setValidationErrors(errors);
    return isValid;
  };

  // Handle Input Changes
  const handleInputChange = (
    tier: TierName, 
    field: keyof TierLimitsConfig, 
    value: string | number
  ) => {
    // Clear validation error for this field
    if (validationErrors[tier]?.[field]) {
      const updatedErrors = { ...validationErrors };
      if (updatedErrors[tier]) {
        delete updatedErrors[tier]![field];
        if (Object.keys(updatedErrors[tier]!).length === 0) {
          delete updatedErrors[tier];
        }
      }
      setValidationErrors(updatedErrors);
    }

    setCurrentLimits(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [field]: value
      }
    }));
  };

  // Save changes via partial PUT payload
  const handleSaveChanges = async () => {
    if (!validateFields()) {
      return;
    }

    if (!hasChanges) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      console.log('🚀 [TierLimits] Sending partial payload delta:', delta);
      const res = await TierLimitsService.updateTierLimits(delta);

      // Upon success, sync state
      if (res?.limits) {
        const sanitized: Record<TierName, TierLimitsConfig> = { ...DEFAULT_LIMITS };
        (Object.keys(DEFAULT_LIMITS) as TierName[]).forEach((tier) => {
          if (res.limits[tier]) {
            sanitized[tier] = {
              daily_messages: res.limits[tier].daily_messages ?? currentLimits[tier].daily_messages,
              daily_tokens: res.limits[tier].daily_tokens ?? currentLimits[tier].daily_tokens,
              monthly_tokens: res.limits[tier].monthly_tokens ?? currentLimits[tier].monthly_tokens,
              voice_minutes: res.limits[tier].voice_minutes ?? currentLimits[tier].voice_minutes,
              image_generation: res.limits[tier].image_generation ?? currentLimits[tier].image_generation,
              file_input_token_cap: res.limits[tier].file_input_token_cap ?? currentLimits[tier].file_input_token_cap,
              default_model_on_limit: res.limits[tier].default_model_on_limit || currentLimits[tier].default_model_on_limit
            };
          }
        });
        setInitialLimits(sanitized);
        setCurrentLimits(JSON.parse(JSON.stringify(sanitized)));
      } else {
        setInitialLimits(JSON.parse(JSON.stringify(currentLimits)));
      }
      
      const timeStr = new Date().toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      setLastSaved(timeStr);
    } catch (err: any) {
      console.error('❌ Failed to update tier limits:', err);
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Could not save your changes. Please check your internet connection.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSaving(false);
    }
  };

  // Revert changes back to original loaded limits
  const handleDiscardChanges = () => {
    setCurrentLimits(JSON.parse(JSON.stringify(initialLimits)));
    setValidationErrors({});
    setError(null);
  };

  if (loading) {
    return (
      <div className={`tier-config-container ${!isDark ? 'light-mode' : ''}`}>
        <div className="loading-container">
          <div className="spinner" />
          <p>Loading plan settings and fallback models...</p>
        </div>
      </div>
    );
  }

  const tierMetadata = {
    freemium: {
      title: 'Free Plan',
      desc: 'Base level allocation for general registrants and guest roles. Strict rate limits to protect infrastructure.',
      badgeClass: 'tier-freemium'
    },
    premium: {
      title: 'Premium Plan',
      desc: 'Standard plan for regular users. Offers higher limits for daily tasks and steady use.',
      badgeClass: 'tier-premium'
    },
    pro: {
      title: 'Pro Plan',
      desc: 'Pro plan for heavy users and business teams. Fast access with high usage limits for any workload.',
      badgeClass: 'tier-pro'
    }
  };

  return (
    <div className={`tier-config-container position-relative ${!isDark ? 'light-mode' : ''}`}>
      {/* ── Page Header ── */}
      <div className="header-section">
        <div className="title-group">
          <h1>Tier Limits Configuration</h1>
          <div className="subtitle">
            Set daily messages, token caps, voice minutes, image generation, and fallback models for each tier.
          </div>
        </div>

        <div className="action-group">
          {lastSaved && (
            <span className="last-saved-badge">
              Saved at {lastSaved}
            </span>
          )}

          <button
            onClick={handleDiscardChanges}
            disabled={!hasChanges || saving}
            className="zinc-btn zinc-btn-secondary"
            aria-label="Cancel changes"
          >
            <RotateCcw size={15} />
            Cancel
          </button>

          <button
            onClick={handleSaveChanges}
            disabled={!hasChanges || saving}
            className="zinc-btn zinc-btn-primary"
            aria-label="Save changes"
          >
            {saving ? (
              <>
                <Loader2 size={15} className="spinner-inline" style={{ animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : (
              <>
                <Save size={15} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Local Error Notice ── */}
      {error && (
        <div className="alert-banner">
          <ShieldAlert size={18} className="flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {/* ── 3-Column Tiers Grid ── */}
      <div className="tiers-grid">
        {(Object.keys(DEFAULT_LIMITS) as TierName[]).map((tier) => {
          const metadata = tierMetadata[tier];
          const config = currentLimits[tier];
          const errors = validationErrors[tier] || {};

          return (
            <div key={tier} className="tier-card" data-testid={`tier-card-${tier}`}>
              <div className="tier-badge-container">
                <span className={`tier-badge ${metadata.badgeClass}`}>
                  {tier}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#525256', fontWeight: 600 }}>
                  PLAN ID: {tier.toUpperCase()}
                </span>
              </div>

              <h2 className="tier-title">{metadata.title}</h2>
              <p className="tier-desc">{metadata.desc}</p>

              <div className="fields-divider" />

              {/* 1. Daily Message Cap */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-daily-messages`}>Daily Message Limit</label>
                <div className="input-wrapper">
                  <input
                    id={`${tier}-daily-messages`}
                    type="number"
                    min="0"
                    step="1"
                    value={config.daily_messages === undefined ? '' : config.daily_messages}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      handleInputChange(tier, 'daily_messages', val as any);
                    }}
                    className={errors.daily_messages ? 'input-error' : ''}
                    placeholder="e.g. 40"
                    aria-label={`${metadata.title} daily message limit`}
                    disabled={saving}
                  />
                </div>
                {errors.daily_messages && (
                  <span className="error-text">{errors.daily_messages}</span>
                )}
              </div>

              {/* 2. Daily Tokens Cap */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-daily-tokens`}>Daily Tokens Limit</label>
                <div className="input-wrapper">
                  <input
                    id={`${tier}-daily-tokens`}
                    type="number"
                    min="0"
                    step="1"
                    value={config.daily_tokens === undefined ? '' : config.daily_tokens}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      handleInputChange(tier, 'daily_tokens', val as any);
                    }}
                    className={errors.daily_tokens ? 'input-error' : ''}
                    placeholder="e.g. 35000"
                    aria-label={`${metadata.title} daily tokens limit`}
                    disabled={saving}
                  />
                </div>
                {errors.daily_tokens && (
                  <span className="error-text">{errors.daily_tokens}</span>
                )}
              </div>

              {/* 3. Monthly Tokens Cap */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-monthly-tokens`}>Monthly Tokens Limit (0 = Unlimited)</label>
                <div className="input-wrapper">
                  <input
                    id={`${tier}-monthly-tokens`}
                    type="number"
                    min="0"
                    step="1"
                    value={config.monthly_tokens === undefined ? '' : config.monthly_tokens}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      handleInputChange(tier, 'monthly_tokens', val as any);
                    }}
                    className={errors.monthly_tokens ? 'input-error' : ''}
                    placeholder="e.g. 800000"
                    aria-label={`${metadata.title} monthly tokens limit`}
                    disabled={saving}
                  />
                </div>
                {errors.monthly_tokens && (
                  <span className="error-text">{errors.monthly_tokens}</span>
                )}
              </div>

              {/* 4. Voice Minutes Limit */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-voice-minutes`}>Voice Minutes Limit</label>
                <div className="input-wrapper">
                  <input
                    id={`${tier}-voice-minutes`}
                    type="number"
                    min="0"
                    step="1"
                    value={config.voice_minutes === undefined ? '' : config.voice_minutes}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      handleInputChange(tier, 'voice_minutes', val as any);
                    }}
                    className={errors.voice_minutes ? 'input-error' : ''}
                    placeholder="e.g. 400"
                    aria-label={`${metadata.title} voice minutes limit`}
                    disabled={saving}
                  />
                </div>
                {errors.voice_minutes && (
                  <span className="error-text">{errors.voice_minutes}</span>
                )}
              </div>

              {/* 5. Image Generation Limit */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-image-generation`}>Image Generations</label>
                <div className="input-wrapper">
                  <input
                    id={`${tier}-image-generation`}
                    type="number"
                    min="0"
                    step="1"
                    value={config.image_generation === undefined ? '' : config.image_generation}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      handleInputChange(tier, 'image_generation', val as any);
                    }}
                    className={errors.image_generation ? 'input-error' : ''}
                    placeholder="e.g. 150"
                    aria-label={`${metadata.title} image generation limit`}
                    disabled={saving}
                  />
                </div>
                {errors.image_generation && (
                  <span className="error-text">{errors.image_generation}</span>
                )}
              </div>

              {/* 6. Token Cap per Ingestion */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-token-cap`}>File Input Token Cap</label>
                <div className="input-wrapper">
                  <input
                    id={`${tier}-token-cap`}
                    type="number"
                    min="0"
                    step="1"
                    value={config.file_input_token_cap === undefined ? '' : config.file_input_token_cap}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      handleInputChange(tier, 'file_input_token_cap', val as any);
                    }}
                    className={errors.file_input_token_cap ? 'input-error' : ''}
                    placeholder="e.g. 50000"
                    aria-label={`${metadata.title} file token cap`}
                    disabled={saving}
                  />
                </div>
                {errors.file_input_token_cap && (
                  <span className="error-text">{errors.file_input_token_cap}</span>
                )}
              </div>

              {/* 7. Default Fallback Model */}
              <div className="form-group-custom">
                <label htmlFor={`${tier}-fallback-model`}>Fallback AI Model</label>
                <div className="input-wrapper">
                  {availableModels.length > 0 ? (
                    <>
                      <select
                        id={`${tier}-fallback-model`}
                        value={config.default_model_on_limit}
                        onChange={(e) => handleInputChange(tier, 'default_model_on_limit', e.target.value)}
                        className={errors.default_model_on_limit ? 'input-error' : ''}
                        aria-label={`${metadata.title} fallback model selection`}
                        disabled={saving}
                      >
                        {availableModels.map(model => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                        {/* Always include current value as option if not already in availableModels */}
                        {config.default_model_on_limit && !availableModels.includes(config.default_model_on_limit) && (
                          <option value={config.default_model_on_limit}>
                            {config.default_model_on_limit}
                          </option>
                        )}
                      </select>
                      <span className="select-arrow">▼</span>
                    </>
                  ) : (
                    <input
                      id={`${tier}-fallback-model`}
                      type="text"
                      value={config.default_model_on_limit || ''}
                      onChange={(e) => handleInputChange(tier, 'default_model_on_limit', e.target.value)}
                      className={errors.default_model_on_limit ? 'input-error' : ''}
                      placeholder="e.g. integri"
                      aria-label={`${metadata.title} fallback model entry`}
                      disabled={saving}
                    />
                  )}
                </div>
                {errors.default_model_on_limit && (
                  <span className="error-text">{errors.default_model_on_limit}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Policy Context Card ── */}
      <div className="policy-card">
        <Info size={20} color="#D4AF37" className="flex-shrink-0" style={{ marginTop: '2px' }} />
        <div style={{ fontSize: '0.85rem', color: '#a8956b', lineHeight: '1.5' }}>
          <strong style={{ color: '#D4AF37' }}>Important Note:</strong> Partial updates are allowed—only modified tiers and fields are sent. Changes are persisted to DynamoDB and the Redis cache is refreshed immediately. Daily messages, daily tokens, and monthly tokens are evaluated concurrently for message, voice, image, and file checks.
        </div>
      </div>
    </div>
  );
}

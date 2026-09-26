import React, { useState, useEffect } from 'react';
import { 
  AdConfigService, 
  type AdConfig 
} from 'api/backendApi';
import { 
  Loader2, 
  Check, 
  Info 
} from 'lucide-react';
import { useSelector } from 'react-redux';
import './ad-configuration.scss';

export default function AdConfigurationPage() {
  const isDark = useSelector((state: any) => state.theme?.isDark ?? true);
  const [initialConfig, setInitialConfig] = useState<AdConfig>({
    useInterstitialAds: false,
    freemium: 4,
    premium: 3,
    pro: 5,
    newsSecondAdMinBlocks: 4
  });

  const [currentConfig, setCurrentConfig] = useState<AdConfig>({
    useInterstitialAds: false,
    freemium: 4,
    premium: 3,
    pro: 5,
    newsSecondAdMinBlocks: 4
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await AdConfigService.fetchConfig();
      setInitialConfig(data);
      setCurrentConfig(data);
    } catch (err) {
      console.error('Failed to load ad configuration:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const isDirty = 
    currentConfig.useInterstitialAds !== initialConfig.useInterstitialAds ||
    currentConfig.freemium !== initialConfig.freemium ||
    currentConfig.premium !== initialConfig.premium ||
    currentConfig.pro !== initialConfig.pro ||
    currentConfig.newsSecondAdMinBlocks !== initialConfig.newsSecondAdMinBlocks;

  const handleFormatSelect = (useInterstitial: boolean) => {
    setCurrentConfig(prev => ({
      ...prev,
      useInterstitialAds: useInterstitial
    }));
  };

  const handleFrequencyChange = (field: keyof Omit<AdConfig, 'useInterstitialAds'>, val: string) => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1) {
      setCurrentConfig(prev => ({
        ...prev,
        [field]: num
      }));
    } else if (val === '') {
      setCurrentConfig(prev => ({
        ...prev,
        [field]: 1
      }));
    }
  };

  const handleCancel = () => {
    setCurrentConfig(initialConfig);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await AdConfigService.saveConfig(currentConfig);
      if (res.data) {
        setInitialConfig(res.data);
        setCurrentConfig(res.data);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ad-config-page d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <div className="text-center text-muted">
          <Loader2 className="animate-spin mb-2" size={28} />
          <div>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`ad-config-page ${isDark ? 'dark-theme' : 'light-theme'}`}>
      {/* Page Header */}
      <div className="page-header">
        <h1>Ad Settings</h1>
        <p>Manage how full-screen ads appear and how often users see them across account tiers.</p>
      </div>

      {/* Card 1: Ad Format */}
      <div className="settings-card">
        <h2 className="card-heading">Full-Screen Ad Format</h2>
        <div className="card-subheading">Select whether users opt into ads or see them automatically.</div>

        <div className="format-options">
          {/* Rewarded */}
          <div 
            className={`format-radio-item ${!currentConfig.useInterstitialAds ? 'selected' : ''}`}
            onClick={() => handleFormatSelect(false)}
          >
            <div className="radio-dot" />
            <div className="radio-content">
              <div className="title">Rewarded Ads (Recommended)</div>
              <div className="description">
                Users choose to watch an ad when they want to earn extra chat credits. Ads do not interrupt conversations automatically.
              </div>
            </div>
          </div>

          {/* Interstitial */}
          <div 
            className={`format-radio-item ${currentConfig.useInterstitialAds ? 'selected' : ''}`}
            onClick={() => handleFormatSelect(true)}
          >
            <div className="radio-dot" />
            <div className="radio-content">
              <div className="title">Interstitial Ads</div>
              <div className="description">
                Full-screen ads display automatically between messages. Closing or dismissing the ad grants chat credits to the user.
              </div>
            </div>
          </div>
        </div>

        <div className="notice-text">
          <Info size={14} />
          <span>Note: Changes apply the next time users open or restart the mobile app.</span>
        </div>
      </div>

      {/* Card 2: Ad Frequency */}
      <div className="settings-card">
        <h2 className="card-heading">Display Frequency</h2>
        <div className="card-subheading">Set the message intervals between ads for each account tier.</div>

        <div className="frequency-table">
          {/* Free Tier */}
          <div className="frequency-row">
            <div className="row-label">
              <div className="tier-name">Free Accounts</div>
              <div className="tier-desc">Standard free tier users (ad counter begins after message 8)</div>
            </div>
            <div className="row-input-group">
              <span>Every</span>
              <input 
                type="number" 
                min={1} 
                max={50}
                value={currentConfig.freemium}
                onChange={(e) => handleFrequencyChange('freemium', e.target.value)}
              />
              <span>messages</span>
            </div>
          </div>

          {/* Premium Tier */}
          <div className="frequency-row">
            <div className="row-label">
              <div className="tier-name">Premium Subscribers</div>
              <div className="tier-desc">Users on the monthly Premium plan</div>
            </div>
            <div className="row-input-group">
              <span>Every</span>
              <input 
                type="number" 
                min={1} 
                max={50}
                value={currentConfig.premium}
                onChange={(e) => handleFrequencyChange('premium', e.target.value)}
              />
              <span>messages</span>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="frequency-row">
            <div className="row-label">
              <div className="tier-name">Pro Subscribers</div>
              <div className="tier-desc">Users on the highest Pro plan</div>
            </div>
            <div className="row-input-group">
              <span>Every</span>
              <input 
                type="number" 
                min={1} 
                max={50}
                value={currentConfig.pro}
                onChange={(e) => handleFrequencyChange('pro', e.target.value)}
              />
              <span>messages</span>
            </div>
          </div>

          {/* News Content Blocks */}
          <div className="frequency-row">
            <div className="row-label">
              <div className="tier-name">News Article Inline Ads</div>
              <div className="tier-desc">Minimum paragraphs before showing a second ad inside an article</div>
            </div>
            <div className="row-input-group">
              <span>After</span>
              <input 
                type="number" 
                min={1} 
                max={50}
                value={currentConfig.newsSecondAdMinBlocks}
                onChange={(e) => handleFrequencyChange('newsSecondAdMinBlocks', e.target.value)}
              />
              <span>paragraphs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="actions-bar">
        <button 
          type="button" 
          className="btn-cancel"
          onClick={handleCancel}
          disabled={!isDirty || saving}
        >
          Cancel
        </button>

        <button 
          type="button" 
          className="btn-save"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

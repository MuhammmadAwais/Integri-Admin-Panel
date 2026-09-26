import React, { useState } from 'react';
import { Globe } from 'lucide-react';

/**
 * Map of full country name → ISO 2-letter code.
 * Covers the most common countries used in the Integri pipeline.
 */
const COUNTRY_TO_ISO: Record<string, string> = {
  // A
  Afghanistan: 'af', Albania: 'al', Algeria: 'dz', Angola: 'ao', Argentina: 'ar',
  Armenia: 'am', Australia: 'au', Austria: 'at', Azerbaijan: 'az',
  // B
  Bahrain: 'bh', Bangladesh: 'bd', Belarus: 'by', Belgium: 'be', Bolivia: 'bo',
  'Bosnia and Herzegovina': 'ba', Brazil: 'br', Bulgaria: 'bg',
  // C
  Cambodia: 'kh', Cameroon: 'cm', Canada: 'ca', Chile: 'cl', China: 'cn',
  Colombia: 'co', Croatia: 'hr', Cuba: 'cu', 'Czech Republic': 'cz', Czechia: 'cz',
  // D
  Denmark: 'dk',
  // E
  Ecuador: 'ec', Egypt: 'eg', Ethiopia: 'et',
  // F
  Finland: 'fi', France: 'fr',
  // G
  Germany: 'de', Ghana: 'gh', Greece: 'gr', Guatemala: 'gt',
  // H
  Honduras: 'hn', 'Hong Kong': 'hk', Hungary: 'hu',
  // I
  India: 'in', Indonesia: 'id', Iran: 'ir', Iraq: 'iq', Ireland: 'ie',
  Israel: 'il', Italy: 'it',
  // J
  Japan: 'jp', Jordan: 'jo',
  // K
  Kazakhstan: 'kz', Kenya: 'ke', 'South Korea': 'kr', Kuwait: 'kw', Kyrgyzstan: 'kg',
  // L
  Lebanon: 'lb', Libya: 'ly',
  // M
  Malaysia: 'my', Mexico: 'mx', Morocco: 'ma', Myanmar: 'mm',
  // N
  Nepal: 'np', Netherlands: 'nl', 'New Zealand': 'nz', Nigeria: 'ng', Norway: 'no',
  // O
  Oman: 'om',
  // P
  Pakistan: 'pk', Palestine: 'ps', Panama: 'pa', Peru: 'pe', Philippines: 'ph',
  Poland: 'pl', Portugal: 'pt',
  // Q
  Qatar: 'qa',
  // R
  Romania: 'ro', Russia: 'ru', Rwanda: 'rw',
  // S
  'Saudi Arabia': 'sa', Serbia: 'rs', Singapore: 'sg', Slovakia: 'sk',
  Somalia: 'so', 'South Africa': 'za', Spain: 'es', Sudan: 'sd',
  Sweden: 'se', Switzerland: 'ch', Syria: 'sy',
  // T
  Taiwan: 'tw', Tanzania: 'tz', Thailand: 'th', Tunisia: 'tn', Turkey: 'tr',
  // U
  Uganda: 'ug', Ukraine: 'ua', 'United Arab Emirates': 'ae', UAE: 'ae',
  'United Kingdom': 'gb', UK: 'gb',
  'United States': 'us', USA: 'us',
  Uruguay: 'uy', Uzbekistan: 'uz',
  // V
  Venezuela: 've', Vietnam: 'vn',
  // Y
  Yemen: 'ye',
  // Z
  Zimbabwe: 'zw',
};

interface CountryFlagProps {
  /** Full country name (e.g. "Germany") OR an ISO 2-letter code (e.g. "de") */
  country?: string;
  /** Optional alias for ISO 2-letter code */
  countryCode?: string;
  /** Pixel size for width and height. Default: 24 */
  size?: number;
  /** Extra inline styles */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Renders a country flag image from /countries-flags/<iso>.webp.
 * Accepts either a full country name or an ISO-2 code.
 * Falls back to a Globe icon if the asset is missing or input is undefined.
 */
const CountryFlag: React.FC<CountryFlagProps> = ({ country, countryCode, size = 24, style, className }) => {
  const [error, setError] = useState(false);

  const rawCountry = country || countryCode;

  if (!rawCountry || typeof rawCountry !== 'string') {
    return <Globe size={size} color="#D4AF37" style={{ opacity: 0.7, flexShrink: 0, ...style }} className={className} />;
  }

  // Resolve the ISO code: first check the map, then lowercase as ISO fallback
  const iso = COUNTRY_TO_ISO[rawCountry] ?? rawCountry.trim().toLowerCase();

  if (error || !iso) {
    return <Globe size={size} color="#D4AF37" style={{ opacity: 0.7, flexShrink: 0, ...style }} className={className} />;
  }

  return (
    <img
      src={`/countries-flags/${iso}.webp`}
      alt={rawCountry}
      onError={() => setError(true)}
      style={{
        width: size,
        height: size * 0.75,  // flags are typically 4:3
        objectFit: 'cover',
        borderRadius: 2,
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  );
};

export default CountryFlag;

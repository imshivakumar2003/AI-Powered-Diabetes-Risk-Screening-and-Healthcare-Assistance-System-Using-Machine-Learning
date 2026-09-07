export default function BrandLogo({ variant = "sidebar", subtitle = "RISK SCREENING TOOL", customTitle = null }) {
  return (
    <div className={`brand-header-centered ${variant}`}>
      {/* Polished Medical-Tech Logo Badge */}
      <div className="brand-logo-badge">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Glucose Drop Contour */}
          <path
            d="M12 2.8C12 2.8 5.5 9.2 5.5 14.6C5.5 18.2 8.4 21.2 12 21.2C15.6 21.2 18.5 18.2 18.5 14.6C18.5 9.2 12 2.8 12 2.8Z"
            fill="url(#brandGrad)"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Clinical Pulse Wave */}
          <path
            d="M8.5 14.5H10.2L11.4 11.5L13.2 17.5L14.4 14.5H15.8"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* AI Node Accent Dot */}
          <circle cx="17.5" cy="5.5" r="2.5" fill="#2dd4bf" stroke="#0d9488" strokeWidth="1" />
          <defs>
            <linearGradient id="brandGrad" x1="5.5" y1="2.8" x2="18.5" y2="21.2" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0d9488" />
              <stop offset="1" stopColor="#0f766e" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Centered Typography Stack */}
      <div className="brand-title">
        {customTitle ? (
          customTitle
        ) : (
          <>
            <span className="brand-title-bold">Glucose</span>
            <span className="brand-title-medium">Check</span>
          </>
        )}
      </div>

      {subtitle && <div className="brand-subtitle">{subtitle}</div>}
    </div>
  );
}

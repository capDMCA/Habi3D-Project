import type { CSSProperties } from 'react';
import BackIcon from './BackIcon';
import { color as t, radius } from './tokens';
import type { RoomZone } from '../data/condoLayout';

interface WorkspaceHeaderProps {
  isScrolled: boolean;
  focusedRoom: RoomZone | null;
  onClearFocusedRoom: () => void;
  onBack: () => void;
  onLaunchAR: () => void;
  onOpen3DView: () => void;
  onDone: () => void;
}

export default function WorkspaceHeader({
  isScrolled,
  focusedRoom,
  onClearFocusedRoom,
  onBack,
  onLaunchAR,
  onOpen3DView,
  onDone,
}: WorkspaceHeaderProps) {
  // Height reduction: 56px normal -> ~45px when scrolled (-20%)
  const headerHeight = isScrolled ? 45 : 56;

  const headerStyle: CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 40,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    minHeight: headerHeight,
    height: headerHeight,
    padding: `calc(4px + env(safe-area-inset-top, 0px)) 12px 4px`,
    boxSizing: 'border-box',
    background: isScrolled ? 'rgba(255, 255, 255, 0.85)' : 'transparent',
    backdropFilter: isScrolled ? 'blur(16px)' : 'none',
    WebkitBackdropFilter: isScrolled ? 'blur(16px)' : 'none',
    borderBottom: isScrolled ? `1px solid rgba(226, 232, 240, 0.8)` : '1px solid transparent',
    boxShadow: isScrolled ? '0 4px 20px rgba(15, 23, 42, 0.06)' : 'none',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    flexShrink: 0,
  };

  const titleWrap: CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  };

  const titleRow: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: isScrolled ? 14 : 15,
    whiteSpace: 'nowrap',
    transition: 'font-size 0.3s ease',
  };

  const titleMain: CSSProperties = {
    fontSize: isScrolled ? 15 : 16,
    fontWeight: 800,
    color: t.ink,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'font-size 0.3s ease',
  };

  const backBtnStyle: CSSProperties = {
    cursor: 'pointer',
    minWidth: isScrolled ? 34 : 38,
    height: isScrolled ? 34 : 38,
    width: isScrolled ? 34 : 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: radius.sm,
    border: `1px solid ${isScrolled ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)'}`,
    background: isScrolled ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(8px)',
    transition: 'all 0.3s ease',
    padding: 0,
  };

  const outlineBtnStyle: CSSProperties = {
    height: isScrolled ? 34 : 38,
    padding: isScrolled ? '0 9px' : '0 12px',
    borderRadius: radius.sm,
    border: `1px solid ${isScrolled ? t.line : 'rgba(0,0,0,0.1)'}`,
    background: isScrolled ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(8px)',
    color: t.ink,
    fontWeight: 700,
    fontSize: isScrolled ? 12.5 : 13.5,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s ease',
  };

  const doneBtnStyle: CSSProperties = {
    background: t.ink,
    color: '#ffffff',
    border: 'none',
    height: isScrolled ? 34 : 38,
    padding: isScrolled ? '0 13px' : '0 16px',
    borderRadius: radius.sm,
    fontWeight: 700,
    fontSize: isScrolled ? 13 : 14,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
    transition: 'all 0.3s ease',
  };

  return (
    <header style={headerStyle} role="banner" aria-label="Workspace navigation header">
      <button
        className="wksp-icon-btn"
        style={backBtnStyle}
        onClick={onBack}
        aria-label="Go back to positioning screen"
        title="Back"
      >
        <BackIcon />
      </button>

      <div style={titleWrap}>
        {focusedRoom ? (
          <div style={titleRow}>
            <span
              style={{ cursor: 'pointer', color: t.inkSoft, fontWeight: 700, textDecoration: 'underline' }}
              onClick={onClearFocusedRoom}
              title="Return to full apartment view"
            >
              Mulberry Place
            </span>
            <span style={{ color: t.inkMute, fontWeight: 500 }}>&gt;</span>
            <span style={{ color: t.ink, fontWeight: 850 }}>{focusedRoom.label}</span>
          </div>
        ) : (
          <span style={titleMain}>Mulberry Place</span>
        )}
      </div>

      <button
        className="wksp-outline-btn"
        style={outlineBtnStyle}
        onClick={onLaunchAR}
        title="Place or adjust furniture in AR"
        aria-label="Place in Augmented Reality"
      >
        📷 AR Place
      </button>

      <button
        className="wksp-outline-btn"
        style={outlineBtnStyle}
        onClick={onOpen3DView}
        title="Switch to 3D room preview"
        aria-label="3D View"
      >
        3D View
      </button>

      <button
        className="wksp-solid-btn"
        style={doneBtnStyle}
        onClick={onDone}
        aria-label="Finish and view placement report"
      >
        Done
      </button>
    </header>
  );
}

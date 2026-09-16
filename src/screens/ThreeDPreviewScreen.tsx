import BackIcon from '../components/BackIcon';
import ThreeDLayoutPreview from '../components/ThreeDLayoutPreview';
import { useFurnitureStore } from '../stores/furnitureStore';
import { useSessionStore } from '../stores/sessionStore';

export default function ThreeDPreviewScreen() {
  const navigateTo = useSessionStore((state) => state.navigateTo);
  const items = useFurnitureStore((state) => state.items);

  return (
    <div className="three-d-preview-screen">
      <header className="three-d-preview-header">
        <button
          className="three-d-back-button"
          type="button"
          onClick={() => navigateTo('workspace')}
        >
          <BackIcon size={18} />
          <span>Back to 2D</span>
        </button>
        <div className="three-d-preview-title">
          <strong>Mulberry Place 2BR</strong>
          <span>3D Layout Preview</span>
        </div>
        <span className="three-d-item-count">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </header>
      <main className="three-d-preview-stage" aria-label="Read-only 3D layout preview">
        <ThreeDLayoutPreview items={items} />
      </main>
    </div>
  );
}

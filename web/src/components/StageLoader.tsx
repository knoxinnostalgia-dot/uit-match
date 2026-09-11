import BrandMark from './BrandMark';

export default function StageLoader({
  label = 'Loading…',
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`stage-loader${compact ? ' is-compact' : ''}`} role="status" aria-live="polite">
      <div className="boot-ring" aria-hidden="true">
        <BrandMark size={compact ? 28 : 44} />
      </div>
      <p>{label}</p>
    </div>
  );
}

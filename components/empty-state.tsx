type EmptyStateProps = {
  message: string;
  className?: string;
};

export function EmptyState({ message, className = "" }: EmptyStateProps) {
  return (
    <div className={`epci-empty-state ${className}`}>
      <span className="epci-empty-state-mark" aria-hidden="true">
        ✓
      </span>
      <p>{message}</p>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-lg ${className}`} />;
}

/** Row of stat-card placeholders (dashboard) */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5 flex items-center gap-4">
          <Skeleton className="w-12 h-12 !rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** List of avatar+text rows (student list, check-in feeds) */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card divide-y divide-gray-50 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="w-10 h-10 !rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 max-w-[60%]" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16 !rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Two side-by-side card panels (dashboard widgets, attendance columns) */
export function PanelsSkeleton() {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      {[0, 1].map(i => (
        <div key={i} className="card p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 !rounded-full flex-shrink-0" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

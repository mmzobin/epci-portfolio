export function CommunityIntro() {
  return (
    <section className="grid gap-5 overflow-hidden rounded-xl border border-line bg-court-dark p-5 text-white shadow-premium md:grid-cols-[1.1fr_0.9fr] md:p-7">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-limeball">Exclusive Padel Crew Israel</p>
        <h1 className="mt-3 text-3xl font-black leading-tight md:text-4xl">More padel. Less coordination.</h1>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white/70">
          Find games, join tournaments, and connect with padel players across Israel.
        </p>
      </div>
      <div className="court-lines min-h-32 rounded-xl border border-white/10 shadow-inner" aria-hidden="true" />
    </section>
  );
}

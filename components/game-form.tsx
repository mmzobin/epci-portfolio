"use client";

import { useMemo, useState } from "react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { playerLevels } from "@/lib/levels";
import { useI18n } from "@/lib/i18n";

type ClubOption = {
  id: string;
  name: string;
  city: string;
  address: string;
  hourlyCourtPrice: string;
};

export function GameForm({
  action,
  game,
  clubs
}: {
  action: (formData: FormData) => void | Promise<void>;
  clubs: ClubOption[];
  game?: {
    id: string;
    title: string;
    startsAt: Date;
    city: string;
    club: string;
    clubId: string | null;
    address: string;
    courtNumber: string;
    courtPricePerHour: string;
    maxPlayers: number;
    pricePerPlayer: string;
    minLevel: number;
    maxLevel: number;
  };
}) {
  const { t } = useI18n();
  const datetime = game?.startsAt.toISOString().slice(0, 16);
  const cities = useMemo(() => Array.from(new Set(clubs.map((club) => club.city))).sort(), [clubs]);
  const initialCity = game?.city ?? cities[0] ?? "";
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const cityClubs = clubs.filter((club) => club.city === selectedCity);
  const initialClubId = game?.clubId && cityClubs.some((club) => club.id === game.clubId) ? game.clubId : cityClubs[0]?.id ?? "";
  const [selectedClubId, setSelectedClubId] = useState(initialClubId);
  const [maxPlayers, setMaxPlayers] = useState(game?.maxPlayers ?? 4);
  const [minLevel, setMinLevel] = useState(game?.minLevel ?? 2.5);
  const [maxLevel, setMaxLevel] = useState(game?.maxLevel ?? 4);
  const [startsAtError, setStartsAtError] = useState("");
  const selectedClub = cityClubs.find((club) => club.id === selectedClubId) ?? cityClubs[0];
  const initialCourtPrice = Number(game?.courtPricePerHour ?? selectedClub?.hourlyCourtPrice ?? 0);
  // Editable: defaults to the club's hourly price, but the organizer can override
  // it per game (e.g. Saturday / holiday rates differ).
  const [courtPrice, setCourtPrice] = useState<number>(initialCourtPrice);
  const pricePerPlayer = courtPrice && maxPlayers > 0 ? (courtPrice / maxPlayers).toFixed(2) : game?.pricePerPlayer ?? "0.00";
  const levelRangeValid = minLevel <= maxLevel;
  const minStartsAt = useMemo(() => toDatetimeLocal(new Date()), []);

  function onCityChange(nextCity: string) {
    setSelectedCity(nextCity);
    const nextClub = clubs.find((club) => club.city === nextCity);
    setSelectedClubId(nextClub?.id ?? "");
    setCourtPrice(Number(nextClub?.hourlyCourtPrice ?? 0));
  }

  function onClubChange(clubId: string) {
    setSelectedClubId(clubId);
    setCourtPrice(Number(clubs.find((club) => club.id === clubId)?.hourlyCourtPrice ?? 0));
  }

  return (
    <form
      action={action}
      className="epci-card grid gap-4 sm:grid-cols-2"
      data-testid="game-form"
      noValidate
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        const startsAt = new Date(String(formData.get("startsAt") ?? ""));
        if (!game && startsAt <= new Date()) {
          event.preventDefault();
          setStartsAtError(t("gf.err_past"));
        }
      }}
    >
      {game ? <input type="hidden" name="gameId" value={game.id} /> : null}
      <Field name="title" label={t("gf.title")} defaultValue={game?.title} testId="game-title" wide />
      <Field name="startsAt" label={t("gf.datetime")} type="datetime-local" defaultValue={datetime} min={game ? undefined : minStartsAt} testId="game-startsAt" wide />
      {startsAtError ? <p className="text-sm font-semibold text-red-700 sm:col-span-2">{startsAtError}</p> : null}

      <label className="epci-label">
        {t("gf.city")}
        <select value={selectedCity} onChange={(event) => onCityChange(event.target.value)} className="epci-field" data-testid="game-city" required>
          {cities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>
      </label>

      <label className="epci-label">
        {t("gf.club")}
        <select name="clubId" value={selectedClub?.id ?? ""} onChange={(event) => onClubChange(event.target.value)} className="epci-field" data-testid="game-club" required>
          {cityClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </label>

      <ReadOnlyField label={t("gf.address")} value={selectedClub?.address ?? game?.address ?? ""} testId="game-address" wide />
      <label className="epci-label">
        {t("gf.court_price")} (₪)
        <input
          className="epci-field"
          name="courtPricePerHour"
          type="number"
          min="0"
          step="1"
          value={courtPrice}
          onChange={(event) => setCourtPrice(Number(event.target.value))}
          data-testid="game-court-price"
        />
      </label>
      <Field name="courtNumber" label={t("gf.court_number")} defaultValue={game?.courtNumber ?? "1"} testId="game-courtNumber" />

      <label className="epci-label">
        {t("gf.max_players")}
        <input
          className="epci-field"
          name="maxPlayers"
          type="number"
          min="1"
          step="1"
          value={maxPlayers}
          onChange={(event) => setMaxPlayers(Number(event.target.value))}
          data-testid="game-maxPlayers"
        />
      </label>

      <ReadOnlyField label={t("gf.price_per_player")} value={`₪${pricePerPlayer}`} testId="game-price" />

      <label className="epci-label">
        {t("gf.min_level")}
        <select name="minLevel" value={minLevel} onChange={(event) => setMinLevel(Number(event.target.value))} className="epci-field" data-testid="game-minLevel">
          {playerLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </select>
      </label>
      <label className="epci-label">
        {t("gf.max_level")}
        <select name="maxLevel" value={maxLevel} onChange={(event) => setMaxLevel(Number(event.target.value))} className="epci-field" data-testid="game-maxLevel">
          {playerLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </select>
      </label>
      {!levelRangeValid ? <p className="text-sm font-semibold text-red-700 sm:col-span-2">{t("gf.err_levels")}</p> : null}
      <ConfirmSubmitButton
        className="epci-btn-primary sm:col-span-2"
        confirmMessage={t("gf.save_confirm")}
        disabled={!selectedClub || !levelRangeValid}
        label={t("gf.save")}
        testId="game-save"
      />
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  min,
  testId,
  wide
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
  min?: string;
  testId: string;
  wide?: boolean;
}) {
  return (
    <label className={`epci-label ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <input className="epci-field" name={name} type={type} defaultValue={defaultValue} min={min} required data-testid={testId} />
    </label>
  );
}

function ReadOnlyField({ label, value, testId, wide }: { label: string; value: string; testId: string; wide?: boolean }) {
  return (
    <label className={`epci-label ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      <input className="epci-field bg-ink/[0.035] text-ink/70" value={value} readOnly data-testid={testId} />
    </label>
  );
}

function toDatetimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

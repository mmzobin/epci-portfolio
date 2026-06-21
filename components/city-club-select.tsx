"use client";

import { useMemo, useState } from "react";

type ClubOption = {
  id: string;
  name: string;
  city: string;
};

export function CityClubSelect({
  clubs,
  cityTestId,
  clubTestId
}: {
  clubs: ClubOption[];
  cityTestId: string;
  clubTestId: string;
}) {
  const cities = useMemo(() => Array.from(new Set(clubs.map((club) => club.city))).sort(), [clubs]);
  const [selectedCity, setSelectedCity] = useState("");
  const cityClubs = clubs.filter((club) => club.city === selectedCity);
  const [selectedClub, setSelectedClub] = useState("");

  function onCityChange(nextCity: string) {
    setSelectedCity(nextCity);
    setSelectedClub(clubs.find((club) => club.city === nextCity)?.name ?? "");
  }

  return (
    <>
      <label className="epci-label">
        City
        <select name="city" value={selectedCity} onChange={(event) => onCityChange(event.target.value)} className="epci-field" data-testid={cityTestId}>
          <option value="">Location TBD</option>
          {cities.map((city) => <option key={city} value={city}>{city}</option>)}
        </select>
      </label>
      <label className="epci-label">
        Club
        <select name="club" value={selectedClub} onChange={(event) => setSelectedClub(event.target.value)} className="epci-field" data-testid={clubTestId} disabled={!selectedCity}>
          {!selectedCity ? <option value="">—</option> : null}
          {cityClubs.map((club) => <option key={club.id} value={club.name}>{club.name}</option>)}
        </select>
      </label>
    </>
  );
}

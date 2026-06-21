# Match Action State Matrix

Match cards and match details use `getMatchActionState` from `lib/action-states.ts`.

| Match status | Viewer status | Card UI | Details UI |
| --- | --- | --- | --- |
| Open | Not joined | Join Match, View Details | Join Match |
| Open | Joined | Joined badge, View Details | Joined badge, Leave Match |
| Open | Host | Host badge, View Details, Manage Match | Host badge, Manage Match |
| Full | Not joined | Full badge, View Details | Full badge |
| Full | Joined | Joined badge, View Details | Joined badge, Leave Match |
| Full | Host | Host badge, View Details, Manage Match | Host badge, Manage Match |
| Completed | Any viewer | Completed badge, View Details | Completed badge |
| Cancelled | Any viewer | Cancelled badge, View Details | Cancelled badge |

Rules:

- Match cards never render Leave Match.
- Joined, Full, Completed, Cancelled, and Host states are badges, not disabled action buttons.
- Join Match is available only for open matches when the viewer is logged in, not the host, and not already participating.
- Leave Match is available only on the details page for joined or waitlisted viewers while the match is open or full.
- Manage Match is available to the host while the match is open or full; edit and cancel controls live on the organizer manage page.

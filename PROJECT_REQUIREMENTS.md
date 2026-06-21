# Project Requirements

## Product

- EPCI means Exclusive Padel Crew Israel.
- The site is for padel community management.
- Telegram remains the primary communication channel.
- The site supports player profiles, ratings, game organization, club management, matchmaking, and admin tools.
- UI text should be in English.

## Registration and Profiles

- Registration should collect basic user/contact data.
- Registration should not ask for padel level.
- Player level should be calculated later through the level assessment form.
- Player profiles should store profile details, level, game history, cancellations, no-shows, and other community metrics.

## Level and Matchmaking Rules

- Players can join only games matching their level range.
- Admin can add users to games only if they match the required level range.
- Level range validation should be enforced on the server, not only in the UI.
- Ratings and matchmaking should use the calculated player level as a core input.

## Games

- One game = one court.
- Game creation should require a date/time, city, club, court number, player capacity, price, and level range.
- Court number should be a text field.
- Game creation should use city -> club selection.
- Address and price should be auto-filled from the selected club.

## Clubs

- Club data should be stored centrally.
- Club data should define city, name, address, and hourly court price.
- Game records should reference the selected club or copy the selected club details in a controlled way for historical accuracy.

## Roles and Administration

- Players can register, maintain profiles, complete level assessment, and join eligible games.
- Organizers can create and manage games.
- Admins can manage users, roles, clubs, and community administration tools.
- Admin actions that add or move users in games must respect level range requirements.


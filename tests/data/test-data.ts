export const testPassword = "Password123!";

export const users = {
  admin: {
    email: "admin@padel.test",
    password: testPassword,
    name: "Admin",
    lastName: "Padel"
  },
  michael: {
    email: "mmzobin@gmail.com",
    password: testPassword,
    name: "Michael",
    lastName: "Zobin"
  },
  oleg: {
    email: "oleg@padel.test",
    password: testPassword,
    name: "Oleg",
    lastName: "Petrov"
  },
  daniel: {
    email: "daniel@padel.test",
    password: testPassword,
    name: "Daniel",
    lastName: "Cohen"
  },
  maya: {
    email: "maya@padel.test",
    password: testPassword,
    name: "Maya",
    lastName: "Levi"
  },
  sam: {
    email: "sam@padel.test",
    password: testPassword,
    name: "Sam",
    lastName: "Klein"
  },
  tom: {
    email: "tom@padel.test",
    password: testPassword,
    name: "Tom",
    lastName: "Bauer"
  },
  nina: {
    email: "nina@padel.test",
    password: testPassword,
    name: "Nina",
    lastName: "Ros"
  }
} as const;

export const games = {
  open: "Evening Padel Tel Aviv",
  full: "Full Herzliya Match",
  completed: "Completed Holon Game",
  cancelled: "Cancelled Rishon Le Zion Game",
  pastOpen: "Past Tel Aviv Match",
  pastFull: "Past Full Herzliya Match"
} as const;

export const clubs = {
  telAviv: {
    name: "Tel Aviv Padel Center",
    city: "Tel Aviv",
    address: "12 Herzl St",
    price: "₪55.00"
  },
  herzliya: {
    name: "Herzliya Padel Arena",
    city: "Herzliya"
  },
  rishonLeZion: {
    name: "Rishon Padel Park",
    city: "Rishon Le Zion"
  }
} as const;

export function fullName(user: { name: string; lastName: string }) {
  return `${user.name} ${user.lastName}`;
}

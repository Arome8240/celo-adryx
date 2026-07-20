import type { AirportSummary } from '../types/flight.types';

/**
 * Small local supplement to the live Amadeus location search — NOT a
 * general-purpose airport database. Amadeus's test/sandbox reference data
 * (the only credentials this app currently has — see AMADEUS_ENV in .env)
 * simply has no entry at all for most West/East African airports: searching
 * "ABV", "ACC", "NBO", "LAGOS", etc. against the live API returns nothing or
 * unrelated matches. Real production Amadeus credentials would very likely
 * cover these natively, at which point this list becomes redundant — kept
 * deliberately short (just the gaps that matter to this app's target
 * markets) rather than re-growing into a full curated database.
 */
export const LOCAL_AIRPORTS: AirportSummary[] = [
  {
    iataCode: 'LOS',
    name: 'Murtala Muhammed International Airport',
    city: 'Lagos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'ABV',
    name: 'Nnamdi Azikiwe International Airport',
    city: 'Abuja',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'PHC',
    name: 'Port Harcourt International Airport',
    city: 'Port Harcourt',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'KAN',
    name: 'Mallam Aminu Kano International Airport',
    city: 'Kano',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'ENU',
    name: 'Akanu Ibiam International Airport',
    city: 'Enugu',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'CBQ',
    name: 'Margaret Ekpo International Airport',
    city: 'Calabar',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'KAD',
    name: 'Kaduna Airport',
    city: 'Kaduna',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'ILR',
    name: 'Ilorin International Airport',
    city: 'Ilorin',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'BNI',
    name: 'Benin Airport',
    city: 'Benin City',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'JOS',
    name: 'Yakubu Gowon Airport',
    city: 'Jos',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'MIU',
    name: 'Maiduguri International Airport',
    city: 'Maiduguri',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'SKO',
    name: 'Sadiq Abubakar III International Airport',
    city: 'Sokoto',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'QOW',
    name: 'Sam Mbakwe International Cargo Airport',
    city: 'Owerri',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'YOL',
    name: 'Yola Airport',
    city: 'Yola',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'AKR',
    name: 'Akure Airport',
    city: 'Akure',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'ABB',
    name: 'Asaba International Airport',
    city: 'Asaba',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'QUO',
    name: 'Akwa Ibom International Airport',
    city: 'Uyo',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'GMO',
    name: 'Gombe Lawanti International Airport',
    city: 'Gombe',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'MDI',
    name: 'Makurdi Airport',
    city: 'Makurdi',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'BCU',
    name: 'Bauchi State Airport',
    city: 'Bauchi',
    country: 'Nigeria',
    countryCode: 'NG',
  },
  {
    iataCode: 'NBO',
    name: 'Jomo Kenyatta International Airport',
    city: 'Nairobi',
    country: 'Kenya',
    countryCode: 'KE',
  },
  {
    iataCode: 'EBB',
    name: 'Entebbe International Airport',
    city: 'Entebbe',
    country: 'Uganda',
    countryCode: 'UG',
  },
  {
    iataCode: 'DAR',
    name: 'Julius Nyerere International Airport',
    city: 'Dar es Salaam',
    country: 'Tanzania',
    countryCode: 'TZ',
  },
  {
    iataCode: 'KGL',
    name: 'Kigali International Airport',
    city: 'Kigali',
    country: 'Rwanda',
    countryCode: 'RW',
  },
  {
    iataCode: 'ACC',
    name: 'Kotoka International Airport',
    city: 'Accra',
    country: 'Ghana',
    countryCode: 'GH',
  },
  {
    iataCode: 'DKR',
    name: 'Blaise Diagne International Airport',
    city: 'Dakar',
    country: 'Senegal',
    countryCode: 'SN',
  },
];

const LOCAL_AIRPORTS_BY_CODE = new Map(
  LOCAL_AIRPORTS.map((airport) => [airport.iataCode, airport]),
);

export function findLocalAirportByCode(code: string): AirportSummary | null {
  return LOCAL_AIRPORTS_BY_CODE.get(code) ?? null;
}

export function searchLocalAirports(query: string): AirportSummary[] {
  const upper = query.toUpperCase();
  return LOCAL_AIRPORTS.filter(
    (airport) =>
      airport.iataCode === upper ||
      airport.city.toUpperCase().includes(upper) ||
      airport.name.toUpperCase().includes(upper),
  );
}

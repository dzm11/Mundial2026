// Mapa nazw drużyn z openfootball/worldcup.json/2026 → kody FIFA + ISO 3166-1 alpha-2.
// 48 uczestników Mundialu 2026 (USA/Kanada/Meksyk).
// Jeśli openfootball doda po losowaniu baraży nowe drużyny, dopisać tutaj.

export type WcTeam = { fifa: string; iso: string }

export const WC2026_TEAMS: Record<string, WcTeam> = {
  Algeria: { fifa: "ALG", iso: "DZ" },
  Argentina: { fifa: "ARG", iso: "AR" },
  Australia: { fifa: "AUS", iso: "AU" },
  Austria: { fifa: "AUT", iso: "AT" },
  Belgium: { fifa: "BEL", iso: "BE" },
  "Bosnia & Herzegovina": { fifa: "BIH", iso: "BA" },
  Brazil: { fifa: "BRA", iso: "BR" },
  Canada: { fifa: "CAN", iso: "CA" },
  "Cape Verde": { fifa: "CPV", iso: "CV" },
  Colombia: { fifa: "COL", iso: "CO" },
  Croatia: { fifa: "CRO", iso: "HR" },
  Curaçao: { fifa: "CUW", iso: "CW" },
  "Czech Republic": { fifa: "CZE", iso: "CZ" },
  "DR Congo": { fifa: "COD", iso: "CD" },
  Ecuador: { fifa: "ECU", iso: "EC" },
  Egypt: { fifa: "EGY", iso: "EG" },
  England: { fifa: "ENG", iso: "GB-ENG" },
  France: { fifa: "FRA", iso: "FR" },
  Germany: { fifa: "GER", iso: "DE" },
  Ghana: { fifa: "GHA", iso: "GH" },
  Haiti: { fifa: "HAI", iso: "HT" },
  Iran: { fifa: "IRN", iso: "IR" },
  Iraq: { fifa: "IRQ", iso: "IQ" },
  "Ivory Coast": { fifa: "CIV", iso: "CI" },
  Japan: { fifa: "JPN", iso: "JP" },
  Jordan: { fifa: "JOR", iso: "JO" },
  Mexico: { fifa: "MEX", iso: "MX" },
  Morocco: { fifa: "MAR", iso: "MA" },
  Netherlands: { fifa: "NED", iso: "NL" },
  "New Zealand": { fifa: "NZL", iso: "NZ" },
  Norway: { fifa: "NOR", iso: "NO" },
  Panama: { fifa: "PAN", iso: "PA" },
  Paraguay: { fifa: "PAR", iso: "PY" },
  Portugal: { fifa: "POR", iso: "PT" },
  Qatar: { fifa: "QAT", iso: "QA" },
  "Saudi Arabia": { fifa: "KSA", iso: "SA" },
  Scotland: { fifa: "SCO", iso: "GB-SCT" },
  Senegal: { fifa: "SEN", iso: "SN" },
  "South Africa": { fifa: "RSA", iso: "ZA" },
  "South Korea": { fifa: "KOR", iso: "KR" },
  Spain: { fifa: "ESP", iso: "ES" },
  Sweden: { fifa: "SWE", iso: "SE" },
  Switzerland: { fifa: "SUI", iso: "CH" },
  Tunisia: { fifa: "TUN", iso: "TN" },
  Turkey: { fifa: "TUR", iso: "TR" },
  USA: { fifa: "USA", iso: "US" },
  Uruguay: { fifa: "URU", iso: "UY" },
  Uzbekistan: { fifa: "UZB", iso: "UZ" },
}

export function resolveTeam(name: string): WcTeam | null {
  return WC2026_TEAMS[name] ?? null
}

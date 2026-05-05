// Mapowanie kodów FIFA (3-literowe, używane przez openfootball) → ISO 3166-1 alpha-2.
// Zawiera wszystkie 32 potwierdzone uczestniczki + popularnych kandydatów do baraży.
// W razie braku — fallback do pierwszych 2 liter FIFA code.

const FIFA_TO_ISO: Record<string, string> = {
  // Gospodarze
  CAN: "CA", MEX: "MX", USA: "US",
  // CONMEBOL
  ARG: "AR", BRA: "BR", COL: "CO", ECU: "EC", PAR: "PY", URU: "UY", VEN: "VE",
  CHI: "CL", PER: "PE", BOL: "BO",
  // UEFA
  ENG: "GB", FRA: "FR", GER: "DE", ESP: "ES", ITA: "IT", POR: "PT", NED: "NL",
  BEL: "BE", CRO: "HR", DEN: "DK", SUI: "CH", AUT: "AT", POL: "PL", SRB: "RS",
  TUR: "TR", NOR: "NO", SCO: "GB", WAL: "GB", IRL: "IE", UKR: "UA", CZE: "CZ",
  SVK: "SK", SVN: "SI", ROU: "RO", HUN: "HU", FIN: "FI", SWE: "SE", BUL: "BG",
  GRE: "GR", BIH: "BA", ALB: "AL", MKD: "MK", LVA: "LV", LTU: "LT", EST: "EE",
  // CONCACAF
  CRC: "CR", PAN: "PA", JAM: "JM", HON: "HN", SLV: "SV", GUA: "GT", HAI: "HT",
  TRI: "TT", CUW: "CW",
  // CAF
  MAR: "MA", TUN: "TN", EGY: "EG", ALG: "DZ", SEN: "SN", NGA: "NG", CMR: "CM",
  CIV: "CI", GHA: "GH", RSA: "ZA", MLI: "ML", BFA: "BF", DRC: "CD", ANG: "AO",
  CPV: "CV", ZAM: "ZM", UGA: "UG", KEN: "KE", BEN: "BJ", GAB: "GA", GUI: "GN",
  GAM: "GM", MOZ: "MZ", MTN: "MR", NAM: "NA", TOG: "TG", LBR: "LR", TAN: "TZ",
  // AFC
  KSA: "SA", IRN: "IR", JPN: "JP", KOR: "KR", AUS: "AU", QAT: "QA", UAE: "AE",
  IRQ: "IQ", JOR: "JO", UZB: "UZ", CHN: "CN", PRK: "KP", THA: "TH", VIE: "VN",
  IND: "IN", PAK: "PK", PLE: "PS", LBN: "LB", SYR: "SY", OMA: "OM", BHR: "BH",
  KGZ: "KG", TJK: "TJ", TKM: "TM", IDN: "ID", MAS: "MY", PHI: "PH", SGP: "SG",
  MYA: "MM", HKG: "HK", TPE: "TW",
  // OFC
  NZL: "NZ", FIJ: "FJ", PNG: "PG", SOL: "SB", VAN: "VU", TAH: "PF", NCL: "NC",
}

export function fifaToIso(fifaCode: string): string {
  const upper = fifaCode.toUpperCase()
  return FIFA_TO_ISO[upper] ?? upper.slice(0, 2)
}

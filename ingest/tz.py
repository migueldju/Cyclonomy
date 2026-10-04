"""Zona horaria de cada carrera, para pasar la hora de salida (local) a hora de Madrid."""
from zoneinfo import ZoneInfo

COUNTRY_TZ = {
    "es": "Europe/Madrid", "fr": "Europe/Paris", "it": "Europe/Rome", "be": "Europe/Brussels",
    "nl": "Europe/Amsterdam", "de": "Europe/Berlin", "ch": "Europe/Zurich", "at": "Europe/Vienna",
    "gb": "Europe/London", "ie": "Europe/Dublin", "pt": "Europe/Lisbon", "dk": "Europe/Copenhagen",
    "no": "Europe/Oslo", "se": "Europe/Stockholm", "fi": "Europe/Helsinki", "pl": "Europe/Warsaw",
    "cz": "Europe/Prague", "sk": "Europe/Bratislava", "si": "Europe/Ljubljana", "hr": "Europe/Zagreb",
    "hu": "Europe/Budapest", "lu": "Europe/Luxembourg", "tr": "Europe/Istanbul", "gr": "Europe/Athens",
    "ro": "Europe/Bucharest", "bg": "Europe/Sofia", "rs": "Europe/Belgrade", "ee": "Europe/Tallinn",
    "lv": "Europe/Riga", "lt": "Europe/Vilnius", "ua": "Europe/Kyiv", "ae": "Asia/Dubai", "om": "Asia/Muscat",
    "sa": "Asia/Riyadh", "cn": "Asia/Shanghai", "jp": "Asia/Tokyo", "kz": "Asia/Almaty",
    "au": "Australia/Melbourne", "nz": "Pacific/Auckland", "ca": "America/Toronto", "us": "America/New_York",
    "mx": "America/Mexico_City", "co": "America/Bogota", "ec": "America/Guayaquil",
    "ar": "America/Argentina/Buenos_Aires", "rw": "Africa/Kigali", "za": "Africa/Johannesburg",
    "ma": "Africa/Casablanca", "dz": "Africa/Algiers",
}
# Carreras en países con varias zonas horarias
RACE_TZ = {"tour-down-under": "Australia/Adelaide"}
DEFAULT_TZ = "Europe/Madrid"
MADRID = ZoneInfo("Europe/Madrid")


def race_tz(slug: str, country: str | None) -> ZoneInfo:
    for prefix, tz in RACE_TZ.items():
        if slug.startswith(prefix):
            return ZoneInfo(tz)
    return ZoneInfo(COUNTRY_TZ.get((country or "").lower(), DEFAULT_TZ))

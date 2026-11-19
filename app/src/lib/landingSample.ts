// Datos de muestra para la portada de la web (quien la ve aún no tiene sesión y no puede leer la base de datos).
// Ciclistas, valores, puntos y carreras reales del juego, sacados de la base de datos; se regeneran a mano.
// Los equipos de la clasificación son inventados: las ligas de los jugadores son privadas.
// El ranking es el top 10 de la temporada 2026 con los puntos Cyclonomy, calculados con los resultados reales
// (etapas o clásicas, general, puntos y montaña; sin los puntos de líder diarios ni los de compañeros).
// La ficha del ciclista es la de Pogačar con su valor de mercado a lo largo de 2026, simulado con la regla diaria
// del juego (update_rider_values) a partir de sus resultados reales; la temporada anterior se toma igual a 2026.
export const SAMPLE = {
  "market": [
    {
      "id": 1944,
      "name": "Wout Van Aert",
      "nationality": "be",
      "team": "Team Visma | Lease a Bike",
      "photo": null,
      "value": 3520000,
      "points": 505,
      "trend": 0
    },
    {
      "id": 28,
      "name": "Lenny Martinez",
      "nationality": "fr",
      "team": "Bahrain Victorious",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/Lenny_Martinez_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Lenny_Martinez_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 3350000,
      "points": 995,
      "trend": 0
    },
    {
      "id": 552,
      "name": "Mauro Schmid",
      "nationality": "ch",
      "team": "Pinarello Q36.5 Pro Cycling Team",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/Tour_de_France_2025_-_Mauro_Schmid.jpg/500px-Tour_de_France_2025_-_Mauro_Schmid.jpg",
      "value": 3280000,
      "points": 345,
      "trend": 0
    },
    {
      "id": 124,
      "name": "Felix Gall",
      "nationality": "at",
      "team": "Lidl - Trek",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Felix_Gall_2025.jpg/500px-Felix_Gall_2025.jpg",
      "value": 3280000,
      "points": 245,
      "trend": 0
    },
    {
      "id": 1224,
      "name": "Paul Magnier",
      "nationality": "fr",
      "team": "Soudal Safety Jogger",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/Paul_Magnier.jpg/500px-Paul_Magnier.jpg",
      "value": 3200000,
      "points": 50,
      "trend": 0
    },
    {
      "id": 355,
      "name": "Tobias Halland Johannessen",
      "nationality": "no",
      "team": "Uno-X Mobility",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ea/NM_landevei_Ringerike_2025_senior_menn_-_17_Rasmus_Tiller%2C_9_Tobias_Halland_Johannessen.jpg/500px-NM_landevei_Ringerike_2025_senior_menn_-_17_Rasmus_Tiller%2C_9_Tobias_Halland_Johannessen.jpg",
      "value": 3100000,
      "points": 625,
      "trend": 0
    },
    {
      "id": 388,
      "name": "Christian Scaroni",
      "nationality": "it",
      "team": "XDS Astana Team",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/SCARONI_Christian_-_arriv%C3%A9e_-_Faun_Ard%C3%A8che_Classic_2026.jpg/500px-SCARONI_Christian_-_arriv%C3%A9e_-_Faun_Ard%C3%A8che_Classic_2026.jpg",
      "value": 3090000,
      "points": 130,
      "trend": 0
    },
    {
      "id": 73,
      "name": "Richard Carapaz",
      "nationality": "ec",
      "team": "NSN Cycling Team",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/GIRO5014_carapaz.jpg/500px-GIRO5014_carapaz.jpg",
      "value": 3090000,
      "points": 145,
      "trend": 0
    },
    {
      "id": 242,
      "name": "Florian Lipowitz",
      "nationality": "de",
      "team": "Red Bull - BORA - hansgrohe",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/74/Florian_Lipowitz_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Florian_Lipowitz_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 2719000,
      "points": 385,
      "trend": 0
    }
  ],
  "ranking": [
    {
      "id": 325,
      "name": "Tadej Pogačar",
      "nationality": "si",
      "team": "UAE Team Emirates - XRG",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Tadej_Poga%C4%8Dar_at_2026_Tour_de_France_%28Stage_21%29_%28cropped%29.jpg/500px-Tadej_Poga%C4%8Dar_at_2026_Tour_de_France_%28Stage_21%29_%28cropped%29.jpg",
      "value": 10200000,
      "points": 8815,
      "trend": 0
    },
    {
      "id": 236,
      "name": "Remco Evenepoel",
      "nationality": "be",
      "team": "Red Bull - BORA - hansgrohe",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/REMCO_EVENEPOEL.png/500px-REMCO_EVENEPOEL.png",
      "value": 8290000,
      "points": 6915,
      "trend": 0
    },
    {
      "id": 331,
      "name": "Isaac Del Toro",
      "nationality": "mx",
      "team": "UAE Team Emirates - XRG",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Isaac_del_Toro_maglia_rosa.jpg/500px-Isaac_del_Toro_maglia_rosa.jpg",
      "value": 7040000,
      "points": 5595,
      "trend": 0
    },
    {
      "id": 56,
      "name": "Paul Seixas",
      "nationality": "fr",
      "team": "Decathlon CMA CGM Team",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/24/Paul_Seixas_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Paul_Seixas_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 6470000,
      "points": 4900,
      "trend": 0
    },
    {
      "id": 297,
      "name": "Jonas Vingegaard",
      "nationality": "dk",
      "team": "Team Visma | Lease a Bike",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/Jonas_Vingegaard_PN26_%28cropped%29.jpg/500px-Jonas_Vingegaard_PN26_%28cropped%29.jpg",
      "value": 4670000,
      "points": 4265,
      "trend": 0
    },
    {
      "id": 2,
      "name": "Jasper Philipsen",
      "nationality": "be",
      "team": "Alpecin - Premier Tech",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/93/Jasper_Philipsen_%282026%29.jpg/500px-Jasper_Philipsen_%282026%29.jpg",
      "value": 4282000,
      "points": 3840,
      "trend": 0
    },
    {
      "id": 551,
      "name": "Tom Pidcock",
      "nationality": "gb",
      "team": "Pinarello Q36.5 Pro Cycling Team",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/39/Tom_Pidcock_%282023%29.jpg/500px-Tom_Pidcock_%282023%29.jpg",
      "value": 4140000,
      "points": 3580,
      "trend": 0
    },
    {
      "id": 1,
      "name": "Mathieu Van Der Poel",
      "nationality": "nl",
      "team": "Alpecin - Premier Tech",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Mathieu_Van_Der_Poel_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Mathieu_Van_Der_Poel_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 3690000,
      "points": 3530,
      "trend": 0
    },
    {
      "id": 1944,
      "name": "Wout Van Aert",
      "nationality": "be",
      "team": "Team Visma | Lease a Bike",
      "photo": null,
      "value": 3520000,
      "points": 3375,
      "trend": 0
    },
    {
      "id": 73,
      "name": "Richard Carapaz",
      "nationality": "ec",
      "team": "NSN Cycling Team",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7d/GIRO5014_carapaz.jpg/500px-GIRO5014_carapaz.jpg",
      "value": 3090000,
      "points": 3030,
      "trend": 0
    }
  ],
  "worlds": [
    {
      "position": 1,
      "score": 1000,
      "id": 329,
      "name": "Brandon Mcnulty",
      "nationality": "us",
      "team": "UAE Team Emirates - XRG",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/65/Giro_2023_GIR10008_mc_nulty_%2852941295144%29.jpg/500px-Giro_2023_GIR10008_mc_nulty_%2852941295144%29.jpg",
      "value": 2550000,
      "points": 140,
      "trend": 0
    },
    {
      "position": 2,
      "score": 750,
      "id": 260,
      "name": "Michael Matthews",
      "nationality": "au",
      "team": "Team Jayco AlUla",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Michael_Matthews_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Michael_Matthews_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 1180000,
      "points": 0,
      "trend": 0
    },
    {
      "position": 3,
      "score": 600,
      "id": 1,
      "name": "Mathieu Van Der Poel",
      "nationality": "nl",
      "team": "Alpecin - Premier Tech",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/92/Mathieu_Van_Der_Poel_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Mathieu_Van_Der_Poel_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 3690000,
      "points": 925,
      "trend": 0
    },
    {
      "position": 4,
      "score": 500,
      "id": 133,
      "name": "Quinn Simmons",
      "nationality": "us",
      "team": "Lidl - Trek",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e7/Quinn_Simmons_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg/500px-Quinn_Simmons_on_the_podium_at_the_presentation_ceremony_for_Stage_5_of_the_2026_Tour_de_France.jpg",
      "value": 1810000,
      "points": 0,
      "trend": 0
    },
    {
      "position": 5,
      "score": 425,
      "id": 331,
      "name": "Isaac Del Toro",
      "nationality": "mx",
      "team": "UAE Team Emirates - XRG",
      "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Isaac_del_Toro_maglia_rosa.jpg/500px-Isaac_del_Toro_maglia_rosa.jpg",
      "value": 7040000,
      "points": 1320,
      "trend": 0
    }
  ],
  "rider": {
    "id": 325,
    "name": "Tadej Pogačar",
    "nationality": "si",
    "team": "UAE Team Emirates - XRG",
    "photo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Tadej_Poga%C4%8Dar_at_2026_Tour_de_France_%28Stage_21%29_%28cropped%29.jpg/500px-Tadej_Poga%C4%8Dar_at_2026_Tour_de_France_%28Stage_21%29_%28cropped%29.jpg",
    "value": 11574000,
    "points": 8815,
    "trend": 0,
    "values": [
      {
        "day": "2026-01-01",
        "value": 10200000
      },
      {
        "day": "2026-01-02",
        "value": 10197000
      },
      {
        "day": "2026-01-03",
        "value": 10192000
      },
      {
        "day": "2026-01-04",
        "value": 10184000
      },
      {
        "day": "2026-01-05",
        "value": 10174000
      },
      {
        "day": "2026-01-06",
        "value": 10162000
      },
      {
        "day": "2026-01-07",
        "value": 10149000
      },
      {
        "day": "2026-01-08",
        "value": 10134000
      },
      {
        "day": "2026-01-09",
        "value": 10118000
      },
      {
        "day": "2026-01-10",
        "value": 10100000
      },
      {
        "day": "2026-01-11",
        "value": 10081000
      },
      {
        "day": "2026-01-12",
        "value": 10062000
      },
      {
        "day": "2026-01-13",
        "value": 10042000
      },
      {
        "day": "2026-01-14",
        "value": 10021000
      },
      {
        "day": "2026-01-15",
        "value": 9999000
      },
      {
        "day": "2026-01-16",
        "value": 9976000
      },
      {
        "day": "2026-01-17",
        "value": 9953000
      },
      {
        "day": "2026-01-18",
        "value": 9929000
      },
      {
        "day": "2026-01-19",
        "value": 9905000
      },
      {
        "day": "2026-01-20",
        "value": 9880000
      },
      {
        "day": "2026-01-21",
        "value": 9855000
      },
      {
        "day": "2026-01-22",
        "value": 9830000
      },
      {
        "day": "2026-01-23",
        "value": 9804000
      },
      {
        "day": "2026-01-24",
        "value": 9778000
      },
      {
        "day": "2026-01-25",
        "value": 9752000
      },
      {
        "day": "2026-01-26",
        "value": 9725000
      },
      {
        "day": "2026-01-27",
        "value": 9698000
      },
      {
        "day": "2026-01-28",
        "value": 9671000
      },
      {
        "day": "2026-01-29",
        "value": 9644000
      },
      {
        "day": "2026-01-30",
        "value": 9617000
      },
      {
        "day": "2026-01-31",
        "value": 9590000
      },
      {
        "day": "2026-02-01",
        "value": 9562000
      },
      {
        "day": "2026-02-02",
        "value": 9534000
      },
      {
        "day": "2026-02-03",
        "value": 9506000
      },
      {
        "day": "2026-02-04",
        "value": 9478000
      },
      {
        "day": "2026-02-05",
        "value": 9450000
      },
      {
        "day": "2026-02-06",
        "value": 9422000
      },
      {
        "day": "2026-02-07",
        "value": 9394000
      },
      {
        "day": "2026-02-08",
        "value": 9366000
      },
      {
        "day": "2026-02-09",
        "value": 9338000
      },
      {
        "day": "2026-02-10",
        "value": 9310000
      },
      {
        "day": "2026-02-11",
        "value": 9282000
      },
      {
        "day": "2026-02-12",
        "value": 9254000
      },
      {
        "day": "2026-02-13",
        "value": 9226000
      },
      {
        "day": "2026-02-14",
        "value": 9198000
      },
      {
        "day": "2026-02-15",
        "value": 9170000
      },
      {
        "day": "2026-02-16",
        "value": 9142000
      },
      {
        "day": "2026-02-17",
        "value": 9114000
      },
      {
        "day": "2026-02-18",
        "value": 9086000
      },
      {
        "day": "2026-02-19",
        "value": 9058000
      },
      {
        "day": "2026-02-20",
        "value": 9030000
      },
      {
        "day": "2026-02-21",
        "value": 9002000
      },
      {
        "day": "2026-02-22",
        "value": 8974000
      },
      {
        "day": "2026-02-23",
        "value": 8946000
      },
      {
        "day": "2026-02-24",
        "value": 8917000
      },
      {
        "day": "2026-02-25",
        "value": 8888000
      },
      {
        "day": "2026-02-26",
        "value": 8860000
      },
      {
        "day": "2026-02-27",
        "value": 8832000
      },
      {
        "day": "2026-02-28",
        "value": 8803000
      },
      {
        "day": "2026-03-01",
        "value": 8774000
      },
      {
        "day": "2026-03-02",
        "value": 8746000
      },
      {
        "day": "2026-03-03",
        "value": 8718000
      },
      {
        "day": "2026-03-04",
        "value": 8689000
      },
      {
        "day": "2026-03-05",
        "value": 8660000
      },
      {
        "day": "2026-03-06",
        "value": 8632000
      },
      {
        "day": "2026-03-07",
        "value": 8662000
      },
      {
        "day": "2026-03-08",
        "value": 8687000
      },
      {
        "day": "2026-03-09",
        "value": 8706000
      },
      {
        "day": "2026-03-10",
        "value": 8720000
      },
      {
        "day": "2026-03-11",
        "value": 8730000
      },
      {
        "day": "2026-03-12",
        "value": 8736000
      },
      {
        "day": "2026-03-13",
        "value": 8739000
      },
      {
        "day": "2026-03-14",
        "value": 8739000
      },
      {
        "day": "2026-03-15",
        "value": 8736000
      },
      {
        "day": "2026-03-16",
        "value": 8730000
      },
      {
        "day": "2026-03-17",
        "value": 8722000
      },
      {
        "day": "2026-03-18",
        "value": 8712000
      },
      {
        "day": "2026-03-19",
        "value": 8700000
      },
      {
        "day": "2026-03-20",
        "value": 8687000
      },
      {
        "day": "2026-03-21",
        "value": 8760000
      },
      {
        "day": "2026-03-22",
        "value": 8823000
      },
      {
        "day": "2026-03-23",
        "value": 8877000
      },
      {
        "day": "2026-03-24",
        "value": 8923000
      },
      {
        "day": "2026-03-25",
        "value": 8962000
      },
      {
        "day": "2026-03-26",
        "value": 8994000
      },
      {
        "day": "2026-03-27",
        "value": 9020000
      },
      {
        "day": "2026-03-28",
        "value": 9040000
      },
      {
        "day": "2026-03-29",
        "value": 9055000
      },
      {
        "day": "2026-03-30",
        "value": 9066000
      },
      {
        "day": "2026-03-31",
        "value": 9073000
      },
      {
        "day": "2026-04-01",
        "value": 9077000
      },
      {
        "day": "2026-04-02",
        "value": 9077000
      },
      {
        "day": "2026-04-03",
        "value": 9074000
      },
      {
        "day": "2026-04-04",
        "value": 9069000
      },
      {
        "day": "2026-04-05",
        "value": 9150000
      },
      {
        "day": "2026-04-06",
        "value": 9220000
      },
      {
        "day": "2026-04-07",
        "value": 9280000
      },
      {
        "day": "2026-04-08",
        "value": 9332000
      },
      {
        "day": "2026-04-09",
        "value": 9375000
      },
      {
        "day": "2026-04-10",
        "value": 9411000
      },
      {
        "day": "2026-04-11",
        "value": 9441000
      },
      {
        "day": "2026-04-12",
        "value": 9524000
      },
      {
        "day": "2026-04-13",
        "value": 9596000
      },
      {
        "day": "2026-04-14",
        "value": 9658000
      },
      {
        "day": "2026-04-15",
        "value": 9711000
      },
      {
        "day": "2026-04-16",
        "value": 9756000
      },
      {
        "day": "2026-04-17",
        "value": 9793000
      },
      {
        "day": "2026-04-18",
        "value": 9824000
      },
      {
        "day": "2026-04-19",
        "value": 9849000
      },
      {
        "day": "2026-04-20",
        "value": 9868000
      },
      {
        "day": "2026-04-21",
        "value": 9883000
      },
      {
        "day": "2026-04-22",
        "value": 9893000
      },
      {
        "day": "2026-04-23",
        "value": 9900000
      },
      {
        "day": "2026-04-24",
        "value": 9903000
      },
      {
        "day": "2026-04-25",
        "value": 9903000
      },
      {
        "day": "2026-04-26",
        "value": 9989000
      },
      {
        "day": "2026-04-27",
        "value": 10063000
      },
      {
        "day": "2026-04-28",
        "value": 10130000
      },
      {
        "day": "2026-04-29",
        "value": 10196000
      },
      {
        "day": "2026-04-30",
        "value": 10262000
      },
      {
        "day": "2026-05-01",
        "value": 10323000
      },
      {
        "day": "2026-05-02",
        "value": 10384000
      },
      {
        "day": "2026-05-03",
        "value": 10494000
      },
      {
        "day": "2026-05-04",
        "value": 10591000
      },
      {
        "day": "2026-05-05",
        "value": 10675000
      },
      {
        "day": "2026-05-06",
        "value": 10748000
      },
      {
        "day": "2026-05-07",
        "value": 10811000
      },
      {
        "day": "2026-05-08",
        "value": 10864000
      },
      {
        "day": "2026-05-09",
        "value": 10909000
      },
      {
        "day": "2026-05-10",
        "value": 10947000
      },
      {
        "day": "2026-05-11",
        "value": 10978000
      },
      {
        "day": "2026-05-12",
        "value": 11003000
      },
      {
        "day": "2026-05-13",
        "value": 11023000
      },
      {
        "day": "2026-05-14",
        "value": 11038000
      },
      {
        "day": "2026-05-15",
        "value": 11049000
      },
      {
        "day": "2026-05-16",
        "value": 11056000
      },
      {
        "day": "2026-05-17",
        "value": 11059000
      },
      {
        "day": "2026-05-18",
        "value": 11059000
      },
      {
        "day": "2026-05-19",
        "value": 11056000
      },
      {
        "day": "2026-05-20",
        "value": 11051000
      },
      {
        "day": "2026-05-21",
        "value": 11043000
      },
      {
        "day": "2026-05-22",
        "value": 11033000
      },
      {
        "day": "2026-05-23",
        "value": 11021000
      },
      {
        "day": "2026-05-24",
        "value": 11008000
      },
      {
        "day": "2026-05-25",
        "value": 10993000
      },
      {
        "day": "2026-05-26",
        "value": 10977000
      },
      {
        "day": "2026-05-27",
        "value": 10960000
      },
      {
        "day": "2026-05-28",
        "value": 10941000
      },
      {
        "day": "2026-05-29",
        "value": 10921000
      },
      {
        "day": "2026-05-30",
        "value": 10901000
      },
      {
        "day": "2026-05-31",
        "value": 10880000
      },
      {
        "day": "2026-06-01",
        "value": 10858000
      },
      {
        "day": "2026-06-02",
        "value": 10835000
      },
      {
        "day": "2026-06-03",
        "value": 10812000
      },
      {
        "day": "2026-06-04",
        "value": 10788000
      },
      {
        "day": "2026-06-05",
        "value": 10764000
      },
      {
        "day": "2026-06-06",
        "value": 10739000
      },
      {
        "day": "2026-06-07",
        "value": 10714000
      },
      {
        "day": "2026-06-08",
        "value": 10688000
      },
      {
        "day": "2026-06-09",
        "value": 10662000
      },
      {
        "day": "2026-06-10",
        "value": 10636000
      },
      {
        "day": "2026-06-11",
        "value": 10610000
      },
      {
        "day": "2026-06-12",
        "value": 10584000
      },
      {
        "day": "2026-06-13",
        "value": 10557000
      },
      {
        "day": "2026-06-14",
        "value": 10530000
      },
      {
        "day": "2026-06-15",
        "value": 10503000
      },
      {
        "day": "2026-06-16",
        "value": 10476000
      },
      {
        "day": "2026-06-17",
        "value": 10460000
      },
      {
        "day": "2026-06-18",
        "value": 10445000
      },
      {
        "day": "2026-06-19",
        "value": 10429000
      },
      {
        "day": "2026-06-20",
        "value": 10423000
      },
      {
        "day": "2026-06-21",
        "value": 10493000
      },
      {
        "day": "2026-06-22",
        "value": 10553000
      },
      {
        "day": "2026-06-23",
        "value": 10604000
      },
      {
        "day": "2026-06-24",
        "value": 10647000
      },
      {
        "day": "2026-06-25",
        "value": 10683000
      },
      {
        "day": "2026-06-26",
        "value": 10713000
      },
      {
        "day": "2026-06-27",
        "value": 10737000
      },
      {
        "day": "2026-06-28",
        "value": 10756000
      },
      {
        "day": "2026-06-29",
        "value": 10770000
      },
      {
        "day": "2026-06-30",
        "value": 10780000
      },
      {
        "day": "2026-07-01",
        "value": 10786000
      },
      {
        "day": "2026-07-02",
        "value": 10788000
      },
      {
        "day": "2026-07-03",
        "value": 10787000
      },
      {
        "day": "2026-07-04",
        "value": 10795000
      },
      {
        "day": "2026-07-05",
        "value": 10817000
      },
      {
        "day": "2026-07-06",
        "value": 10864000
      },
      {
        "day": "2026-07-07",
        "value": 10903000
      },
      {
        "day": "2026-07-08",
        "value": 10936000
      },
      {
        "day": "2026-07-09",
        "value": 10992000
      },
      {
        "day": "2026-07-10",
        "value": 11040000
      },
      {
        "day": "2026-07-11",
        "value": 11080000
      },
      {
        "day": "2026-07-12",
        "value": 11113000
      },
      {
        "day": "2026-07-13",
        "value": 11140000
      },
      {
        "day": "2026-07-14",
        "value": 11191000
      },
      {
        "day": "2026-07-15",
        "value": 11234000
      },
      {
        "day": "2026-07-16",
        "value": 11270000
      },
      {
        "day": "2026-07-17",
        "value": 11300000
      },
      {
        "day": "2026-07-18",
        "value": 11353000
      },
      {
        "day": "2026-07-19",
        "value": 11416000
      },
      {
        "day": "2026-07-20",
        "value": 11470000
      },
      {
        "day": "2026-07-21",
        "value": 11533000
      },
      {
        "day": "2026-07-22",
        "value": 11587000
      },
      {
        "day": "2026-07-23",
        "value": 11633000
      },
      {
        "day": "2026-07-24",
        "value": 11701000
      },
      {
        "day": "2026-07-25",
        "value": 11769000
      },
      {
        "day": "2026-07-26",
        "value": 12006000
      },
      {
        "day": "2026-07-27",
        "value": 12216000
      },
      {
        "day": "2026-07-28",
        "value": 12402000
      },
      {
        "day": "2026-07-29",
        "value": 12567000
      },
      {
        "day": "2026-07-30",
        "value": 12712000
      },
      {
        "day": "2026-07-31",
        "value": 12840000
      },
      {
        "day": "2026-08-01",
        "value": 12952000
      },
      {
        "day": "2026-08-02",
        "value": 13050000
      },
      {
        "day": "2026-08-03",
        "value": 13136000
      },
      {
        "day": "2026-08-04",
        "value": 13210000
      },
      {
        "day": "2026-08-05",
        "value": 13274000
      },
      {
        "day": "2026-08-06",
        "value": 13328000
      },
      {
        "day": "2026-08-07",
        "value": 13374000
      },
      {
        "day": "2026-08-08",
        "value": 13413000
      },
      {
        "day": "2026-08-09",
        "value": 13445000
      },
      {
        "day": "2026-08-10",
        "value": 13471000
      },
      {
        "day": "2026-08-11",
        "value": 13491000
      },
      {
        "day": "2026-08-12",
        "value": 13507000
      },
      {
        "day": "2026-08-13",
        "value": 13518000
      },
      {
        "day": "2026-08-14",
        "value": 13525000
      },
      {
        "day": "2026-08-15",
        "value": 13528000
      },
      {
        "day": "2026-08-16",
        "value": 13528000
      },
      {
        "day": "2026-08-17",
        "value": 13526000
      },
      {
        "day": "2026-08-18",
        "value": 13521000
      },
      {
        "day": "2026-08-19",
        "value": 13514000
      },
      {
        "day": "2026-08-20",
        "value": 13504000
      },
      {
        "day": "2026-08-21",
        "value": 13492000
      },
      {
        "day": "2026-08-22",
        "value": 13497000
      },
      {
        "day": "2026-08-23",
        "value": 13507000
      },
      {
        "day": "2026-08-24",
        "value": 13513000
      },
      {
        "day": "2026-08-25",
        "value": 13534000
      },
      {
        "day": "2026-08-26",
        "value": 13550000
      },
      {
        "day": "2026-08-27",
        "value": 13579000
      },
      {
        "day": "2026-08-28",
        "value": 13602000
      },
      {
        "day": "2026-08-29",
        "value": 13620000
      },
      {
        "day": "2026-08-30",
        "value": 13633000
      },
      {
        "day": "2026-08-31",
        "value": 13642000
      },
      {
        "day": "2026-09-01",
        "value": 13648000
      },
      {
        "day": "2026-09-02",
        "value": 13650000
      },
      {
        "day": "2026-09-03",
        "value": 13649000
      },
      {
        "day": "2026-09-04",
        "value": 13645000
      },
      {
        "day": "2026-09-05",
        "value": 13639000
      },
      {
        "day": "2026-09-06",
        "value": 13630000
      },
      {
        "day": "2026-09-07",
        "value": 13619000
      },
      {
        "day": "2026-09-08",
        "value": 13607000
      },
      {
        "day": "2026-09-09",
        "value": 13593000
      },
      {
        "day": "2026-09-10",
        "value": 13578000
      },
      {
        "day": "2026-09-11",
        "value": 13561000
      },
      {
        "day": "2026-09-12",
        "value": 13543000
      },
      {
        "day": "2026-09-13",
        "value": 13524000
      },
      {
        "day": "2026-09-14",
        "value": 13504000
      },
      {
        "day": "2026-09-15",
        "value": 13483000
      },
      {
        "day": "2026-09-16",
        "value": 13461000
      },
      {
        "day": "2026-09-17",
        "value": 13439000
      },
      {
        "day": "2026-09-18",
        "value": 13416000
      },
      {
        "day": "2026-09-19",
        "value": 13392000
      },
      {
        "day": "2026-09-20",
        "value": 13368000
      },
      {
        "day": "2026-09-21",
        "value": 13318000
      },
      {
        "day": "2026-09-22",
        "value": 13270000
      },
      {
        "day": "2026-09-23",
        "value": 13224000
      },
      {
        "day": "2026-09-24",
        "value": 13180000
      },
      {
        "day": "2026-09-25",
        "value": 13137000
      },
      {
        "day": "2026-09-26",
        "value": 13096000
      },
      {
        "day": "2026-09-27",
        "value": 13056000
      },
      {
        "day": "2026-09-28",
        "value": 13017000
      },
      {
        "day": "2026-09-29",
        "value": 12979000
      },
      {
        "day": "2026-09-30",
        "value": 12942000
      },
      {
        "day": "2026-10-01",
        "value": 12906000
      },
      {
        "day": "2026-10-02",
        "value": 12871000
      },
      {
        "day": "2026-10-03",
        "value": 12837000
      },
      {
        "day": "2026-10-04",
        "value": 12803000
      },
      {
        "day": "2026-10-05",
        "value": 12770000
      },
      {
        "day": "2026-10-06",
        "value": 12737000
      },
      {
        "day": "2026-10-07",
        "value": 12705000
      },
      {
        "day": "2026-10-08",
        "value": 12673000
      },
      {
        "day": "2026-10-09",
        "value": 12642000
      },
      {
        "day": "2026-10-10",
        "value": 12611000
      },
      {
        "day": "2026-10-11",
        "value": 12580000
      },
      {
        "day": "2026-10-12",
        "value": 12549000
      },
      {
        "day": "2026-10-13",
        "value": 12519000
      },
      {
        "day": "2026-10-14",
        "value": 12489000
      },
      {
        "day": "2026-10-15",
        "value": 12459000
      },
      {
        "day": "2026-10-16",
        "value": 12429000
      },
      {
        "day": "2026-10-17",
        "value": 12399000
      },
      {
        "day": "2026-10-18",
        "value": 12370000
      },
      {
        "day": "2026-10-19",
        "value": 12341000
      },
      {
        "day": "2026-10-20",
        "value": 12312000
      },
      {
        "day": "2026-10-21",
        "value": 12283000
      },
      {
        "day": "2026-10-22",
        "value": 12254000
      },
      {
        "day": "2026-10-23",
        "value": 12225000
      },
      {
        "day": "2026-10-24",
        "value": 12196000
      },
      {
        "day": "2026-10-25",
        "value": 12167000
      },
      {
        "day": "2026-10-26",
        "value": 12138000
      },
      {
        "day": "2026-10-27",
        "value": 12109000
      },
      {
        "day": "2026-10-28",
        "value": 12080000
      },
      {
        "day": "2026-10-29",
        "value": 12052000
      },
      {
        "day": "2026-10-30",
        "value": 12024000
      },
      {
        "day": "2026-10-31",
        "value": 11996000
      },
      {
        "day": "2026-11-01",
        "value": 11968000
      },
      {
        "day": "2026-11-02",
        "value": 11940000
      },
      {
        "day": "2026-11-03",
        "value": 11912000
      },
      {
        "day": "2026-11-04",
        "value": 11884000
      },
      {
        "day": "2026-11-05",
        "value": 11856000
      },
      {
        "day": "2026-11-06",
        "value": 11828000
      },
      {
        "day": "2026-11-07",
        "value": 11800000
      },
      {
        "day": "2026-11-08",
        "value": 11772000
      },
      {
        "day": "2026-11-09",
        "value": 11744000
      },
      {
        "day": "2026-11-10",
        "value": 11715000
      },
      {
        "day": "2026-11-11",
        "value": 11686000
      },
      {
        "day": "2026-11-12",
        "value": 11658000
      },
      {
        "day": "2026-11-13",
        "value": 11630000
      },
      {
        "day": "2026-11-14",
        "value": 11602000
      },
      {
        "day": "2026-11-15",
        "value": 11574000
      }
    ]
  },
  "calendar": [
    {
      "race_id": 651,
      "name": "La Vuelta Ciclista a España",
      "category": "GT",
      "start_date": "2026-08-22",
      "end_date": "2026-09-13"
    },
    {
      "race_id": 791,
      "name": "Tour de Korea",
      "category": "C1",
      "start_date": "2026-08-31",
      "end_date": "2026-09-04"
    },
    {
      "race_id": 691,
      "name": "Lloyds Tour of Britain Men",
      "category": "PRO",
      "start_date": "2026-09-02",
      "end_date": "2026-09-06"
    },
    {
      "race_id": 763,
      "name": "ZLM Tour",
      "category": "C1",
      "start_date": "2026-09-02",
      "end_date": "2026-09-06"
    },
    {
      "race_id": 764,
      "name": "Tour of Istanbul",
      "category": "C1",
      "start_date": "2026-09-03",
      "end_date": "2026-09-06"
    },
    {
      "race_id": 692,
      "name": "Maryland Cycling Classic",
      "category": "PRO",
      "start_date": "2026-09-05",
      "end_date": "2026-09-07"
    },
    {
      "race_id": 693,
      "name": "GP Industria & Artigianato",
      "category": "PRO",
      "start_date": "2026-09-06",
      "end_date": "2026-09-06"
    },
    {
      "race_id": 765,
      "name": "Giro della Toscana - Memorial Alfredo Martini",
      "category": "C1",
      "start_date": "2026-09-09",
      "end_date": "2026-09-09"
    },
    {
      "race_id": 792,
      "name": "Tour of Binzhou",
      "category": "C1",
      "start_date": "2026-09-09",
      "end_date": "2026-09-09"
    },
    {
      "race_id": 694,
      "name": "Gran Premio città di Peccioli - Coppa Sabatini",
      "category": "PRO",
      "start_date": "2026-09-10",
      "end_date": "2026-09-10"
    },
    {
      "race_id": 653,
      "name": "Grand Prix Cycliste de Québec",
      "category": "MWT",
      "start_date": "2026-09-11",
      "end_date": "2026-09-11"
    },
    {
      "race_id": 766,
      "name": "Memorial Marco Pantani",
      "category": "C1",
      "start_date": "2026-09-12",
      "end_date": "2026-09-12"
    },
    {
      "race_id": 793,
      "name": "Tour of Taihu Lake",
      "category": "C1",
      "start_date": "2026-09-12",
      "end_date": "2026-09-16"
    },
    {
      "race_id": 654,
      "name": "Grand Prix Cycliste de Montréal",
      "category": "MWT",
      "start_date": "2026-09-13",
      "end_date": "2026-09-13"
    },
    {
      "race_id": 695,
      "name": "GP de Fourmies / La Voix du Nord",
      "category": "PRO",
      "start_date": "2026-09-13",
      "end_date": "2026-09-13"
    },
    {
      "race_id": 767,
      "name": "Trofeo Matteotti",
      "category": "C1",
      "start_date": "2026-09-13",
      "end_date": "2026-09-13"
    },
    {
      "race_id": 768,
      "name": "Il Giro d'Abruzzo",
      "category": "C1",
      "start_date": "2026-09-15",
      "end_date": "2026-09-18"
    },
    {
      "race_id": 696,
      "name": "Lotto Grand Prix de Wallonie",
      "category": "PRO",
      "start_date": "2026-09-16",
      "end_date": "2026-09-16"
    },
    {
      "race_id": 697,
      "name": "Skoda Tour de Luxembourg",
      "category": "PRO",
      "start_date": "2026-09-16",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 769,
      "name": "Okolo Slovenska / Tour de Slovaquie",
      "category": "C1",
      "start_date": "2026-09-16",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 770,
      "name": "Kampioenschap van Vlaanderen",
      "category": "C1",
      "start_date": "2026-09-18",
      "end_date": "2026-09-18"
    },
    {
      "race_id": 794,
      "name": "Tour of Huangshan",
      "category": "C1",
      "start_date": "2026-09-18",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 698,
      "name": "Flandrien 0.0 Classic",
      "category": "PRO",
      "start_date": "2026-09-19",
      "end_date": "2026-09-19"
    },
    {
      "race_id": 771,
      "name": "Gran Premio del Lazio",
      "category": "C1",
      "start_date": "2026-09-19",
      "end_date": "2026-09-19"
    },
    {
      "race_id": 657,
      "name": "World Championships ME - ITT",
      "category": "WC_ITT",
      "start_date": "2026-09-20",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 772,
      "name": "Giro Della Romagna",
      "category": "C1",
      "start_date": "2026-09-20",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 773,
      "name": "Giro di Campania",
      "category": "C1",
      "start_date": "2026-09-20",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 774,
      "name": "Gooikse pijl p/b Lotto",
      "category": "C1",
      "start_date": "2026-09-20",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 775,
      "name": "Grand Prix d'Isbergues - Pas de Calais",
      "category": "C1",
      "start_date": "2026-09-20",
      "end_date": "2026-09-20"
    },
    {
      "race_id": 699,
      "name": "CRO Race",
      "category": "PRO",
      "start_date": "2026-09-22",
      "end_date": "2026-09-27"
    },
    {
      "race_id": 776,
      "name": "Lotto Omloop van het Houtland",
      "category": "C1",
      "start_date": "2026-09-23",
      "end_date": "2026-09-23"
    },
    {
      "race_id": 658,
      "name": "World Championships ME - Road Race",
      "category": "WC",
      "start_date": "2026-09-27",
      "end_date": "2026-09-27"
    },
    {
      "race_id": 700,
      "name": "Le Tour de Langkawi",
      "category": "PRO",
      "start_date": "2026-09-27",
      "end_date": "2026-10-04"
    },
    {
      "race_id": 777,
      "name": "Paris-Chauny",
      "category": "C1",
      "start_date": "2026-09-27",
      "end_date": "2026-09-27"
    }
  ]
} as const;

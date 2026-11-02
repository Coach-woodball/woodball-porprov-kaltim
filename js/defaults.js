// Data awal sesuai THB PORPROV VIII Kaltim 2026. Semua bisa diubah admin di menu Pengaturan / Nomor.
(function (App) {
  const strokeSingle = () => ({
    rounds: [
      { name: 'Penyisihan R1', gates: 12, cut: null },
      { name: 'Penyisihan R2', gates: 12, cut: null },
      { name: 'Final', gates: 12, cut: 12 },
    ],
    groupSize: 4,
    tiebreak: ['lowGates:last', 'manual'],
    maxPerKontingen: 4,
  });
  const strokeDouble = () => ({
    rounds: [
      { name: 'Ronde 1', gates: 12, cut: null },
      { name: 'Ronde 2', gates: 12, cut: null },
    ],
    groupSize: 2,
    tiebreak: ['lowGates:all', 'manual'],
    maxPerKontingen: 1,
  });
  const strokeTeam = (src) => ({
    sourceEvent: src,
    sourceRounds: [0, 1],
    countBest: 4,
    tiebreak: ['bestMember', 'manual'],
    maxPerKontingen: 1,
  });
  const fairwayIndiv = (maxPer) => ({
    format: 'group_ko', // 'ko' = gugur murni (THB), 'group_ko' = grup + bagan, 'rr' = setengah kompetisi
    groupCount: 2,
    qualify: 2,
    thirdPlace: 'match', // 'match' = perebutan juara 3, 'shared' = 2 perunggu, 'none'
    winPoints: 2,
    gates: 12,
    maxPerKontingen: maxPer,
  });
  const fairwayTeam = () => ({
    format: 'rr',
    groupCount: 1,
    qualify: 2,
    thirdPlace: 'match',
    winPoints: 2,
    gates: 12,
    slots: ['Tunggal I', 'Tunggal II', 'Ganda (1)', 'Ganda (2)'],
    games: [
      { label: 'Tunggal I', slots: [0] },
      { label: 'Ganda', slots: [2, 3] },
      { label: 'Tunggal II', slots: [1] },
    ],
    maxPerKontingen: 1,
  });

  const ev = (id, name, discipline, kind, gender, config) => ({
    id, code: id, name, discipline, kind, gender,
    members: kind === 'single' ? 1 : kind === 'double' ? 2 : 4,
    config,
  });

  App.defaultEvents = () => [
    ev('SS-PA', 'Single Stroke Putra', 'stroke', 'single', 'L', strokeSingle()),
    ev('DS-PA', 'Double Stroke Putra', 'stroke', 'double', 'L', strokeDouble()),
    ev('TS-PA', 'Team Stroke Putra', 'stroke', 'team', 'L', strokeTeam('SS-PA')),
    ev('SF-PA', 'Single Fairway Putra', 'fairway', 'single', 'L', fairwayIndiv(1)),
    ev('DF-PA', 'Double Fairway Putra', 'fairway', 'double', 'L', fairwayIndiv(1)),
    ev('TF-PA', 'Team Fairway Putra', 'fairway', 'team', 'L', fairwayTeam()),
    ev('SS-PI', 'Single Stroke Putri', 'stroke', 'single', 'P', strokeSingle()),
    ev('DS-PI', 'Double Stroke Putri', 'stroke', 'double', 'P', strokeDouble()),
    ev('TS-PI', 'Team Stroke Putri', 'stroke', 'team', 'P', strokeTeam('SS-PI')),
    ev('SF-PI', 'Single Fairway Putri', 'fairway', 'single', 'P', fairwayIndiv(1)),
    ev('DF-PI', 'Double Fairway Putri', 'fairway', 'double', 'P', fairwayIndiv(1)),
    ev('TF-PI', 'Team Fairway Putri', 'fairway', 'team', 'P', fairwayTeam()),
    ev('MS-X', 'Mix Double Stroke', 'stroke', 'double', 'X', strokeDouble()),
    ev('MF-X', 'Mix Double Fairway', 'fairway', 'double', 'X', fairwayIndiv(1)),
  ];

  App.newEventTemplate = (discipline, kind) => {
    if (discipline === 'stroke') {
      if (kind === 'single') return strokeSingle();
      if (kind === 'double') return strokeDouble();
      return strokeTeam(null);
    }
    return kind === 'team' ? fairwayTeam() : fairwayIndiv(1);
  };

  App.defaultKontingen = () => [
    ['BALIKPAPAN', 'BPP'], ['SAMARINDA', 'SMD'], ['BONTANG', 'BTG'], ['KUTAI KARTANEGARA', 'KUKAR'],
    ['KUTAI TIMUR', 'KUTIM'], ['KUTAI BARAT', 'KUBAR'], ['BERAU', 'BERAU'], ['PASER', 'PASER'],
    ['PENAJAM PASER UTARA', 'PPU'], ['MAHAKAM ULU', 'MAHULU'],
  ].map(([name, short], i) => ({ id: 'k' + (i + 1), name, short }));

  App.defaultState = () => ({
    version: 1,
    event: {
      title: 'PEKAN OLAHRAGA PROVINSI (PORPROV) VIII TAHUN 2026',
      sport: 'WOODBALL',
      region: 'KALIMANTAN TIMUR',
      shortName: 'PORPROV VIII KALTIM 2026',
      dateStart: '2026-11-18',
      dateEnd: '2026-11-22',
      venue: 'Lapangan Woodball',
      city: 'Paser',
      organizer: 'PENGPROV IWbA KALIMANTAN TIMUR',
      lanes: 'A, B',
      logos: [],
      signers: [
        { title: 'Ketua Panitia Pelaksana', name: 'H. Abdul Gani, M.Pd' },
        { title: 'Technical Delegate', name: 'H. HASBAR, S.Pd, M.Pd' },
      ],
      resultSigner: { title: 'Technical Delegate', name: 'H. HASBAR, S.Pd, M.Pd' },
      certTitle: 'PIAGAM PENGHARGAAN',
      certIntro: 'Diberikan kepada :',
      certBody: 'Sebagai JUARA {juara} ({medali}) Nomor {nomor} pada Cabang Olahraga Woodball {event} yang dilaksanakan pada tanggal {tanggal} di {kota}.',
      certPartBody: 'Sebagai PESERTA Nomor {nomor} pada Cabang Olahraga Woodball {event} yang dilaksanakan pada tanggal {tanggal} di {kota}.',
      themeColor: '#16a34a',
      accentColor: '#dc2626',
    },
    menu: {
      dashboard: 'Beranda', athletes: 'Atlet', registration: 'Pendaftaran', kontingen: 'Kontingen', events: 'Nomor & Entri',
      stroke: 'Stroke', fairway: 'Fairway', results: 'Hasil & Medali', print: 'Cetak PDF',
      display: 'Layar Proyektor', settings: 'Pengaturan', backup: 'Backup Data',
    },
    validation: {
      enabled: true,
      maxEventsPerAthlete: 2,
      teamStrokeIncluded: true,
      separateDisciplines: true,
      minBirthDate: '1996-11-14',
      perKontingen: true,
    },
    admin: { pinHash: null },
    registration: App.reg.defaults(),
    registrations: [],
    kontingen: App.defaultKontingen(),
    athletes: [],
    events: App.defaultEvents(),
    entries: [],
    stroke: {},
    fairway: {},
  });
})(window.App);

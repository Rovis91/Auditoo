/** Stable UUIDs so `npm run db:seed` can upsert without duplicating rows. */
const INSPECTION_A = 'c0ffeea0-0001-4000-8000-000000000001'
const INSPECTION_B = 'c0ffeea0-0002-4000-8000-000000000002'
const INSPECTION_C = 'c0ffeea0-0003-4000-8000-000000000003'

const LEVEL_A_RDC = 'c0ffeeb0-0001-4000-8000-000000000101'
const LEVEL_A_ETA = 'c0ffeeb0-0002-4000-8000-000000000102'

const LEVEL_B_UNIQUE = 'c0ffeeb0-0003-4000-8000-000000000103'

const LEVEL_C_PP = 'c0ffeeb0-0004-4000-8000-000000000104'

function inspectionRows(agentId, companyId) {
  return [
    {
      id: INSPECTION_A,
      company_id: companyId,
      agent_id: agentId,
      owner_name: 'Sophie Martin',
      address: '12 rue des Lilas, 69003 Lyon',
      date: '2026-03-15',
      status: 'draft',
      construction_year: 1985,
      living_area: 112,
      heating_type: 'Gaz — chaudière condensation',
      hot_water_system: 'Ballon électrique 200 L',
      ventilation_type: 'VMC simple flux',
      insulation_context: 'Combles perdants : projet d’isolant laine minérale 300 mm.',
    },
    {
      id: INSPECTION_B,
      company_id: companyId,
      agent_id: agentId,
      owner_name: 'Marc Bernard',
      address: '8 avenue Foch, 75016 Paris',
      date: '2026-01-22',
      status: 'completed',
      construction_year: 1998,
      living_area: 68,
      heating_type: 'Chauffage urbain — radiateurs en fonte',
      hot_water_system: 'Chauffe-eau thermodynamique',
      ventilation_type: 'Ventilation naturelle ouvrants',
      insulation_context: 'ITE réalisée en 2019 (polystyrène graphite).',
    },
    {
      id: INSPECTION_C,
      company_id: companyId,
      agent_id: agentId,
      owner_name: 'Claire Petit',
      address: 'Villa Les Pins, chemin des Oliviers, 83110 Sanary-sur-Mer',
      date: '2026-04-02',
      status: 'draft',
      construction_year: 2005,
      living_area: 145,
      heating_type: 'Pompe à chaleur air/eau',
      hot_water_system: 'Solaire thermique + appoint électrique',
      ventilation_type: 'VMC double flux',
      insulation_context: 'Maison BBC d’origine ; extension non isolée au sud.',
    },
  ]
}

function levelRows() {
  return [
    {
      id: LEVEL_A_RDC,
      inspection_id: INSPECTION_A,
      label: 'Rez-de-chaussée',
      fractional_index: 'a0',
    },
    {
      id: LEVEL_A_ETA,
      inspection_id: INSPECTION_A,
      label: '1er étage',
      fractional_index: 'a1',
    },
    {
      id: LEVEL_B_UNIQUE,
      inspection_id: INSPECTION_B,
      label: 'Appartement — tout niveau',
      fractional_index: 'a0',
    },
    {
      id: LEVEL_C_PP,
      inspection_id: INSPECTION_C,
      label: 'Plain-pied',
      fractional_index: 'a0',
    },
  ]
}

function spaceRows() {
  return [
    // Inspection A — RDC
    {
      id: 'c0ffeec0-0101-4000-8000-000000000201',
      level_id: LEVEL_A_RDC,
      name: 'Salon',
      area: 32,
      window_count: 3,
      glazing_type: 'Double vitrage — lame argon',
      heating_presence: true,
      heating_type: 'Radiateurs acier',
      ventilation_presence: true,
      ventilation_type: 'Entrées d’air hygroréglables',
      insulation_rating: 'Bonne',
      fractional_index: 'a0',
    },
    {
      id: 'c0ffeec0-0102-4000-8000-000000000202',
      level_id: LEVEL_A_RDC,
      name: 'Cuisine',
      area: 14,
      window_count: 2,
      glazing_type: 'Double vitrage',
      heating_presence: false,
      heating_type: null,
      ventilation_presence: true,
      ventilation_type: 'Hotte décorative renouvelée',
      insulation_rating: 'Moyenne',
      fractional_index: 'a1',
    },
    {
      id: 'c0ffeec0-0103-4000-8000-000000000203',
      level_id: LEVEL_A_RDC,
      name: 'Entrée',
      area: 6,
      window_count: 1,
      glazing_type: 'Double vitrage',
      heating_presence: false,
      heating_type: null,
      ventilation_presence: false,
      ventilation_type: null,
      insulation_rating: null,
      fractional_index: 'a2',
    },
    // Inspection A — 1er étage
    {
      id: 'c0ffeec0-0201-4000-8000-000000000211',
      level_id: LEVEL_A_ETA,
      name: 'Chambre parentale',
      area: 18,
      window_count: 2,
      glazing_type: 'Double vitrage',
      heating_presence: true,
      heating_type: 'Radiateurs acier',
      ventilation_presence: true,
      ventilation_type: 'Entrées d’air',
      insulation_rating: 'Bonne',
      fractional_index: 'a0',
    },
    {
      id: 'c0ffeec0-0202-4000-8000-000000000212',
      level_id: LEVEL_A_ETA,
      name: 'Chambre enfant',
      area: 11,
      window_count: 1,
      glazing_type: 'Double vitrage',
      heating_presence: true,
      heating_type: 'Radiateurs acier',
      ventilation_presence: true,
      ventilation_type: 'Entrées d’air',
      insulation_rating: 'Bonne',
      fractional_index: 'a1',
    },
    {
      id: 'c0ffeec0-0203-4000-8000-000000000213',
      level_id: LEVEL_A_ETA,
      name: 'Salle de bain',
      area: 7,
      window_count: 1,
      glazing_type: 'Opaque',
      heating_presence: true,
      heating_type: 'Sèche-serviettes électrique',
      ventilation_presence: true,
      ventilation_type: 'VMC salle de bains',
      insulation_rating: null,
      fractional_index: 'a2',
    },
    // Inspection B — single level
    {
      id: 'c0ffeec0-0301-4000-8000-000000000301',
      level_id: LEVEL_B_UNIQUE,
      name: 'Séjour',
      area: 28,
      window_count: 2,
      glazing_type: 'Triple vitrage récent',
      heating_presence: true,
      heating_type: 'Radiateurs',
      ventilation_presence: false,
      ventilation_type: null,
      insulation_rating: 'Très bonne',
      fractional_index: 'a0',
    },
    {
      id: 'c0ffeec0-0302-4000-8000-000000000302',
      level_id: LEVEL_B_UNIQUE,
      name: 'Chambre',
      area: 14,
      window_count: 1,
      glazing_type: 'Triple vitrage',
      heating_presence: true,
      heating_type: 'Radiateurs',
      ventilation_presence: false,
      ventilation_type: null,
      insulation_rating: 'Très bonne',
      fractional_index: 'a1',
    },
    {
      id: 'c0ffeec0-0303-4000-8000-000000000303',
      level_id: LEVEL_B_UNIQUE,
      name: 'Cuisine ouverte',
      area: 10,
      window_count: 1,
      glazing_type: 'Triple vitrage',
      heating_presence: false,
      heating_type: null,
      ventilation_presence: true,
      ventilation_type: 'Hotte extraction',
      insulation_rating: 'Très bonne',
      fractional_index: 'a2',
    },
    // Inspection C — plain-pied
    {
      id: 'c0ffeec0-0401-4000-8000-000000000401',
      level_id: LEVEL_C_PP,
      name: 'Pièce à vivre + cuisine ouverte',
      area: 52,
      window_count: 5,
      glazing_type: 'Double vitrage renforcé',
      heating_presence: true,
      heating_type: 'Plancher chauffant',
      ventilation_presence: true,
      ventilation_type: 'VMC DF entretien à prévoir filtres',
      insulation_rating: 'Bonne',
      fractional_index: 'a0',
    },
    {
      id: 'c0ffeec0-0402-4000-8000-000000000402',
      level_id: LEVEL_C_PP,
      name: 'Buanderie / cellier',
      area: 8,
      window_count: 1,
      glazing_type: 'Double vitrage',
      heating_presence: false,
      heating_type: null,
      ventilation_presence: false,
      ventilation_type: null,
      insulation_rating: 'Moyenne',
      fractional_index: 'a1',
    },
  ]
}

export async function seedInspections(supabase, { userId, companyId }) {
  const inspections = inspectionRows(userId, companyId)
  const levels = levelRows()
  const spaces = spaceRows()

  const { error: e1 } = await supabase.from('inspections').upsert(inspections, {
    onConflict: 'id',
  })
  if (e1) throw new Error(`inspections seed failed: ${e1.message}`)

  const { error: e2 } = await supabase.from('levels').upsert(levels, { onConflict: 'id' })
  if (e2) throw new Error(`levels seed failed: ${e2.message}`)

  const { error: e3 } = await supabase.from('spaces').upsert(spaces, { onConflict: 'id' })
  if (e3) throw new Error(`spaces seed failed: ${e3.message}`)

  console.log('  mock inspections:', inspections.length, '(levels:', levels.length, ', spaces:', spaces.length, ')')
}

/// <reference types="cypress" />

describe('critical path', () => {
  it('login → create inspection → add level → add space → rename space → space detail (all fields) → delete level', () => {
    const suffix = Date.now()

    cy.visit('/login')
    cy.get('[data-testid="login-email"]').clear().type('agent@exemple.com')
    cy.get('[data-testid="login-password"]').clear().type('motdepasse')
    cy.get('[data-testid="login-submit"]').click()

    cy.get('[data-testid="inspections-new"]', { timeout: 20000 }).should('be.visible').click()
    cy.get('[data-testid="inspection-owner-name"]').type(`E2E Owner ${suffix}`)
    cy.get('[data-testid="inspection-submit"]').click()

    cy.location('pathname', { timeout: 20000 }).should('match', /^\/inspections\/[^/]+/)

    cy.get('[data-testid="offline-bar"]', { timeout: 20000 }).should('be.visible')

    cy.get('[data-testid="add-level"]').click()
    cy.get('[data-testid="new-level-name-input"]').type('Niveau E2E')
    cy.get('[data-testid="new-level-name-input"]').blur()

    cy.contains('[data-testid="level-label"]', 'Niveau E2E', { timeout: 15000 }).should('be.visible')

    cy.contains('[data-testid="level-label"]', 'Niveau E2E')
      .closest('[data-testid="level-section"]')
      .within(() => {
        cy.get('[data-testid="level-add-space"]').click()
      })

    cy.get('[data-testid="new-space-name-input"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="new-space-name-input"]').type('Espace A')
    cy.get('[data-testid="new-space-name-input"]').blur()

    cy.contains('[data-testid="space-name"]', 'Espace A', { timeout: 15000 }).should('be.visible')

    // Open space detail and fill every field (rename happens on the detail screen)
    cy.intercept('PATCH', '/spaces/*').as('saveSpace')

    cy.contains('[data-testid="space-name"]', 'Espace A').click()
    cy.location('pathname', { timeout: 10000 }).should('match', /\/inspections\/[^/]+\/spaces\/[^/]+/)

    cy.get('[data-testid="space-detail-name"]', { timeout: 10000 }).should('be.visible')
    cy.get('[data-testid="space-detail-name"]').clear().type('Salle E2E complète')

    cy.get('[data-testid="space-detail-area"]').clear().type('42.5')
    cy.get('[data-testid="space-detail-window-count"]').clear().type('3')

    cy.get('[data-testid="space-detail-glazing"]').click()
    cy.get('[role="option"]').contains('Double vitrage').click()

    cy.get('[data-testid="space-detail-heating-presence"]').click()
    cy.get('[data-testid="space-detail-heating-type"]').should('be.visible').click()
    cy.get('[role="option"]').contains('Plancher chauffant').click()

    cy.get('[data-testid="space-detail-ventilation-presence"]').click()
    cy.get('[data-testid="space-detail-ventilation-type"]').should('be.visible').click()
    cy.get('[role="option"]').contains('VMC double flux').click()

    cy.get('[data-testid="space-detail-insulation"]').click()
    cy.get('[role="option"]').contains('Bonne').click()

    // Wait for the last PATCH to complete instead of sleeping
    cy.wait('@saveSpace', { timeout: 5000 })

    cy.get('[data-testid="space-detail-back"]').click()
    cy.location('pathname', { timeout: 10000 }).should('match', /^\/inspections\/[^/]+/)

    cy.contains('[data-testid="space-name"]', 'Salle E2E complète', { timeout: 10000 }).should('be.visible')

    cy.contains('[data-testid="level-label"]', 'Niveau E2E')
      .closest('[data-testid="level-section"]')
      .within(() => {
        cy.get('[data-testid="level-delete"]').click()
      })

    cy.contains('Niveau E2E').should('not.exist')
    cy.contains('Salle E2E complète').should('not.exist')
  })
})

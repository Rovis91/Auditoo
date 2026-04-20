/// <reference types="cypress" />

describe('offline PATCH cache', () => {
  it('edited space name is visible immediately after navigating away and back while offline', () => {
    const suffix = Date.now()

    cy.visit('/login')
    cy.get('[data-testid="login-email"]').clear().type('agent@exemple.com')
    cy.get('[data-testid="login-password"]').clear().type('motdepasse')
    cy.get('[data-testid="login-submit"]').click()

    cy.get('[data-testid="inspections-new"]', { timeout: 20000 }).click()
    cy.get('[data-testid="inspection-owner-name"]').type(`Offline PATCH ${suffix}`)
    cy.get('[data-testid="inspection-submit"]').click()
    cy.location('pathname', { timeout: 20000 }).should('match', /^\/inspections\/[^/]+/)

    cy.get('[data-testid="add-level"]').click()
    cy.get('[data-testid="new-level-name-input"]').type('Niveau A')
    cy.get('[data-testid="new-level-name-input"]').blur()
    cy.contains('[data-testid="level-label"]', 'Niveau A', { timeout: 10000 })
      .closest('[data-testid="level-section"]')
      .within(() => { cy.get('[data-testid="level-add-space"]').click() })
    cy.get('[data-testid="new-space-name-input"]').type('Espace original')
    cy.get('[data-testid="new-space-name-input"]').blur()
    cy.contains('[data-testid="space-name"]', 'Espace original', { timeout: 10000 }).should('be.visible')

    // Navigate into space detail while online so data is in IDB cache
    cy.intercept('PATCH', '/spaces/*').as('firstPatch')
    cy.contains('[data-testid="space-name"]', 'Espace original').click()
    cy.location('pathname', { timeout: 10000 }).should('match', /\/spaces\//)

    // Go offline — block all API calls
    cy.intercept('GET', '**', { forceNetworkError: true }).as('offlineGet')
    cy.intercept('PATCH', '/spaces/*', { forceNetworkError: true }).as('offlinePatch')

    cy.get('[data-testid="space-detail-name"]', { timeout: 10000 }).clear().type('Espace renommé hors ligne')
    cy.get('[data-testid="space-detail-name"]').blur()

    // Navigate back to inspection view (still offline)
    cy.get('[data-testid="space-detail-back"]').click()
    cy.location('pathname', { timeout: 10000 }).should('match', /^\/inspections\/[^/]+$/)

    // The renamed space should appear from IDB cache, not a stale value
    cy.contains('[data-testid="space-name"]', 'Espace renommé hors ligne', { timeout: 5000 }).should('be.visible')
  })
})
